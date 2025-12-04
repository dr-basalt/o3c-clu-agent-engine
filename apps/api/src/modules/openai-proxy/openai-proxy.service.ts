import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { RowboatService } from '../rowboat/rowboat.service';
import { ExecutionsService } from '../executions/executions.service';
import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIAsyncResponse,
} from '@o3c/shared-types';

@Injectable()
export class OpenaiProxyService {
  private readonly logger = new Logger(OpenaiProxyService.name);

  constructor(
    private rowboatService: RowboatService,
    private executionsService: ExecutionsService
  ) {}

  /**
   * Handle OpenAI-compatible chat completion request
   */
  async chatCompletion(
    userId: string,
    request: OpenAIChatCompletionRequest
  ): Promise<OpenAIChatCompletionResponse | OpenAIAsyncResponse> {
    // Extract agent ID from model field (format: "agent:{agent_id}")
    const agentId = this.extractAgentId(request.model);

    // Get input from last user message
    const userMessages = request.messages.filter((m) => m.role === 'user');
    const input = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

    // Check if async mode is requested
    const runAsync = request.metadata?.run_async === true;

    if (runAsync) {
      // Async mode: Start execution and return immediately
      const result = await this.rowboatService.executeAgent(userId, agentId, input);

      return {
        id: result.runId,
        status: 'pending',
        poll_url: `/v1/runs/${result.runId}`,
      };
    } else {
      // Sync mode: Wait for execution to complete
      const result = await this.rowboatService.executeAgent(userId, agentId, input);

      // Poll for completion
      const executionResult = await this.waitForCompletion(userId, result.runId);

      return this.formatOpenAIResponse(result.runId, agentId, executionResult);
    }
  }

  /**
   * Get run status (for async mode)
   */
  async getRunStatus(userId: string, runId: string) {
    const run = await this.executionsService.findOne(userId, runId);

    if (run.status === 'completed') {
      return {
        id: runId,
        status: 'completed',
        result: {
          content: this.extractOutputContent(run),
          metadata: run.metadata,
        },
        created_at: run.createdAt,
        completed_at: run.completedAt,
      };
    } else if (run.status === 'failed') {
      return {
        id: runId,
        status: 'failed',
        error: run.errorMessage,
        created_at: run.createdAt,
        completed_at: run.completedAt,
      };
    } else {
      return {
        id: runId,
        status: run.status,
        created_at: run.createdAt,
      };
    }
  }

  /**
   * Extract agent ID from model string
   */
  private extractAgentId(model: string): string {
    if (!model.startsWith('agent:')) {
      throw new BadRequestException(
        'Invalid model format. Use "agent:{agent_id}" to target an agent.'
      );
    }

    return model.substring(6); // Remove "agent:" prefix
  }

  /**
   * Wait for execution to complete (with timeout)
   */
  private async waitForCompletion(
    userId: string,
    runId: string,
    maxWaitMs: number = 300000 // 5 minutes
  ): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < maxWaitMs) {
      const run = await this.executionsService.findOne(userId, runId);

      if (run.status === 'completed') {
        return run;
      } else if (run.status === 'failed') {
        throw new Error(run.errorMessage || 'Execution failed');
      } else if (run.status === 'waiting_input') {
        throw new Error('Execution is waiting for input');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Execution timeout');
  }

  /**
   * Format response in OpenAI format
   */
  private formatOpenAIResponse(
    runId: string,
    agentId: string,
    execution: any
  ): OpenAIChatCompletionResponse {
    const content = this.extractOutputContent(execution);

    return {
      id: runId,
      object: 'chat.completion',
      created: Math.floor(execution.createdAt.getTime() / 1000),
      model: `agent:${agentId}`,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  /**
   * Extract output content from execution result
   */
  private extractOutputContent(execution: any): string {
    if (execution.outputResult && execution.outputResult.content) {
      return execution.outputResult.content;
    }

    // Fallback: return last log entries
    if (execution.logs && execution.logs.length > 0) {
      return execution.logs.slice(-10).join('\n');
    }

    return 'Execution completed';
  }
}
