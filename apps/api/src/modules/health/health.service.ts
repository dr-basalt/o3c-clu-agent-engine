import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async ready() {
    const dbHealthy = await this.prisma.healthCheck();

    return {
      status: dbHealthy ? 'ready' : 'not ready',
      checks: {
        database: dbHealthy ? 'connected' : 'disconnected',
      },
    };
  }

  async metrics() {
    const memoryUsage = process.memoryUsage();

    return {
      uptime: process.uptime(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
      },
      cpu: process.cpuUsage(),
    };
  }
}
