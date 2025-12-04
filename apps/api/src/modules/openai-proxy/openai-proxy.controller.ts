import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam, ApiBody } from '@nestjs/swagger';
import { OpenaiProxyService } from './openai-proxy.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { OpenAIChatCompletionRequest } from '@o3c/shared-types';

@ApiTags('OpenAI')
@Controller('v1')
@Public() // This bypasses JWT, but we'll use ApiKeyGuard instead
export class OpenaiProxyController {
  constructor(private readonly openaiProxyService: OpenaiProxyService) {}

  @Post('chat/completions')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'OpenAI-compatible chat completion endpoint' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model in format "agent:{agent_id}"',
          example: 'agent:550e8400-e29b-41d4-a716-446655440000',
        },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
        stream: { type: 'boolean', default: false },
        metadata: {
          type: 'object',
          properties: {
            run_async: {
              type: 'boolean',
              description: 'If true, returns immediately with run ID',
            },
          },
        },
      },
      required: ['model', 'messages'],
    },
  })
  async chatCompletion(
    @CurrentUser('id') userId: string,
    @Body() request: OpenAIChatCompletionRequest
  ) {
    return this.openaiProxyService.chatCompletion(userId, request);
  }

  @Get('runs/:runId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get run status (for async executions)' })
  @ApiParam({ name: 'runId', description: 'Run ID returned from async execution' })
  async getRunStatus(@CurrentUser('id') userId: string, @Param('runId') runId: string) {
    return this.openaiProxyService.getRunStatus(userId, runId);
  }
}
