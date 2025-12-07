import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RegisterDto, LoginDto, ApiResponse } from '@o3c/shared-types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' },
      },
      required: ['email', 'password'],
    },
  })
  async register(@Body() dto: RegisterDto): Promise<ApiResponse> {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
      message: 'User registered successfully. Save your API key - it will not be shown again!',
    };
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
      required: ['email', 'password'],
    },
  })
  async login(@Body() dto: LoginDto): Promise<ApiResponse> {
    const result = await this.authService.login(dto);
    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string' },
      },
      required: ['refreshToken'],
    },
  })
  async refresh(@Body('refreshToken') refreshToken: string): Promise<ApiResponse> {
    const result = await this.authService.refreshToken(refreshToken);
    return {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async getCurrentUser(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const user = await this.authService.getCurrentUser(userId);
    return {
      success: true,
      data: user,
    };
  }

  @Post('api-keys')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new API key' })
  async generateApiKey(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const result = await this.authService.generateNewApiKey(userId);
    return {
      success: true,
      data: result,
      message: 'New API key generated. Save it - it will not be shown again!',
    };
  }
}
