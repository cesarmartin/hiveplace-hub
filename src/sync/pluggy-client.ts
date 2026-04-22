import { ProviderClient, ProviderClientConfig } from './provider-client';

const PLUGGY_BASE_URL = process.env.PLUGGY_API_URL ?? 'http://localhost:4001';

export interface PluggyTransaction {
  eventId: string;
  accountId: string;
  amount: string;
  currency: string;
  type: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'POSTED' | 'FAILED';
  occurredAt: string;
}

export class PluggyClient extends ProviderClient {
  protected get providerName(): string {
    return 'pluggy';
  }

  constructor() {
    super({
      baseUrl: PLUGGY_BASE_URL,
      timeout: 10000,
      retries: 3,
      retryDelayMs: 1000,
    });
  }

  async fetchTransactions(accountId: string): Promise<PluggyTransaction[]> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get<{ transactions: PluggyTransaction[] }>(
        `/accounts/${accountId}/transactions`,
      );
      return response.data.transactions ?? [];
    }, 'fetchTransactions');
  }
}