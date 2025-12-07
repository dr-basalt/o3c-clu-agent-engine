import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import type { CreateProviderDto, ProviderConfig } from '@o3c/shared-types';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
  }

  async create(userId: string, dto: CreateProviderDto): Promise<ProviderConfig> {
    // Encrypt API key if provided
    const apiKeyEncrypted = dto.apiKey
      ? EncryptionUtil.encrypt(dto.apiKey, this.encryptionKey)
      : null;

    // If this provider is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.providerConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await this.prisma.providerConfig.create({
      data: {
        userId,
        providerName: dto.providerName,
        flavor: dto.flavor,
        baseUrl: dto.baseUrl,
        apiKeyEncrypted,
        headers: dto.headers || {},
        isDefault: dto.isDefault,
        defaultModel: dto.defaultModel,
      },
    });

    this.logger.log(`Provider config created: ${config.providerName} for user ${userId}`);

    return config as ProviderConfig;
  }

  async findAll(userId: string): Promise<ProviderConfig[]> {
    const configs = await this.prisma.providerConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return configs as ProviderConfig[];
  }

  async findOne(userId: string, id: string): Promise<ProviderConfig> {
    const config = await this.prisma.providerConfig.findFirst({
      where: { id, userId },
    });

    if (!config) {
      throw new NotFoundException('Provider config not found');
    }

    return config as ProviderConfig;
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<CreateProviderDto>
  ): Promise<ProviderConfig> {
    // Check if config exists and belongs to user
    await this.findOne(userId, id);

    // Encrypt new API key if provided
    const updateData: any = { ...dto };
    if (dto.apiKey) {
      updateData.apiKeyEncrypted = EncryptionUtil.encrypt(dto.apiKey, this.encryptionKey);
      delete updateData.apiKey;
    }

    // If this provider is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.providerConfig.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const config = await this.prisma.providerConfig.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Provider config updated: ${config.providerName} for user ${userId}`);

    return config as ProviderConfig;
  }

  async remove(userId: string, id: string): Promise<void> {
    // Check if config exists and belongs to user
    await this.findOne(userId, id);

    await this.prisma.providerConfig.delete({
      where: { id },
    });

    this.logger.log(`Provider config deleted: ${id} for user ${userId}`);
  }

  async testConnection(userId: string, id: string): Promise<{ success: boolean; message: string }> {
    const config = await this.findOne(userId, id);

    // Decrypt API key
    const apiKey = config.apiKeyEncrypted
      ? EncryptionUtil.decrypt(config.apiKeyEncrypted, this.encryptionKey)
      : null;

    try {
      // Test connection based on provider flavor
      switch (config.flavor) {
        case 'openai':
        case 'openai-compatible':
          await this.testOpenAIConnection(config.baseUrl || 'https://api.openai.com/v1', apiKey);
          break;
        case 'anthropic':
          await this.testAnthropicConnection(apiKey);
          break;
        default:
          return {
            success: true,
            message: 'Connection test not implemented for this provider type',
          };
      }

      return {
        success: true,
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async testOpenAIConnection(baseUrl: string, apiKey: string): Promise<void> {
    if (!apiKey) {
      throw new BadRequestException('API key is required for testing');
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async testAnthropicConnection(apiKey: string): Promise<void> {
    if (!apiKey) {
      throw new BadRequestException('API key is required for testing');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok && response.status !== 400) {
      // 400 is ok for this test - it means auth works
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Get decrypted provider configs for generating RowboatX models.json
   */
  async getDecryptedConfigs(userId: string): Promise<
    Array<{
      providerName: string;
      flavor: string;
      baseUrl?: string;
      apiKey?: string;
      headers?: Record<string, string>;
      defaultModel?: string;
    }>
  > {
    const configs = await this.findAll(userId);

    return configs.map((config) => ({
      providerName: config.providerName,
      flavor: config.flavor,
      baseUrl: config.baseUrl,
      apiKey: config.apiKeyEncrypted
        ? EncryptionUtil.decrypt(config.apiKeyEncrypted, this.encryptionKey)
        : undefined,
      headers: config.headers as Record<string, string>,
      defaultModel: config.defaultModel,
    }));
  }
}
