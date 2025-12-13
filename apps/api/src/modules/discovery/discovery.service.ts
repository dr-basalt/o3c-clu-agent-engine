import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DiscoveredAgent {
  name: string;
  path: string;
  systemPrompt?: string;
  mcpServers?: any[];
  tools?: string[];
  metadata?: Record<string, any>;
  isInDatabase: boolean;
  databaseId?: string;
}

export interface DiscoveredWorkflow {
  name: string;
  path: string;
  agents?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly workspacesPath: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    this.workspacesPath = this.configService.get('WORKSPACES_PATH', '/data/workspaces');
  }

  /**
   * Discover all agents in user's rowboat workspace
   */
  async discoverAgents(userId: string): Promise<DiscoveredAgent[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { workspaceId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const workspacePath = this.getUserWorkspacePath(user.workspaceId);
    const agentsPath = join(workspacePath, '.rowboat', 'agents');

    try {
      await fs.access(agentsPath);
    } catch {
      this.logger.log(`Agents directory not found: ${agentsPath}`);
      return [];
    }

    const discoveredAgents: DiscoveredAgent[] = [];

    try {
      const entries = await fs.readdir(agentsPath, { withFileTypes: true });

      // Get all agents from database for comparison
      const dbAgents = await this.prisma.agent.findMany({
        where: { userId, isActive: true },
        select: { id: true, name: true },
      });

      const dbAgentMap = new Map<string, string>(dbAgents.map((a) => [a.name, a.id]));

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentPath = join(agentsPath, entry.name);
          const configPath = join(agentPath, 'config.json');

          try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);

            const isInDatabase = dbAgentMap.has(entry.name);
            const databaseId = dbAgentMap.get(entry.name);

            discoveredAgents.push({
              name: entry.name,
              path: agentPath,
              systemPrompt: config.systemPrompt || config.prompt,
              mcpServers: config.mcpServers || config.tools || [],
              tools: config.tools || [],
              metadata: config.metadata || {},
              isInDatabase,
              databaseId,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to read agent config at ${configPath}:`, errorMsg);

            // Add discovered agent without config
            const isInDatabase = dbAgentMap.has(entry.name);
            const databaseId = dbAgentMap.get(entry.name);

            discoveredAgents.push({
              name: entry.name,
              path: agentPath,
              isInDatabase,
              databaseId,
            });
          }
        }
      }

      this.logger.log(`Discovered ${discoveredAgents.length} agents for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to discover agents for user ${userId}:`, error);
      throw error;
    }

    return discoveredAgents;
  }

  /**
   * Discover all workflows in user's rowboat workspace
   */
  async discoverWorkflows(userId: string): Promise<DiscoveredWorkflow[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { workspaceId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const workspacePath = this.getUserWorkspacePath(user.workspaceId);
    const workflowsPath = join(workspacePath, '.rowboat', 'workflows');

    try {
      await fs.access(workflowsPath);
    } catch {
      this.logger.log(`Workflows directory not found: ${workflowsPath}`);
      return [];
    }

    const discoveredWorkflows: DiscoveredWorkflow[] = [];

    try {
      const entries = await fs.readdir(workflowsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const workflowPath = join(workflowsPath, entry.name);

          try {
            const workflowContent = await fs.readFile(workflowPath, 'utf-8');
            const workflow = JSON.parse(workflowContent);

            discoveredWorkflows.push({
              name: entry.name.replace('.json', ''),
              path: workflowPath,
              agents: workflow.agents || workflow.steps || [],
              metadata: workflow.metadata || {},
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to read workflow at ${workflowPath}:`, errorMsg);
          }
        }
      }

      this.logger.log(`Discovered ${discoveredWorkflows.length} workflows for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to discover workflows for user ${userId}:`, error);
      throw error;
    }

    return discoveredWorkflows;
  }

  /**
   * Import a discovered agent into the database
   */
  async importAgent(userId: string, agentName: string): Promise<any> {
    const discoveredAgents = await this.discoverAgents(userId);
    const agent = discoveredAgents.find((a) => a.name === agentName);

    if (!agent) {
      throw new Error(`Agent ${agentName} not found in workspace`);
    }

    if (agent.isInDatabase) {
      throw new Error(`Agent ${agentName} already exists in database`);
    }

    // Create agent in database
    const newAgent = await this.prisma.agent.create({
      data: {
        userId,
        name: agent.name,
        systemPrompt: agent.systemPrompt || 'No system prompt found',
        mcpServers: agent.mcpServers || [],
        tools: agent.tools || [],
        metadata: {
          ...agent.metadata,
          importedFrom: agent.path,
          importedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Imported agent ${agentName} for user ${userId}`);
    return newAgent;
  }

  /**
   * Sync all discovered agents with database
   */
  async syncAgents(userId: string): Promise<{ imported: number; skipped: number }> {
    const discoveredAgents = await this.discoverAgents(userId);
    let imported = 0;
    let skipped = 0;

    for (const agent of discoveredAgents) {
      if (!agent.isInDatabase && agent.systemPrompt) {
        try {
          await this.importAgent(userId, agent.name);
          imported++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to import agent ${agent.name}:`, errorMsg);
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    this.logger.log(`Synced agents for user ${userId}: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped };
  }

  /**
   * Get user workspace path
   */
  private getUserWorkspacePath(workspaceId: string): string {
    return join(this.workspacesPath, workspaceId);
  }
}
