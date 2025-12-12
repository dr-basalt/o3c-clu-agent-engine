import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ExecuteWorkflowDto,
  ApiResponse,
} from '@o3c/shared-types';

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        isActive: { type: 'boolean', default: true },
        metadata: { type: 'object' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agentId: { type: 'string', format: 'uuid' },
              order: { type: 'integer' },
              inputMapping: { type: 'object' },
              metadata: { type: 'object' },
            },
            required: ['agentId'],
          },
        },
      },
      required: ['name'],
    },
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkflowDto
  ): Promise<ApiResponse> {
    const workflow = await this.workflowsService.create(userId, dto);
    return {
      success: true,
      data: workflow,
      message: 'Workflow created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20
  ): Promise<ApiResponse> {
    const result = await this.workflowsService.findAll(userId, page, pageSize);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const workflow = await this.workflowsService.findOne(userId, id);
    return {
      success: true,
      data: workflow,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        metadata: { type: 'object' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agentId: { type: 'string', format: 'uuid' },
              order: { type: 'integer' },
              inputMapping: { type: 'object' },
              metadata: { type: 'object' },
            },
            required: ['agentId'],
          },
        },
      },
    },
  })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto
  ): Promise<ApiResponse> {
    const workflow = await this.workflowsService.update(userId, id, dto);
    return {
      success: true,
      data: workflow,
      message: 'Workflow updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    await this.workflowsService.remove(userId, id);
    return {
      success: true,
      message: 'Workflow deleted successfully',
    };
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        inputData: { type: 'object', description: 'Input data for the workflow' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
    },
  })
  async execute(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto
  ): Promise<ApiResponse> {
    const result = await this.workflowsService.execute(userId, id, dto);
    return {
      success: true,
      data: result,
      message: 'Workflow execution started. Use the executionId to check status.',
    };
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get workflow execution history' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size' })
  async listExecutions(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20
  ): Promise<ApiResponse> {
    const result = await this.workflowsService.listExecutions(userId, id, page, pageSize);
    return {
      success: true,
      data: result,
    };
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get workflow execution status' })
  @ApiParam({ name: 'executionId', description: 'Workflow Execution ID' })
  async getExecution(
    @CurrentUser('id') userId: string,
    @Param('executionId', ParseUUIDPipe) executionId: string
  ): Promise<ApiResponse> {
    const execution = await this.workflowsService.getExecution(userId, executionId);
    return {
      success: true,
      data: execution,
    };
  }
}
