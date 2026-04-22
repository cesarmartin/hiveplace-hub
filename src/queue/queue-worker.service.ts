import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdapterRegistry } from '../webhooks/adapters/adapter.registry';
import { CanonicalTransaction } from '../webhooks/adapters/provider-adapter.interface';
import { InMemoryQueue, QueueJob } from './in-memory.queue';
import { transactionsPersistedCounter } from '../common/metrics/metrics.controller';
import { NormalizationJob } from './queue.module';
import { IdempotencyService } from '../webhooks/idempotency.service';

@Injectable()
export class QueueWorkerService implements OnModuleInit {
  private readonly logger = new Logger(QueueWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: AdapterRegistry,
    private readonly queue: InMemoryQueue,
    private readonly idem: IdempotencyService,
  ) {}

  onModuleInit() {
    this.queue.registerHandler(this.processJob.bind(this));
    this.logger.log('queue worker registered');
  }

  private async processJob(job: QueueJob<NormalizationJob>): Promise<void> {
    const { provider, rawPayload, eventId } = job.data;
    this.logger.debug({ jobId: job.id, provider, eventId }, 'processing normalization job');

    // Get the appropriate adapter
    const adapter = this.adapters.getAdapter(provider);
    if (!adapter) {
      // Permanent failure - release idempotency key
      await this.idem.release(provider, eventId);
      throw new Error(`No adapter registered for provider: ${provider}`);
    }

    // Parse the raw payload
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (err: any) {
      // Permanent failure - release idempotency key
      await this.idem.release(provider, eventId);
      this.logger.error({ jobId: job.id, error: err?.message }, 'failed to parse raw payload');
      throw new Error(`Invalid JSON payload: ${err?.message}`);
    }

    // Normalize using the adapter
    let canonical: CanonicalTransaction;
    try {
      canonical = adapter.normalize(parsedPayload);
    } catch (err: any) {
      // Permanent failure - release idempotency key
      await this.idem.release(provider, eventId);
      this.logger.error({ jobId: job.id, error: err?.message }, 'adapter normalization failed');
      throw new Error(`Normalization failed: ${err?.message}`);
    }

    // Persist the canonical transaction
    try {
      await this.prisma.transaction.create({
        data: {
          externalId: canonical.externalId,
          provider: canonical.provider,
          accountId: canonical.accountId,
          amountCents: canonical.amountCents,
          currency: canonical.currency,
          type: canonical.type,
          status: canonical.status,
          occurredAt: canonical.occurredAt,
          rawPayload: canonical.rawPayload,
        },
      });
      transactionsPersistedCounter.inc({ provider: canonical.provider });
      this.logger.debug({ jobId: job.id, transactionId: canonical.externalId }, 'transaction persisted');
    } catch (err: any) {
      // Check if it's a unique constraint violation (duplicate)
      if (err?.code === 'P2002') {
        this.logger.debug({ jobId: job.id, externalId: canonical.externalId }, 'duplicate transaction — skipping');
        return; // Don't retry duplicates, but keep idempotency key (already processed)
      }
      // Permanent failure - release idempotency key for retry
      await this.idem.release(provider, eventId);
      throw err;
    }
  }
}