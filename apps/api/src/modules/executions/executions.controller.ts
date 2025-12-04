import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Observable, interval, map, switchMap, from } from 'rxjs';
import { ExecutionsService } from './executions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ApiResponse } from '@o3c/shared-types';

@ApiTags('Executions')
@ApiBearerAuth()
@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all execution runs' })
  @ApiQuery({ name: 'agentId', required: false, description: 'Filter by agent ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('agentId') agentId?: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number
  ): Promise<ApiResponse> {
    const result = await this.executionsService.findAll(userId, {
      agentId,
      status,
      page,
      pageSize,
    });
    return {
      success: true,
      data: result,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get execution statistics' })
  async getStats(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const stats = await this.executionsService.getStats(userId);
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an execution run by ID' })
  @ApiParam({ name: 'id', description: 'Execution run ID' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const run = await this.executionsService.findOne(userId, id);
    return {
      success: true,
      data: run,
    };
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs' })
  @ApiParam({ name: 'id', description: 'Execution run ID' })
  async getLogs(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const logs = await this.executionsService.getLogs(userId, id);
    return {
      success: true,
      data: { logs },
    };
  }

  @Sse(':id/logs/stream')
  @ApiOperation({ summary: 'Stream execution logs (Server-Sent Events)' })
  @ApiParam({ name: 'id', description: 'Execution run ID' })
  streamLogs(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Observable<MessageEvent> {
    // Poll for new logs every second
    return interval(1000).pipe(
      switchMap(() => from(this.executionsService.findOne(userId, id))),
      map((run) => ({
        data: {
          status: run.status,
          logs: run.logs,
          completedAt: run.completedAt,
          errorMessage: run.errorMessage,
        },
      }))
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an execution' })
  @ApiParam({ name: 'id', description: 'Execution run ID' })
  async cancel(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const run = await this.executionsService.cancel(userId, id);
    return {
      success: true,
      data: run,
      message: 'Execution cancelled successfully',
    };
  }

  @Post(':id/input')
  @ApiOperation({ summary: 'Provide input for waiting execution' })
  @ApiParam({ name: 'id', description: 'Execution run ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
  })
  async provideInput(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('input') input: string
  ): Promise<ApiResponse> {
    const run = await this.executionsService.provideInput(userId, id, input);
    return {
      success: true,
      data: run,
      message: 'Input provided successfully',
    };
  }
}
