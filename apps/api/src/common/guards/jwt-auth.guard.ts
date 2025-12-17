import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    // Try API Key authentication first
    if (apiKey) {
      try {
        const hashedKey = createHash('sha256').update(apiKey).digest('hex');
        const user = await this.prisma.user.findUnique({
          where: { apiKey: hashedKey },
        });

        if (user && user.isActive) {
          request.user = { id: user.id, email: user.email };
          return true;
        }
      } catch (error) {
        // Fall through to JWT authentication
      }
    }

    // Fall back to JWT authentication
    const result = await super.canActivate(context);
    return result as boolean;
  }
}
