import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ExecutionRun, PaginatedResponse, ExecuteAgentDto } from '@o3c/shared-types';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    agentId: string,
    dto?: ExecuteAgentDto
  ): Promise<ExecutionRun> {
    const run = await this.prisma.executionRun.create({
      data: {
        userId,
        agentId,
        status: 'pending',
        inputText: dto?.input,
        metadata: dto?.metadata || {},
      },
    });

    this.logger.log(`Execution run created: ${run.id} for agent ${agentId}`);

    return run as ExecutionRun;
  }

  async findAll(
    userId: string,
    filters?: {
      agentId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResponse<ExecutionRun>> {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId };

    if (filters?.agentId) {
      where.agentId = filters.agentId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const [runs, total] = await Promise.all([
      this.prisma.executionRun.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.executionRun.count({ where }),
    ]);

    return {
      items: runs as ExecutionRun[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(userId: string, id: string): Promise<ExecutionRun> {
    const run = await this.prisma.executionRun.findFirst({
      where: { id, userId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Execution run not found');
    }

    return run as ExecutionRun;
  }

  async updateStatus(
    id: string,
    status: string,
    data?: {
      startedAt?: Date;
      completedAt?: Date;
      errorMessage?: string;
      outputResult?: any;
    }
  ): Promise<ExecutionRun> {
    const updateData: any = { status };

    if (data?.startedAt) {
      updateData.startedAt = data.startedAt;
    }

    if (data?.completedAt) {
      updateData.completedAt = data.completedAt;

      // Calculate duration
      const run = await this.prisma.executionRun.findUnique({ where: { id } });
      if (run?.startedAt) {
        updateData.durationMs = data.completedAt.getTime() - run.startedAt.getTime();
      }
    }

    if (data?.errorMessage) {
      updateData.errorMessage = data.errorMessage;
    }

    if (data?.outputResult) {
      updateData.outputResult = data.outputResult;
    }

    const run = await this.prisma.executionRun.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Execution run ${id} status updated to: ${status}`);

    return run as ExecutionRun;
  }

  async appendLog(id: string, logEntry: string): Promise<void> {
    await this.prisma.executionRun.update({
      where: { id },
      data: {
        logs: {
          push: logEntry,
        },
      },
    });
  }

  async appendLogs(id: string, logEntries: string[]): Promise<void> {
    const run = await this.prisma.executionRun.findUnique({
      where: { id },
      select: { logs: true },
    });

    if (run) {
      await this.prisma.executionRun.update({
        where: { id },
        data: {
          logs: [...run.logs, ...logEntries],
        },
      });
    }
  }

  async cancel(userId: string, id: string): Promise<ExecutionRun> {
    // Check if run exists and belongs to user
    await this.findOne(userId, id);

    const run = await this.updateStatus(id, 'failed', {
      errorMessage: 'Execution cancelled by user',
      completedAt: new Date(),
    });

    this.logger.log(`Execution run ${id} cancelled by user ${userId}`);

    return run;
  }

  async provideInput(userId: string, id: string, input: string): Promise<ExecutionRun> {
    const run = await this.findOne(userId, id);

    if (run.status !== 'waiting_input') {
      throw new Error('Execution is not waiting for input');
    }

    // Update run with input and change status back to running
    const updatedRun = await this.prisma.executionRun.update({
      where: { id },
      data: {
        inputText: input,
        status: 'running',
      },
    });

    this.logger.log(`Input provided for execution run ${id}`);

    // TODO: Resume the execution with the provided input
    // This would typically involve signaling the RowboatX process

    return updatedRun as ExecutionRun;
  }

  async getLogs(userId: string, id: string): Promise<string[]> {
    const run = await this.findOne(userId, id);
    return run.logs;
  }

  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const [total, pending, running, completed, failed] = await Promise.all([
      this.prisma.executionRun.count({ where: { userId } }),
      this.prisma.executionRun.count({ where: { userId, status: 'pending' } }),
      this.prisma.executionRun.count({ where: { userId, status: 'running' } }),
      this.prisma.executionRun.count({ where: { userId, status: 'completed' } }),
      this.prisma.executionRun.count({ where: { userId, status: 'failed' } }),
    ]);

    return { total, pending, running, completed, failed };
  }
}
