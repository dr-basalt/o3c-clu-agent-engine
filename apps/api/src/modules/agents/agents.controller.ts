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
import { AgentsService } from './agents.service';
import { RowboatService } from '../rowboat/rowboat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CreateAgentDto, ExecuteAgentDto, ApiResponse } from '@o3c/shared-types';

@ApiTags('Agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly rowboatService: RowboatService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        systemPrompt: { type: 'string', minLength: 1 },
        mcpServers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              command: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } },
              env: { type: 'object' },
            },
          },
        },
        tools: { type: 'array', items: { type: 'string' } },
        scheduleCron: { type: 'string' },
        isActive: { type: 'boolean', default: true },
        allowShell: { type: 'boolean', default: false },
        maxIterations: { type: 'integer', default: 10 },
        metadata: { type: 'object' },
      },
      required: ['name', 'systemPrompt'],
    },
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAgentDto
  ): Promise<ApiResponse> {
    const agent = await this.agentsService.create(userId, dto);
    return {
      success: true,
      data: agent,
      message: 'Agent created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all agents' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20
  ): Promise<ApiResponse> {
    const result = await this.agentsService.findAll(userId, page, pageSize);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by ID' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const agent = await this.agentsService.findOne(userId, id);
    return {
      success: true,
      data: agent,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateAgentDto>
  ): Promise<ApiResponse> {
    const agent = await this.agentsService.update(userId, id, dto);
    return {
      success: true,
      data: agent,
      message: 'Agent updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    await this.agentsService.remove(userId, id);
    return {
      success: true,
      message: 'Agent deleted successfully',
    };
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Set agent schedule' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scheduleCron: { type: 'string', description: 'Cron expression' },
      },
      required: ['scheduleCron'],
    },
  })
  async setSchedule(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('scheduleCron') scheduleCron: string
  ): Promise<ApiResponse> {
    const agent = await this.agentsService.setSchedule(userId, id, scheduleCron);
    return {
      success: true,
      data: agent,
      message: 'Schedule set successfully',
    };
  }

  @Delete(':id/schedule')
  @ApiOperation({ summary: 'Remove agent schedule' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async removeSchedule(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const agent = await this.agentsService.removeSchedule(userId, id);
    return {
      success: true,
      data: agent,
      message: 'Schedule removed successfully',
    };
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input for the agent' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
    },
  })
  async execute(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteAgentDto
  ): Promise<ApiResponse> {
    const result = await this.rowboatService.executeAgent(userId, id, dto.input);
    return {
      success: true,
      data: result,
      message: 'Agent execution started. Use the runId to check status.',
    };
  }
}
