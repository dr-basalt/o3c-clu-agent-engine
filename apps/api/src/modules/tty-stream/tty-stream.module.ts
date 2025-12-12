import { Module } from '@nestjs/common';
import { TtyStreamService } from './tty-stream.service';
import { TtyStreamController } from './tty-stream.controller';
import { NlpParserService } from './nlp-parser.service';
import { AgentsModule } from '../agents/agents.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { RowboatModule } from '../rowboat/rowboat.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [AgentsModule, WorkflowsModule, RowboatModule, DiscoveryModule],
  controllers: [TtyStreamController],
  providers: [TtyStreamService, NlpParserService],
  exports: [TtyStreamService, NlpParserService],
})
export class TtyStreamModule {}
