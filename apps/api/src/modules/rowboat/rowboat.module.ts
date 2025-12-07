import { Module, forwardRef } from '@nestjs/common';
import { RowboatService } from './rowboat.service';
import { ProvidersModule } from '../providers/providers.module';
import { AgentsModule } from '../agents/agents.module';
import { ExecutionsModule } from '../executions/executions.module';

@Module({
  imports: [ProvidersModule, forwardRef(() => AgentsModule), ExecutionsModule],
  providers: [RowboatService],
  exports: [RowboatService],
})
export class RowboatModule {}
