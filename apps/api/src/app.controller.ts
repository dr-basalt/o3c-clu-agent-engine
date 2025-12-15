import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Get()
  @Public()
  @ApiExcludeEndpoint()
  @Redirect('/api/docs', 302)
  root() {
    // This will redirect to Swagger documentation
    return;
  }

  @Get('api')
  @Public()
  @ApiExcludeEndpoint()
  getApiInfo() {
    return {
      name: 'O3C RowboatX API',
      version: '1.0.0',
      description: 'AI Agent orchestration API with TTY streaming, NLP, and workflow management',
      endpoints: {
        docs: '/api/docs',
        health: '/api/v1/health',
        api: '/api/v1',
      },
      features: [
        'AI Agent Management',
        'Workflow Orchestration',
        'TTY Streaming with NLP',
        'Agent Discovery from ~/.rowboat',
        'OpenAI-compatible Proxy',
      ],
      links: {
        swagger: '/api/docs',
        health: '/api/v1/health',
        ready: '/api/v1/health/ready',
        metrics: '/api/v1/health/metrics',
      },
    };
  }
}
