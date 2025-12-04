import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RowboatService } from '../rowboat/rowboat.service';
import type { AgentJobData } from '@o3c/shared-types';

@Processor('agent-scheduler')
export class AgentProcessor {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(private rowboatService: RowboatService) {}

  @Process('execute-agent')
  async handleAgentExecution(job: Job<AgentJobData>) {
    const { agentId, userId, input } = job.data;

    this.logger.log(`Processing agent execution: ${agentId} (Job ID: ${job.id})`);

    try {
      const result = await this.rowboatService.executeAgent(userId, agentId, input);

      this.logger.log(`Agent ${agentId} execution started (Run ID: ${result.runId})`);

      return {
        success: true,
        runId: result.runId,
      };
    } catch (error) {
      this.logger.error(`Agent ${agentId} execution failed:`, error);
      throw error; // This will mark the job as failed
    }
  }
}
