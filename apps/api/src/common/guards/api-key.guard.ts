import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Hash the API key to compare with stored hash
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');

    const user = await this.prisma.user.findUnique({
      where: { apiKey: hashedKey },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach user to request
    request.user = user;

    return true;
  }
}
