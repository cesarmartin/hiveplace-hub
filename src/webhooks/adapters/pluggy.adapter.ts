/**
 * Pluggy adapter - handles camelCase payloads with string amounts and ISO dates.
 *
 * Pluggy contract:
 *   - camelCase field names
 *   - amount as STRING with decimal point: "123.45"
 *   - timestamps as ISO-8601 strings
 *   - type enum: "CREDIT" | "DEBIT"
 *   - status enum: "PENDING" | "POSTED" | "FAILED"
 *   - event id field: "eventId"
 */
import { CanonicalTransaction, ProviderAdapter } from './provider-adapter.interface';

export class PluggyAdapter implements ProviderAdapter {
  readonly provider = 'pluggy';

  /**
   * Checks if this adapter can handle the given payload.
   * Pluggy payloads have eventId (camelCase) and string amount.
   */
  canHandle(payload: any): boolean {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'eventId' in payload &&
      'amount' in payload &&
      typeof payload.amount === 'string'
    );
  }

  /**
   * Normalizes a Pluggy webhook payload to the canonical transaction model.
   */
  normalize(rawPayload: any): CanonicalTransaction {
    const amountCents = this.convertAmountToCents(rawPayload.amount);
    const occurredAt = this.parseTimestamp(rawPayload.occurredAt);

    return {
      externalId: String(rawPayload.eventId),
      provider: this.provider,
      accountId: String(rawPayload.accountId),
      amountCents,
      currency: rawPayload.currency ?? 'BRL',
      type: this.normalizeType(rawPayload.type),
      status: this.normalizeStatus(rawPayload.status),
      occurredAt,
      rawPayload: JSON.stringify(rawPayload),
    };
  }

  /**
   * Converts a string amount like "123.45" to cents (12345).
   * Handles invalid inputs by returning 0.
   */
  private convertAmountToCents(amount: string | number): number {
    if (typeof amount === 'number') {
      return Math.round(amount * 100);
    }
    if (typeof amount !== 'string') {
      return 0;
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      return 0;
    }
    return Math.round(parsed * 100);
  }

  /**
   * Parses ISO-8601 timestamp strings to Date objects.
   * Returns current date if parsing fails.
   */
  private parseTimestamp(timestamp: string | number | Date): Date {
    if (!timestamp) {
      return new Date();
    }
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  /**
   * Normalizes type field to canonical CREDIT/DEBIT enum.
   */
  private normalizeType(type: string): 'CREDIT' | 'DEBIT' {
    const upper = String(type).toUpperCase();
    if (upper === 'CREDIT' || upper === 'DEBIT') {
      return upper as 'CREDIT' | 'DEBIT';
    }
    return 'CREDIT'; // default
  }

  /**
   * Normalizes status field to canonical PENDING/POSTED/FAILED enum.
   */
  private normalizeStatus(status: string): 'PENDING' | 'POSTED' | 'FAILED' {
    const upper = String(status).toUpperCase();
    if (upper === 'PENDING' || upper === 'POSTED' || upper === 'FAILED') {
      return upper as 'PENDING' | 'POSTED' | 'FAILED';
    }
    return 'PENDING'; // default
  }
}