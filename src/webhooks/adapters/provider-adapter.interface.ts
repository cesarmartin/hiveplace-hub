/**
 * Canonical transaction model for the integration hub.
 * All provider adapters must normalize to this contract.
 */
export interface CanonicalTransaction {
  externalId: string;
  provider: string;
  accountId: string;
  amountCents: number;
  currency: string;
  type: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'POSTED' | 'FAILED';
  occurredAt: Date;
  rawPayload: string;
}

/**
 * Provider adapter interface.
 * Each webhook provider must implement this to normalize its payload.
 */
export interface ProviderAdapter {
  provider: string;
  normalize(rawPayload: any): CanonicalTransaction;
  canHandle(payload: any): boolean;
}