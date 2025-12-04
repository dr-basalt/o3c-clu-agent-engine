import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateAgentDto, Agent, PaginatedResponse } from '@o3c/shared-types';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAgentDto): Promise<Agent> {
    const agent = await this.prisma.agent.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        mcpServers: dto.mcpServers || [],
        tools: dto.tools || [],
        scheduleCron: dto.scheduleCron,
        isActive: dto.isActive,
        allowShell: dto.allowShell,
        maxIterations: dto.maxIterations,
        metadata: dto.metadata || {},
      },
    });

    this.logger.log(`Agent created: ${agent.name} (${agent.id}) for user ${userId}`);

    return agent as Agent;
  }

  async findAll(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<Agent>> {
    const skip = (page - 1) * pageSize;

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({
        where: { userId },
      }),
    ]);

    return {
      items: agents as Agent[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(userId: string, id: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent as Agent;
  }

  async update(userId: string, id: string, dto: Partial<CreateAgentDto>): Promise<Agent> {
    // Check if agent exists and belongs to user
    await this.findOne(userId, id);

    const agent = await this.prisma.agent.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Agent updated: ${agent.name} (${agent.id}) for user ${userId}`);

    return agent as Agent;
  }

  async remove(userId: string, id: string): Promise<void> {
    // Check if agent exists and belongs to user
    await this.findOne(userId, id);

    await this.prisma.agent.delete({
      where: { id },
    });

    this.logger.log(`Agent deleted: ${id} for user ${userId}`);
  }

  async setSchedule(userId: string, id: string, scheduleCron: string): Promise<Agent> {
    // Validate cron expression (basic validation)
    if (!this.isValidCronExpression(scheduleCron)) {
      throw new Error('Invalid cron expression');
    }

    const agent = await this.update(userId, id, { scheduleCron });

    this.logger.log(`Schedule set for agent ${id}: ${scheduleCron}`);

    return agent;
  }

  async removeSchedule(userId: string, id: string): Promise<Agent> {
    const agent = await this.update(userId, id, { scheduleCron: null });

    this.logger.log(`Schedule removed for agent ${id}`);

    return agent;
  }

  async findScheduledAgents(): Promise<Agent[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        isActive: true,
        scheduleCron: { not: null },
      },
    });

    return agents as Agent[];
  }

  private isValidCronExpression(expression: string): boolean {
    // Basic cron validation - accepts standard 5-field or 6-field cron
    const cronRegex =
      /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|2\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/;
    return cronRegex.test(expression);
  }
}
