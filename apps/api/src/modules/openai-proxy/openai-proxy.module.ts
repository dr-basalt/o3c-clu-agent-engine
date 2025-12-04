import { Module } from '@nestjs/common';
import { OpenaiProxyController } from './openai-proxy.controller';
import { OpenaiProxyService } from './openai-proxy.service';
import { RowboatModule } from '../rowboat/rowboat.module';
import { ExecutionsModule } from '../executions/executions.module';

@Module({
  imports: [RowboatModule, ExecutionsModule],
  controllers: [OpenaiProxyController],
  providers: [OpenaiProxyService],
})
export class OpenaiProxyModule {}
