import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { AgentProcessor } from './agent.processor';
import { AgentsModule } from '../agents/agents.module';
import { RowboatModule } from '../rowboat/rowboat.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'agent-scheduler',
    }),
    AgentsModule,
    RowboatModule,
  ],
  providers: [SchedulerService, AgentProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
