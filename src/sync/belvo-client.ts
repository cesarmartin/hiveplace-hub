import { ProviderClient, ProviderClientConfig } from './provider-client';

const BELVO_BASE_URL = process.env.BELVO_API_URL ?? 'http://localhost:4002';

export interface BelvoTransaction {
  notification_id: string;
  account_id: string;
  amount_cents: number;
  currency_code: string;
  transaction_type: number;
  status_code: number;
  occurred_at_epoch: number;
}

export class BelvoClient extends ProviderClient {
  protected get providerName(): string {
    return 'belvo';
  }

  constructor() {
    super({
      baseUrl: BELVO_BASE_URL,
      timeout: 10000,
      retries: 3,
      retryDelayMs: 1000,
    });
  }

  async fetchTransactions(accountId: string): Promise<BelvoTransaction[]> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get<{ transactions: BelvoTransaction[] }>(
        `/accounts/${accountId}/transactions`,
      );
      return response.data.transactions ?? [];
    }, 'fetchTransactions');
  }
}