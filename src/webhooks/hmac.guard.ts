import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Validates webhook authenticity via HMAC-SHA256 of the raw body.
 *
 * The provider is expected to send `x-signature: sha256=<hex>`.
 * Each provider has its own secret, resolved from env based on the route param.
 *
 * NOTE: requires raw body to be available on req — see main.ts / controller setup.
 */
@Injectable()
export class HmacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provider = req.params?.provider as string | undefined;
    if (!provider) throw new UnauthorizedException('missing provider');

    const secret = resolveSecret(provider);
    if (!secret) throw new UnauthorizedException('unknown provider');

    const header = (req.headers['x-signature'] ?? '') as string;
    const received = header.startsWith('sha256=') ? header.slice(7) : header;
    if (!received) throw new UnauthorizedException('missing signature');

    const rawBody: Buffer | undefined = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('missing raw body');

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    // timingSafeEqual requires equal-length buffers
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid signature');
    }

    return true;
  }
}

function resolveSecret(provider: string): string | undefined {
  switch (provider.toLowerCase()) {
    case 'pluggy':
      return process.env.PLUGGY_WEBHOOK_SECRET;
    case 'belvo':
      return process.env.BELVO_WEBHOOK_SECRET;
    default:
      return undefined;
  }
}
