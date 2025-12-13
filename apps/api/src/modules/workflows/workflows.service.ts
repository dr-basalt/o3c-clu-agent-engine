import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';
import { RowboatService } from '../rowboat/rowboat.service';
import type {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ExecuteWorkflowDto,
} from '@o3c/shared-types';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
    private rowboatService: RowboatService
  ) {}

  /**
   * Create a new workflow
   */
  async create(userId: string, dto: CreateWorkflowDto): Promise<Workflow> {
    // Validate that all agents exist
    if (dto.steps && dto.steps.length > 0) {
      for (const step of dto.steps) {
        await this.agentsService.findOne(userId, step.agentId);
      }
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        metadata: dto.metadata || {},
        steps: {
          create: dto.steps?.map((step, index) => ({
            agentId: step.agentId,
            order: step.order !== undefined ? step.order : index,
            inputMapping: step.inputMapping || {},
            metadata: step.metadata || {},
          })) || [],
        },
      },
      include: {
        steps: {
          include: {
            agent: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    this.logger.log(`Workflow created: ${workflow.id} by user ${userId}`);
    return workflow as unknown as Workflow;
  }

  /**
   * Get all workflows for a user
   */
  async findAll(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ workflows: Workflow[]; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;

    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { userId, isActive: true },
        include: {
          steps: {
            include: {
              agent: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({
        where: { userId, isActive: true },
      }),
    ]);

    return {
      workflows: workflows as unknown as Workflow[],
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get a workflow by ID
   */
  async findOne(userId: string, id: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, userId, isActive: true },
      include: {
        steps: {
          include: {
            agent: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    return workflow as unknown as Workflow;
  }

  /**
   * Update a workflow
   */
  async update(userId: string, id: string, dto: UpdateWorkflowDto): Promise<Workflow> {
    // Verify ownership
    await this.findOne(userId, id);

    // Validate new agents if steps are being updated
    if (dto.steps && dto.steps.length > 0) {
      for (const step of dto.steps) {
        await this.agentsService.findOne(userId, step.agentId);
      }
    }

    // Delete existing steps if new steps are provided
    if (dto.steps) {
      await this.prisma.workflowStep.deleteMany({
        where: { workflowId: id },
      });
    }

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata && { metadata: dto.metadata }),
        ...(dto.steps && {
          steps: {
            create: dto.steps.map((step, index) => ({
              agentId: step.agentId,
              order: step.order !== undefined ? step.order : index,
              inputMapping: step.inputMapping || {},
              metadata: step.metadata || {},
            })),
          },
        }),
      },
      include: {
        steps: {
          include: {
            agent: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    this.logger.log(`Workflow updated: ${id} by user ${userId}`);
    return workflow as unknown as Workflow;
  }

  /**
   * Delete a workflow (soft delete)
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);

    await this.prisma.workflow.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Workflow deleted: ${id} by user ${userId}`);
  }

  /**
   * Execute a workflow
   */
  async execute(
    userId: string,
    workflowId: string,
    dto: ExecuteWorkflowDto
  ): Promise<{ executionId: string }> {
    const workflow = await this.findOne(userId, workflowId);

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new BadRequestException('Workflow has no steps to execute');
    }

    // Create workflow execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        userId,
        status: 'pending',
        inputData: dto.inputData || {},
        metadata: dto.metadata || {},
      },
    });

    // Start execution in background
    this.executeWorkflow(userId, workflow, execution.id, dto.inputData).catch((error) => {
      this.logger.error(`Workflow execution failed for ${execution.id}:`, error);
      this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
    });

    return { executionId: execution.id };
  }

  /**
   * Execute workflow steps sequentially
   */
  private async executeWorkflow(
    userId: string,
    workflow: Workflow,
    executionId: string,
    initialInput?: Record<string, any>
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    let previousOutput: any = initialInput || {};

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        this.logger.log(`Executing workflow ${workflow.id} step ${i + 1}/${workflow.steps.length}`);

        // Update current step
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: { currentStep: i },
        });

        // Prepare input for this step
        const stepInput = this.prepareStepInput(step, previousOutput);

        // Execute agent
        const { runId } = await this.rowboatService.executeAgent(
          userId,
          step.agentId,
          JSON.stringify(stepInput)
        );

        // Wait for agent execution to complete
        const result = await this.waitForAgentCompletion(runId);

        if (result.status === 'failed') {
          throw new Error(`Step ${i + 1} failed: ${result.errorMessage}`);
        }

        previousOutput = result.outputResult || {};
      }

      // Workflow completed successfully
      const duration = Date.now() - startTime;
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          outputData: previousOutput,
          completedAt: new Date(),
          durationMs: duration,
        },
      });

      this.logger.log(`Workflow ${workflow.id} completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
          durationMs: duration,
        },
      });

      throw error;
    }
  }

  /**
   * Prepare step input based on input mapping
   */
  private prepareStepInput(step: WorkflowStep, previousOutput: any): any {
    if (!step.inputMapping || Object.keys(step.inputMapping).length === 0) {
      return previousOutput;
    }

    const mappedInput: any = {};

    for (const [targetKey, sourceKey] of Object.entries(step.inputMapping)) {
      if (typeof sourceKey === 'string' && previousOutput[sourceKey] !== undefined) {
        mappedInput[targetKey] = previousOutput[sourceKey];
      }
    }

    return mappedInput;
  }

  /**
   * Wait for agent execution to complete
   */
  private async waitForAgentCompletion(runId: string, maxWaitTime: number = 300000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const execution = await this.prisma.executionRun.findUnique({
        where: { id: runId },
      });

      if (!execution) {
        throw new Error(`Execution ${runId} not found`);
      }

      if (execution.status === 'completed' || execution.status === 'failed') {
        return execution;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Execution ${runId} timeout after ${maxWaitTime}ms`);
  }

  /**
   * Get workflow execution status
   */
  async getExecution(userId: string, executionId: string): Promise<WorkflowExecution> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, userId },
      include: {
        workflow: {
          include: {
            steps: {
              include: {
                agent: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Workflow execution ${executionId} not found`);
    }

    return execution as unknown as WorkflowExecution;
  }

  /**
   * List workflow executions
   */
  async listExecutions(
    userId: string,
    workflowId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    executions: WorkflowExecution[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;
    const where: any = { userId };

    if (workflowId) {
      where.workflowId = workflowId;
    }

    const [executions, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        include: {
          workflow: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);

    return {
      executions: executions as unknown as WorkflowExecution[],
      total,
      page,
      pageSize,
    };
  }
}
