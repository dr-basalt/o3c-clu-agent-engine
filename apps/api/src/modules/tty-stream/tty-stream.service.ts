import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { NlpParserService, ParsedCommand } from './nlp-parser.service';
import { AgentsService } from '../agents/agents.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { RowboatService } from '../rowboat/rowboat.service';
import { DiscoveryService } from '../discovery/discovery.service';

export interface StreamMessage {
  type: 'output' | 'error' | 'command' | 'suggestion' | 'status';
  data: any;
  timestamp: Date;
}

@Injectable()
export class TtyStreamService {
  private readonly logger = new Logger(TtyStreamService.name);
  private readonly streams = new Map<string, Subject<StreamMessage>>();

  constructor(
    private nlpParser: NlpParserService,
    private agentsService: AgentsService,
    private workflowsService: WorkflowsService,
    private rowboatService: RowboatService,
    private discoveryService: DiscoveryService
  ) {}

  /**
   * Create or get a stream for a user session
   */
  getStream(sessionId: string): Observable<StreamMessage> {
    if (!this.streams.has(sessionId)) {
      this.streams.set(sessionId, new Subject<StreamMessage>());
    }
    return this.streams.get(sessionId)!.asObservable();
  }

  /**
   * Process a command through NLP and execute it
   */
  async processCommand(userId: string, sessionId: string, command: string): Promise<void> {
    const stream = this.streams.get(sessionId);
    if (!stream) {
      throw new Error('Stream not found');
    }

    try {
      // Parse command
      const parsed = this.nlpParser.parse(command);

      stream.next({
        type: 'command',
        data: { parsed },
        timestamp: new Date(),
      });

      if (parsed.confidence < 0.5) {
        // Low confidence - suggest alternatives
        const suggestions = this.nlpParser.suggestCommands(command);
        stream.next({
          type: 'suggestion',
          data: { suggestions, message: 'Did you mean one of these?' },
          timestamp: new Date(),
        });
        return;
      }

      // Execute based on intent
      await this.executeIntent(userId, sessionId, parsed);
    } catch (error) {
      stream.next({
        type: 'error',
        data: { message: error.message },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Execute command based on parsed intent
   */
  private async executeIntent(
    userId: string,
    sessionId: string,
    parsed: ParsedCommand
  ): Promise<void> {
    const stream = this.streams.get(sessionId)!;

    switch (parsed.intent) {
      case 'list_agents':
        await this.handleListAgents(userId, stream);
        break;

      case 'create_agent':
        await this.handleCreateAgent(userId, stream, parsed.entities);
        break;

      case 'run_agent':
        await this.handleRunAgent(userId, stream, parsed.entities);
        break;

      case 'schedule_agent':
        await this.handleScheduleAgent(userId, stream, parsed.entities);
        break;

      case 'list_workflows':
        await this.handleListWorkflows(userId, stream);
        break;

      case 'create_workflow':
        await this.handleCreateWorkflow(userId, stream, parsed.entities);
        break;

      case 'explore_tools':
        await this.handleExploreTools(userId, stream, parsed.entities);
        break;

      case 'check_agent_status':
        await this.handleCheckAgentStatus(userId, stream, parsed.entities);
        break;

      default:
        stream.next({
          type: 'error',
          data: { message: `Intent "${parsed.intent}" not yet implemented` },
          timestamp: new Date(),
        });
    }
  }

  /**
   * Handle list agents command
   */
  private async handleListAgents(userId: string, stream: Subject<StreamMessage>): Promise<void> {
    stream.next({
      type: 'status',
      data: { message: 'Fetching agents...' },
      timestamp: new Date(),
    });

    const result = await this.agentsService.findAll(userId, 1, 100);

    stream.next({
      type: 'output',
      data: {
        message: `Found ${result.total} agents`,
        agents: result.agents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          scheduled: a.scheduleCron || 'Not scheduled',
        })),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle create agent command
   */
  private async handleCreateAgent(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const purpose = entities.purpose || 'New agent';

    stream.next({
      type: 'status',
      data: { message: `Creating agent for: ${purpose}` },
      timestamp: new Date(),
    });

    const agent = await this.agentsService.create(userId, {
      name: `Agent for ${purpose.substring(0, 50)}`,
      systemPrompt: `You are an AI agent designed to ${purpose}`,
      description: purpose,
    });

    stream.next({
      type: 'output',
      data: {
        message: 'Agent created successfully',
        agent: {
          id: agent.id,
          name: agent.name,
        },
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle run agent command
   */
  private async handleRunAgent(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const agentName = entities.agentName;
    const input = entities.input;

    stream.next({
      type: 'status',
      data: { message: `Finding agent: ${agentName}` },
      timestamp: new Date(),
    });

    // Find agent by name
    const result = await this.agentsService.findAll(userId, 1, 100);
    const agent = result.agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase()
    );

    if (!agent) {
      stream.next({
        type: 'error',
        data: { message: `Agent "${agentName}" not found` },
        timestamp: new Date(),
      });
      return;
    }

    stream.next({
      type: 'status',
      data: { message: `Executing agent: ${agent.name}` },
      timestamp: new Date(),
    });

    const { runId } = await this.rowboatService.executeAgent(userId, agent.id, input);

    stream.next({
      type: 'output',
      data: {
        message: `Agent execution started`,
        runId,
        pollUrl: `/api/v1/executions/${runId}`,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle schedule agent command
   */
  private async handleScheduleAgent(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const agentName = entities.agentName;
    const schedule = entities.schedule;

    const cron = this.nlpParser.parseScheduleToCron(schedule);

    stream.next({
      type: 'status',
      data: { message: `Scheduling agent: ${agentName}` },
      timestamp: new Date(),
    });

    // Find agent by name
    const result = await this.agentsService.findAll(userId, 1, 100);
    const agent = result.agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase()
    );

    if (!agent) {
      stream.next({
        type: 'error',
        data: { message: `Agent "${agentName}" not found` },
        timestamp: new Date(),
      });
      return;
    }

    await this.agentsService.setSchedule(userId, agent.id, cron);

    stream.next({
      type: 'output',
      data: {
        message: `Agent scheduled successfully`,
        schedule: {
          agent: agent.name,
          cron,
          description: schedule,
        },
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle list workflows command
   */
  private async handleListWorkflows(
    userId: string,
    stream: Subject<StreamMessage>
  ): Promise<void> {
    stream.next({
      type: 'status',
      data: { message: 'Fetching workflows...' },
      timestamp: new Date(),
    });

    const result = await this.workflowsService.findAll(userId, 1, 100);

    stream.next({
      type: 'output',
      data: {
        message: `Found ${result.total} workflows`,
        workflows: result.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          steps: w.steps.length,
        })),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle create workflow command
   */
  private async handleCreateWorkflow(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const description = entities.description || 'New workflow';

    stream.next({
      type: 'status',
      data: { message: 'Creating workflow...' },
      timestamp: new Date(),
    });

    const workflow = await this.workflowsService.create(userId, {
      name: description.substring(0, 50),
      description,
      steps: [],
    });

    stream.next({
      type: 'output',
      data: {
        message: 'Workflow created successfully. Add steps to complete it.',
        workflow: {
          id: workflow.id,
          name: workflow.name,
        },
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle explore tools command
   */
  private async handleExploreTools(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const serverName = entities.serverName;

    stream.next({
      type: 'output',
      data: {
        message: `Exploring tools in ${serverName}...`,
        note: 'MCP server introspection requires direct rowboatx connection',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Handle check agent status command
   */
  private async handleCheckAgentStatus(
    userId: string,
    stream: Subject<StreamMessage>,
    entities: Record<string, any>
  ): Promise<void> {
    const agentName = entities.agentName;

    if (!agentName) {
      // Check for agents waiting for input
      stream.next({
        type: 'output',
        data: {
          message: 'Checking for agents waiting for input...',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Find agent and check last run
    const result = await this.agentsService.findAll(userId, 1, 100);
    const agent = result.agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase()
    );

    if (!agent) {
      stream.next({
        type: 'error',
        data: { message: `Agent "${agentName}" not found` },
        timestamp: new Date(),
      });
      return;
    }

    stream.next({
      type: 'output',
      data: {
        message: `Agent status for: ${agent.name}`,
        agent: {
          id: agent.id,
          name: agent.name,
          scheduled: agent.scheduleCron || 'Not scheduled',
        },
      },
      timestamp: new Date(),
    });
  }

  /**
   * Close a stream
   */
  closeStream(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.complete();
      this.streams.delete(sessionId);
    }
  }
}
