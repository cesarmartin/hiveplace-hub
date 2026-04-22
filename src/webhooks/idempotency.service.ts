import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Idempotency ledger backed by a UNIQUE key in SQLite.
 *
 * Contract: `reserve()` returns true if this is the first time we see the key,
 * false if the key was already claimed (duplicate delivery).
 *
 * Using the DB as the source of truth makes this safe across restarts.
 * In a multi-instance deployment you'd move this to Redis with SETNX + TTL.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(provider: string, eventId: string): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    try {
      await this.prisma.idempotencyKey.create({ data: { key } });
      return true;
    } catch (err: any) {
      // Prisma unique constraint violation on SQLite → duplicate.
      if (err?.code === 'P2002') return false;
      throw err;
    }
  }
}
