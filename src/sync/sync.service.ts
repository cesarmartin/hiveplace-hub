import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdapterRegistry } from '../webhooks/adapters/adapter.registry';
import { CanonicalTransaction } from '../webhooks/adapters/provider-adapter.interface';
import { PluggyClient } from './pluggy-client';
import { BelvoClient } from './belvo-client';
import { CircuitBreakerWrapper } from './circuit-breaker';
import { transactionsPersistedCounter } from '../common/metrics/metrics.controller';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  private readonly pluggyClient: PluggyClient;
  private readonly belvoClient: BelvoClient;
  private readonly pluggyCircuit: CircuitBreakerWrapper;
  private readonly belvoCircuit: CircuitBreakerWrapper;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: AdapterRegistry,
  ) {
    this.pluggyClient = new PluggyClient();
    this.belvoClient = new BelvoClient();

    // Circuit breakers per provider with different thresholds based on provider behavior
    this.pluggyCircuit = new CircuitBreakerWrapper('pluggy', {
      timeout: 10000,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
    });

    this.belvoCircuit = new CircuitBreakerWrapper('belvo', {
      timeout: 10000,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
    });
  }

  async syncAccount(accountId: string, provider: string): Promise<{ synced: number; failed: number }> {
    this.logger.log({ accountId, provider }, 'starting sync');

    const client = provider === 'belvo' ? this.belvoClient : this.pluggyClient;
    const circuit = provider === 'belvo' ? this.belvoCircuit : this.pluggyCircuit;
    const adapter = this.adapters.getAdapter(provider);

    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${provider}`);
    }

    // Fetch transactions through circuit breaker
    let transactions: any[];
    try {
      transactions = await circuit.fire(() => client.fetchTransactions(accountId) as Promise<any>);
    } catch (err: any) {
      this.logger.error({ accountId, provider, error: err?.message }, 'sync failed - circuit breaker open or request failed');
      throw err;
    }

    this.logger.debug({ accountId, provider, count: transactions.length }, 'fetched transactions');

    let synced = 0;
    let failed = 0;

    for (const rawTx of transactions) {
      try {
        await this.processTransaction(provider, adapter, rawTx);
        synced++;
      } catch (err: any) {
        this.logger.warn({ accountId, provider, externalId: rawTx.eventId ?? rawTx.notification_id, error: err?.message }, 'failed to sync transaction');
        failed++;
      }
    }

    this.logger.log({ accountId, provider, synced, failed }, 'sync completed');
    return { synced, failed };
  }

  private async processTransaction(
    provider: string,
    adapter: any,
    rawTx: any,
  ): Promise<void> {
    // Normalize to canonical
    const canonical = adapter.normalize(rawTx);

    // Try to create (idempotent via unique constraint)
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
      transactionsPersistedCounter.inc({ provider });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.debug({ externalId: canonical.externalId }, 'transaction already exists - skipping');
        return; // Already synced
      }
      throw err;
    }
  }
}