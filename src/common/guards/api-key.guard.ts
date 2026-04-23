import {
  Injectable,
  CanActivate,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Guard that validates the x-api-key header against the configured API_KEY.
 * Uses timing-safe comparison to prevent timing attacks.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = this.configService.get<string>('API_KEY');

    if (!apiKey) {
      throw new UnauthorizedException('API key not configured');
    }

    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-api-key'];

    if (!providedKey) {
      throw new UnauthorizedException('Missing API key');
    }

    if (!this.timingSafeEqual(apiKey, providedKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // To prevent timing attacks, we still do a comparison
      // but it will always fail for different lengths
      const dummy = Buffer.alloc(a.length);
      crypto.timingSafeEqual(dummy, Buffer.from(a));
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}