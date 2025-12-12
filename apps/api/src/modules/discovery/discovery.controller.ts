import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ApiResponse } from '@o3c/shared-types';

@ApiTags('Discovery')
@ApiBearerAuth()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('agents')
  @ApiOperation({
    summary: 'Discover all agents in user rowboat workspace',
    description: 'Scans ~/.rowboat/agents directory for agent configurations',
  })
  async discoverAgents(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const agents = await this.discoveryService.discoverAgents(userId);
    return {
      success: true,
      data: agents,
      message: `Discovered ${agents.length} agents in workspace`,
    };
  }

  @Get('workflows')
  @ApiOperation({
    summary: 'Discover all workflows in user rowboat workspace',
    description: 'Scans ~/.rowboat/workflows directory for workflow definitions',
  })
  async discoverWorkflows(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const workflows = await this.discoveryService.discoverWorkflows(userId);
    return {
      success: true,
      data: workflows,
      message: `Discovered ${workflows.length} workflows in workspace`,
    };
  }

  @Post('agents/:name/import')
  @ApiOperation({
    summary: 'Import a discovered agent into the database',
    description: 'Imports an agent from the workspace into the database for management',
  })
  @ApiParam({ name: 'name', description: 'Agent name to import' })
  async importAgent(
    @CurrentUser('id') userId: string,
    @Param('name') name: string
  ): Promise<ApiResponse> {
    const agent = await this.discoveryService.importAgent(userId, name);
    return {
      success: true,
      data: agent,
      message: `Agent ${name} imported successfully`,
    };
  }

  @Post('agents/sync')
  @ApiOperation({
    summary: 'Sync all discovered agents with database',
    description: 'Automatically imports all discovered agents that are not yet in the database',
  })
  async syncAgents(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const result = await this.discoveryService.syncAgents(userId);
    return {
      success: true,
      data: result,
      message: `Synced ${result.imported} new agents, ${result.skipped} skipped`,
    };
  }
}
