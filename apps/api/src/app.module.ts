import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

// Controllers
import { AppController } from './app.controller';

// Modules
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ExecutionsModule } from './modules/executions/executions.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { RowboatModule } from './modules/rowboat/rowboat.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { TtyStreamModule } from './modules/tty-stream/tty-stream.module';
import { OpenaiProxyModule } from './modules/openai-proxy/openai-proxy.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  controllers: [AppController],
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('RATE_LIMIT_WINDOW_MS', 900000),
          limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
        },
      ],
    }),

    // BullMQ for job scheduling
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        prefix: 'o3c',
      }),
    }),

    // Core modules
    PrismaModule,
    HealthModule,

    // Feature modules
    AuthModule,
    ProvidersModule,
    AgentsModule,
    WorkflowsModule,
    DiscoveryModule,
    TtyStreamModule,
    ExecutionsModule,
    SchedulerModule,
    RowboatModule,
    OpenaiProxyModule,
  ],
})
export class AppModule {}
