import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { RowboatModule } from '../rowboat/rowboat.module';

@Module({
  imports: [PrismaModule, AgentsModule, RowboatModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
