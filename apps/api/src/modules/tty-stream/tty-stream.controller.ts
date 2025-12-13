import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { TtyStreamService, StreamMessage } from './tty-stream.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ApiResponse } from '@o3c/shared-types';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('TTY Stream')
@ApiBearerAuth()
@Controller('tty')
export class TtyStreamController {
  constructor(private readonly ttyStreamService: TtyStreamService) {}

  @Post('command')
  @ApiOperation({
    summary: 'Send a natural language command to rowboatx',
    description: 'Parses and executes rowboat commands using semantic NLP',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Natural language command' },
        sessionId: { type: 'string', description: 'Session ID for streaming' },
      },
      required: ['command'],
    },
  })
  async sendCommand(
    @CurrentUser('id') userId: string,
    @Body('command') command: string,
    @Body('sessionId') sessionId?: string
  ): Promise<ApiResponse> {
    const session = sessionId || uuidv4();

    // Process command asynchronously
    this.ttyStreamService.processCommand(userId, session, command);

    return {
      success: true,
      data: {
        sessionId: session,
        streamUrl: `/api/v1/tty/stream/${session}`,
        message: 'Command processing started. Connect to streamUrl for output.',
      },
    };
  }

  @Sse('stream/:sessionId')
  @ApiOperation({
    summary: 'Stream TTY output via Server-Sent Events',
    description: 'Real-time stream of command execution output',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  streamOutput(
    @Param('sessionId') sessionId: string
  ): Observable<MessageEvent> {
    return this.ttyStreamService.getStream(sessionId).pipe(
      map((message: StreamMessage) => ({
        data: JSON.stringify(message),
      }))
    );
  }

  @Post('stream/:sessionId/close')
  @ApiOperation({
    summary: 'Close a TTY stream session',
    description: 'Cleanup and close an active stream',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID to close' })
  closeStream(@Param('sessionId') sessionId: string): ApiResponse {
    this.ttyStreamService.closeStream(sessionId);
    return {
      success: true,
      message: 'Stream closed successfully',
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check for TTY service',
    description: 'Check if the TTY streaming service is operational',
  })
  healthCheck(): ApiResponse {
    return {
      success: true,
      data: {
        status: 'operational',
        timestamp: new Date(),
      },
    };
  }
}
