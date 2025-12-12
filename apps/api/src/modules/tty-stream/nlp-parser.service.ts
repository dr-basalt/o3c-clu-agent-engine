import { Injectable, Logger } from '@nestjs/common';

export interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  rawCommand: string;
}

export type CommandIntent =
  | 'add_mcp'
  | 'explore_tools'
  | 'create_agent'
  | 'attach_tools'
  | 'allow_shell'
  | 'schedule_agent'
  | 'list_agents'
  | 'check_agent_status'
  | 'run_agent'
  | 'create_workflow'
  | 'list_workflows'
  | 'unknown';

/**
 * NLP Parser Service for Rowboat semantic protocol
 * Parses natural language commands following Rowboat documentation patterns
 */
@Injectable()
export class NlpParserService {
  private readonly logger = new Logger(NlpParserService.name);

  // Rowboat command patterns based on documentation
  private readonly patterns = [
    // MCP Server Management
    {
      intent: 'add_mcp' as CommandIntent,
      patterns: [
        /add\s+(?:this\s+)?mcp(?:\s+server)?(?:\s+config)?[:\s]+(.+)/i,
        /configure\s+mcp\s+server[:\s]+(.+)/i,
        /add\s+mcp\s+(.+)/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        mcpConfig: match[1]?.trim(),
      }),
    },
    {
      intent: 'explore_tools' as CommandIntent,
      patterns: [
        /what\s+tools\s+(?:are\s+there\s+)?in\s+<?([a-zA-Z0-9_-]+)>?/i,
        /(?:list|show)\s+tools\s+(?:from|in)\s+<?([a-zA-Z0-9_-]+)>?/i,
        /explore\s+tools\s+<?([a-zA-Z0-9_-]+)>?/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        serverName: match[1]?.replace(/[<>]/g, '').trim(),
      }),
    },

    // Agent Creation and Configuration
    {
      intent: 'create_agent' as CommandIntent,
      patterns: [
        /create\s+agent\s+to\s+(.+)/i,
        /make\s+(?:a|an)\s+agent\s+(?:to|that)\s+(.+)/i,
        /create\s+agent\s+(.+)/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        purpose: match[1]?.trim(),
      }),
    },
    {
      intent: 'attach_tools' as CommandIntent,
      patterns: [
        /attach\s+(?:the\s+)?(?:correct\s+)?tools\s+from\s+<?([a-zA-Z0-9_-]+)>?\s+to\s+(?:the\s+)?agent/i,
        /add\s+tools\s+from\s+<?([a-zA-Z0-9_-]+)>?\s+to\s+agent/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        mcpServerName: match[1]?.replace(/[<>]/g, '').trim(),
      }),
    },
    {
      intent: 'allow_shell' as CommandIntent,
      patterns: [
        /allow\s+(?:the\s+)?agent\s+to\s+run\s+shell\s+commands(?:\s+including\s+(.+))?/i,
        /enable\s+shell\s+(?:access|commands)\s+(?:for\s+)?agent/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        allowedCommands: match[1]?.split(/,\s*|\s+and\s+/).map(c => c.trim()),
      }),
    },

    // Agent Scheduling
    {
      intent: 'schedule_agent' as CommandIntent,
      patterns: [
        /make\s+agent\s+<?([a-zA-Z0-9_-]+)>?\s+run\s+every\s+(.+)/i,
        /schedule\s+agent\s+<?([a-zA-Z0-9_-]+)>?\s+(?:to\s+run\s+)?(.+)/i,
        /run\s+agent\s+<?([a-zA-Z0-9_-]+)>?\s+every\s+(.+)/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        agentName: match[1]?.replace(/[<>]/g, '').trim(),
        schedule: match[2]?.trim(),
      }),
    },

    // Agent Status and Listing
    {
      intent: 'list_agents' as CommandIntent,
      patterns: [
        /what\s+agents\s+(?:do\s+I\s+have|are)\s+scheduled\s+to\s+run/i,
        /(?:list|show)\s+(?:all\s+)?(?:scheduled\s+)?agents/i,
        /which\s+agents\s+(?:do\s+I\s+have|exist)/i,
      ],
      extractEntities: () => ({}),
    },
    {
      intent: 'check_agent_status' as CommandIntent,
      patterns: [
        /when\s+was\s+<?([a-zA-Z0-9_-]+)>?\s+last\s+run/i,
        /status\s+of\s+agent\s+<?([a-zA-Z0-9_-]+)>?/i,
        /are\s+any\s+agents\s+waiting\s+for\s+(?:my\s+)?(?:input|confirmation)/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        agentName: match[1]?.replace(/[<>]/g, '').trim(),
      }),
    },

    // Manual Agent Execution
    {
      intent: 'run_agent' as CommandIntent,
      patterns: [
        /run\s+agent\s+<?([a-zA-Z0-9_-]+)>?(?:\s+with\s+input[:\s]+(.+))?/i,
        /execute\s+agent\s+<?([a-zA-Z0-9_-]+)>?(?:\s+(.+))?/i,
        /start\s+agent\s+<?([a-zA-Z0-9_-]+)>?/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        agentName: match[1]?.replace(/[<>]/g, '').trim(),
        input: match[2]?.trim(),
      }),
    },

    // Workflow Management
    {
      intent: 'create_workflow' as CommandIntent,
      patterns: [
        /create\s+workflow\s+(.+)/i,
        /make\s+(?:a\s+)?pipeline\s+(.+)/i,
        /create\s+pipeline\s+with\s+agents\s+(.+)/i,
      ],
      extractEntities: (match: RegExpMatchArray) => ({
        description: match[1]?.trim(),
      }),
    },
    {
      intent: 'list_workflows' as CommandIntent,
      patterns: [
        /(?:list|show)\s+(?:all\s+)?workflows/i,
        /what\s+workflows\s+(?:do\s+I\s+have|exist)/i,
      ],
      extractEntities: () => ({}),
    },
  ];

  /**
   * Parse a natural language command into structured intent and entities
   */
  parse(command: string): ParsedCommand {
    const normalizedCommand = command.trim();

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedCommand.match(regex);
        if (match) {
          const entities = pattern.extractEntities(match);
          const confidence = this.calculateConfidence(match, normalizedCommand);

          this.logger.debug(`Parsed command: "${command}" -> ${pattern.intent}`, entities);

          return {
            intent: pattern.intent,
            entities,
            confidence,
            rawCommand: command,
          };
        }
      }
    }

    // No pattern matched
    this.logger.warn(`Could not parse command: "${command}"`);
    return {
      intent: 'unknown',
      entities: {},
      confidence: 0,
      rawCommand: command,
    };
  }

  /**
   * Calculate confidence score based on match quality
   */
  private calculateConfidence(match: RegExpMatchArray, command: string): number {
    // Simple confidence calculation based on match coverage
    const matchLength = match[0].length;
    const commandLength = command.trim().length;
    const coverage = matchLength / commandLength;

    // Boost confidence if we extracted entities
    const hasEntities = match.length > 1 && match.slice(1).some((m) => m !== undefined);
    const confidenceBoost = hasEntities ? 0.2 : 0;

    return Math.min(0.95, coverage + confidenceBoost);
  }

  /**
   * Convert a natural schedule description to cron expression
   */
  parseScheduleToCron(scheduleDescription: string): string {
    const normalized = scheduleDescription.toLowerCase().trim();

    // Common patterns
    const patterns: Record<string, string> = {
      // Daily patterns
      'every day at 10 am': '0 10 * * *',
      'every day at 10am': '0 10 * * *',
      'daily at 10am': '0 10 * * *',
      'every morning at 10': '0 10 * * *',

      // Hourly patterns
      'every hour': '0 * * * *',
      'hourly': '0 * * * *',

      // Weekly patterns
      'every monday at 9am': '0 9 * * 1',
      'every week': '0 0 * * 0',

      // Monthly patterns
      'every month': '0 0 1 * *',
      'monthly': '0 0 1 * *',
    };

    // Check direct match
    if (patterns[normalized]) {
      return patterns[normalized];
    }

    // Parse "every X minutes/hours/days"
    const everyMatch = normalized.match(/every\s+(\d+)\s+(minute|hour|day)s?/);
    if (everyMatch) {
      const interval = parseInt(everyMatch[1]);
      const unit = everyMatch[2];

      if (unit === 'minute') {
        return `*/${interval} * * * *`;
      } else if (unit === 'hour') {
        return `0 */${interval} * * *`;
      } else if (unit === 'day') {
        return `0 0 */${interval} * *`;
      }
    }

    // Parse "at HH:MM" or "at HH AM/PM"
    const timeMatch = normalized.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];

      if (meridiem === 'pm' && hour < 12) {
        hour += 12;
      } else if (meridiem === 'am' && hour === 12) {
        hour = 0;
      }

      return `${minute} ${hour} * * *`;
    }

    // Default: return as-is (might be already a cron expression)
    return normalized;
  }

  /**
   * Suggest commands based on partial input
   */
  suggestCommands(partialCommand: string): string[] {
    const suggestions: string[] = [];
    const lowerPartial = partialCommand.toLowerCase();

    const commandExamples = [
      "Add MCP server: <config>",
      "What tools are there in <server-name>",
      "Create agent to <task description>",
      "Attach tools from <mcp-server-name> to the agent",
      "Allow the agent to run shell commands",
      "Make agent <name> run every day at 10 AM",
      "What agents do I have scheduled to run",
      "When was <agent-name> last run",
      "Run agent <name> with input <text>",
      "Create workflow <description>",
      "List all workflows",
    ];

    for (const example of commandExamples) {
      if (example.toLowerCase().includes(lowerPartial)) {
        suggestions.push(example);
      }
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }
}
