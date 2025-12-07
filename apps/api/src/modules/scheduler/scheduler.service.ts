import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { AgentsService } from '../agents/agents.service';
import type { AgentJobData } from '@o3c/shared-types';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('agent-scheduler') private agentQueue: Queue<AgentJobData>,
    private agentsService: AgentsService
  ) {}

  async onModuleInit() {
    // Sync scheduled agents on startup
    await this.syncScheduledAgents();
    this.logger.log('Scheduler service initialized');
  }

  /**
   * Sync all scheduled agents with BullMQ
   */
  async syncScheduledAgents(): Promise<void> {
    const scheduledAgents = await this.agentsService.findScheduledAgents();

    this.logger.log(`Syncing ${scheduledAgents.length} scheduled agents`);

    for (const agent of scheduledAgents) {
      if (agent.scheduleCron) {
        await this.scheduleAgent(agent.id, agent.userId, agent.scheduleCron);
      }
    }
  }

  /**
   * Schedule an agent with cron expression
   */
  async scheduleAgent(agentId: string, userId: string, cronExpression: string): Promise<void> {
    const jobId = `agent-${agentId}`;

    // Remove existing job if any
    const existingJob = await this.agentQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    // Add new repeatable job
    await this.agentQueue.add(
      'execute-agent',
      {
        agentId,
        userId,
        runId: randomUUID(),
      },
      {
        jobId,
        repeat: {
          cron: cronExpression,
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      }
    );

    this.logger.log(`Agent ${agentId} scheduled with cron: ${cronExpression}`);
  }

  /**
   * Unschedule an agent
   */
  async unscheduleAgent(agentId: string): Promise<void> {
    const jobId = `agent-${agentId}`;

    const job = await this.agentQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Agent ${agentId} unscheduled`);
    }
  }

  /**
   * Execute agent immediately (add to queue)
   */
  async executeAgentNow(agentId: string, userId: string, input?: string): Promise<string> {
    const runId = randomUUID();
    const job = await this.agentQueue.add(
      'execute-agent',
      {
        agentId,
        userId,
        runId,
        input,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    this.logger.log(`Agent ${agentId} queued for execution (Job ID: ${job.id})`);

    return job.id.toString();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.agentQueue.getWaitingCount(),
      this.agentQueue.getActiveCount(),
      this.agentQueue.getCompletedCount(),
      this.agentQueue.getFailedCount(),
      this.agentQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Resync scheduled agents every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleResync() {
    this.logger.log('Resyncing scheduled agents...');
    await this.syncScheduledAgents();
  }
}
