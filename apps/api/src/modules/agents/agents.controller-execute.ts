// Extension to agents.controller.ts for execute endpoint
// This should be added to the AgentsController class

import { Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import type { ExecuteAgentDto, ApiResponse } from '@o3c/shared-types';

// Add this method to AgentsController:

/*
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
*/

// Note: Also inject RowboatService in AgentsController constructor
