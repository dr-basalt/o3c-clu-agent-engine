import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CreateProviderDto, ApiResponse } from '@o3c/shared-types';

@ApiTags('Providers')
@ApiBearerAuth()
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new provider configuration' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        providerName: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google', 'ollama', 'lm-studio', 'custom'],
        },
        flavor: {
          type: 'string',
          enum: ['openai', 'anthropic', 'openai-compatible'],
        },
        baseUrl: { type: 'string', format: 'uri' },
        apiKey: { type: 'string' },
        headers: { type: 'object' },
        isDefault: { type: 'boolean' },
        defaultModel: { type: 'string' },
      },
      required: ['providerName', 'flavor'],
    },
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProviderDto
  ): Promise<ApiResponse> {
    const config = await this.providersService.create(userId, dto);
    return {
      success: true,
      data: config,
      message: 'Provider configuration created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all provider configurations' })
  async findAll(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const configs = await this.providersService.findAll(userId);
    return {
      success: true,
      data: configs,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a provider configuration by ID' })
  @ApiParam({ name: 'id', description: 'Provider configuration ID' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const config = await this.providersService.findOne(userId, id);
    return {
      success: true,
      data: config,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a provider configuration' })
  @ApiParam({ name: 'id', description: 'Provider configuration ID' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateProviderDto>
  ): Promise<ApiResponse> {
    const config = await this.providersService.update(userId, id, dto);
    return {
      success: true,
      data: config,
      message: 'Provider configuration updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a provider configuration' })
  @ApiParam({ name: 'id', description: 'Provider configuration ID' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    await this.providersService.remove(userId, id);
    return {
      success: true,
      message: 'Provider configuration deleted successfully',
    };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test provider connection' })
  @ApiParam({ name: 'id', description: 'Provider configuration ID' })
  async testConnection(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponse> {
    const result = await this.providersService.testConnection(userId, id);
    return {
      success: result.success,
      data: result,
      message: result.message,
    };
  }
}
