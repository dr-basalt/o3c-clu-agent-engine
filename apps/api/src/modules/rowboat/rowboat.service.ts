import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProvidersService } from '../providers/providers.service';
import { AgentsService } from '../agents/agents.service';
import { ExecutionsService } from '../executions/executions.service';
import type { Agent } from '@o3c/shared-types';

@Injectable()
export class RowboatService {
  private readonly logger = new Logger(RowboatService.name);
  private readonly workspacesPath: string;
  private readonly runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(
    private prisma: PrismaService,
    private providersService: ProvidersService,
    private agentsService: AgentsService,
    private executionsService: ExecutionsService,
    private configService: ConfigService
  ) {
    this.workspacesPath = this.configService.get('WORKSPACES_PATH', '/data/workspaces');
  }

  /**
   * Initialize user workspace with RowboatX configuration
   */
  async initializeUserWorkspace(userId: string, workspaceId: string): Promise<void> {
    const workspacePath = this.getUserWorkspacePath(workspaceId);
    const rowboatConfigPath = join(workspacePath, '.rowboat', 'config');

    try {
      // Create workspace directories
      await fs.mkdir(rowboatConfigPath, { recursive: true });

      this.logger.log(`Workspace initialized for user ${userId} at ${workspacePath}`);
    } catch (error) {
      this.logger.error(`Failed to initialize workspace for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize provider configs from DB to models.json
   */
  async syncProviderConfigs(userId: string, workspaceId: string): Promise<void> {
    const configs = await this.providersService.getDecryptedConfigs(userId);

    // Build models.json structure
    const modelsConfig: any = {};

    for (const config of configs) {
      const providerConfig: any = {
        flavor: config.flavor,
      };

      if (config.baseUrl) {
        providerConfig.baseUrl = config.baseUrl;
      }

      if (config.apiKey) {
        providerConfig.apiKey = config.apiKey;
      }

      if (config.headers && Object.keys(config.headers).length > 0) {
        providerConfig.headers = config.headers;
      }

      if (config.defaultModel) {
        providerConfig.defaultModel = config.defaultModel;
      }

      modelsConfig[config.providerName] = providerConfig;
    }

    // Write models.json
    const workspacePath = this.getUserWorkspacePath(workspaceId);
    const configPath = join(workspacePath, '.rowboat', 'config', 'models.json');

    await fs.writeFile(configPath, JSON.stringify(modelsConfig, null, 2));

    this.logger.log(`Provider configs synced for user ${userId}`);
  }

  /**
   * Execute an agent via RowboatX CLI
   */
  async executeAgent(
    userId: string,
    agentId: string,
    input?: string
  ): Promise<{ runId: string }> {
    // Get agent and user info
    const agent = await this.agentsService.findOne(userId, agentId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { workspaceId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Ensure workspace is initialized
    await this.ensureWorkspaceInitialized(userId, user.workspaceId);

    // Create execution run
    const run = await this.executionsService.create(userId, agentId, { input });

    // Start execution in background
    this.startExecution(user.workspaceId, agent, run.id, input).catch((error) => {
      this.logger.error(`Execution failed for run ${run.id}:`, error);
      this.executionsService.updateStatus(run.id, 'failed', {
        errorMessage: error.message,
        completedAt: new Date(),
      });
    });

    return { runId: run.id };
  }

  /**
   * Start agent execution
   */
  private async startExecution(
    workspaceId: string,
    agent: Agent,
    runId: string,
    input?: string
  ): Promise<void> {
    const workspacePath = this.getUserWorkspacePath(workspaceId);

    // Update status to running
    await this.executionsService.updateStatus(runId, 'running', {
      startedAt: new Date(),
    });

    const args = [
      '--system-prompt',
      agent.systemPrompt,
      '--max-iterations',
      agent.maxIterations.toString(),
    ];

    if (agent.allowShell) {
      args.push('--allow-shell');
    }

    if (input) {
      args.push('--input', input);
    }

    // Add MCP servers
    if (agent.mcpServers && Array.isArray(agent.mcpServers) && agent.mcpServers.length > 0) {
      for (const server of agent.mcpServers as any[]) {
        args.push('--mcp-server', `${server.name}:${server.command}`);
      }
    }

    this.logger.log(`Starting RowboatX for run ${runId} with args:`, args);

    try {
      const childProcess = spawn('rowboatx', args, {
        cwd: workspacePath,
        env: {
          ...process.env,
          HOME: workspacePath,
          ROWBOAT_HOME: join(workspacePath, '.rowboat'),
        },
      });

      this.runningProcesses.set(runId, childProcess);

      const logs: string[] = [];

      childProcess.stdout.on('data', (data) => {
        const log = data.toString();
        logs.push(log);
        this.logger.debug(`[${runId}] stdout: ${log}`);
      });

      childProcess.stderr.on('data', (data) => {
        const log = data.toString();
        logs.push(log);
        this.logger.debug(`[${runId}] stderr: ${log}`);
      });

      childProcess.on('close', async (code) => {
        this.runningProcesses.delete(runId);

        // Save logs
        await this.executionsService.appendLogs(runId, logs);

        if (code === 0) {
          // Success
          await this.executionsService.updateStatus(runId, 'completed', {
            completedAt: new Date(),
            outputResult: { exitCode: code },
          });
          this.logger.log(`Execution ${runId} completed successfully`);
        } else {
          // Failure
          await this.executionsService.updateStatus(runId, 'failed', {
            errorMessage: `Process exited with code ${code}`,
            completedAt: new Date(),
          });
          this.logger.error(`Execution ${runId} failed with code ${code}`);
        }
      });

      process.on('error', async (error) => {
        this.runningProcesses.delete(runId);

        await this.executionsService.appendLogs(runId, [
          `Process error: ${error.message}`,
        ]);

        await this.executionsService.updateStatus(runId, 'failed', {
          errorMessage: error.message,
          completedAt: new Date(),
        });

        this.logger.error(`Execution ${runId} error:`, error);
      });
    } catch (error) {
      this.logger.error(`Failed to start execution ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Kill a running execution
   */
  async killExecution(runId: string): Promise<void> {
    const process = this.runningProcesses.get(runId);

    if (process) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(runId);
      this.logger.log(`Execution ${runId} killed`);
    }
  }

  /**
   * Ensure workspace is initialized and synced
   */
  private async ensureWorkspaceInitialized(userId: string, workspaceId: string): Promise<void> {
    const workspacePath = this.getUserWorkspacePath(workspaceId);

    try {
      await fs.access(workspacePath);
    } catch {
      // Workspace doesn't exist, create it
      await this.initializeUserWorkspace(userId, workspaceId);
    }

    // Always sync provider configs before execution
    await this.syncProviderConfigs(userId, workspaceId);
  }

  /**
   * Get user workspace path
   */
  private getUserWorkspacePath(workspaceId: string): string {
    return join(this.workspacesPath, workspaceId);
  }

  /**
   * List user agents (from RowboatX perspective)
   */
  async listUserAgents(userId: string): Promise<Agent[]> {
    const agents = await this.prisma.agent.findMany({
      where: { userId, isActive: true },
    });
    return agents as Agent[];
  }

  /**
   * Get running executions count
   */
  getRunningExecutionsCount(): number {
    return this.runningProcesses.size;
  }
}
