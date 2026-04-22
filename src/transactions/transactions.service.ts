import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ListTransactionsDto } from './list-transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTransactionsDto): Promise<{
    data: any[];
    nextCursor: string | null;
    total: number;
  }> {
    const { provider, accountId, status, cursor, limit = 20 } = query;

    // Enforce max limit
    const safeLimit = Math.min(limit ?? 20, 100);

    // Build where clause
    const where: any = {};
    if (provider) where.provider = provider;
    if (accountId) where.accountId = accountId;
    if (status) where.status = status;

    // Decode cursor (format: base64 encoded JSON with { id, occurredAt })
    let cursorObj: { id: string; occurredAt: Date } | undefined;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        cursorObj = JSON.parse(decoded);
        // Add to where clause
        if (cursorObj) {
          where.OR = [
            { occurredAt: { gt: cursorObj.occurredAt } },
            {
              occurredAt: cursorObj.occurredAt,
              id: { gt: cursorObj.id },
            },
          ];
        }
      } catch (err: any) {
        throw new BadRequestException('Invalid cursor format');
      }
    }

    // Query with pagination
    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1, // Fetch one extra to check if there's a next page
    });

    // Check if there are more results
    const hasMore = transactions.length > safeLimit;
    const data = hasMore ? transactions.slice(0, safeLimit) : transactions;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ id: data[data.length - 1].id, occurredAt: data[data.length - 1].occurredAt })).toString('base64')
      : null;

    // Get total count for info
    const total = await this.prisma.transaction.count({ where });

    return { data, nextCursor, total };
  }

  async getOne(id: string): Promise<any> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    return transaction;
  }
}