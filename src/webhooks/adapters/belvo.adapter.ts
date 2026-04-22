/**
 * Belvo adapter - handles snake_case payloads with integer cents and epoch timestamps.
 *
 * Belvo contract:
 *   - snake_case field names
 *   - amount as INTEGER in cents: 12345
 *   - timestamps as Unix epoch seconds
 *   - transaction_type as NUMERIC code: 1 = inflow (credit), 2 = outflow (debit)
 *   - status_code as NUMERIC: 0 = pending, 1 = posted, 2 = failed
 *   - event id field: "notification_id"
 */
import { CanonicalTransaction, ProviderAdapter } from './provider-adapter.interface';

export class BelvoAdapter implements ProviderAdapter {
  readonly provider = 'belvo';

  /**
   * Checks if this adapter can handle the given payload.
   * Belvo payloads have notification_id (snake_case) and amount_cents as integer.
   */
  canHandle(payload: any): boolean {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'notification_id' in payload &&
      'amount_cents' in payload &&
      typeof payload.amount_cents === 'number'
    );
  }

  /**
   * Normalizes a Belvo webhook payload to the canonical transaction model.
   */
  normalize(rawPayload: any): CanonicalTransaction {
    const amountCents = this.convertAmountToCents(rawPayload.amount_cents);
    const occurredAt = this.parseTimestamp(rawPayload.occurred_at_epoch);

    return {
      externalId: String(rawPayload.notification_id),
      provider: this.provider,
      accountId: String(rawPayload.account_id),
      amountCents,
      currency: rawPayload.currency_code ?? 'BRL',
      type: this.normalizeType(rawPayload.transaction_type),
      status: this.normalizeStatus(rawPayload.status_code),
      occurredAt,
      rawPayload: JSON.stringify(rawPayload),
    };
  }

  /**
   * Converts amount in cents to integer.
   * Belvo sends amount already in cents, so we just ensure it's an integer.
   */
  private convertAmountToCents(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return 0;
    }
    return Math.round(amount);
  }

  /**
   * Parses Unix epoch seconds to Date object.
   * Handles timestamps as seconds or milliseconds.
   * Uses >= 10 trillion (10000000000) as threshold for millisecond detection.
   * This covers dates from year 1970 (seconds) to year 2001 (seconds) / 1970 (ms).
   */
  private parseTimestamp(timestamp: string | number | Date): Date {
    if (!timestamp) {
      return new Date();
    }

    // If it's already a Date object
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? new Date() : timestamp;
    }

    // If it's a number, check if it appears to be milliseconds
    // Threshold: >= 10 trillion (10000000000) indicates milliseconds
    // This means: seconds cover up to year 2001, milliseconds cover year 1970+
    const num = Number(timestamp);
    if (isNaN(num)) {
      return new Date();
    }

    // If the number is >= 10 trillion, it's likely milliseconds
    // Otherwise, treat as seconds
    const isMilliseconds = num >= 10000000000;
    const date = new Date(isMilliseconds ? num : num * 1000);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  /**
   * Normalizes transaction_type code to canonical CREDIT/DEBIT enum.
   * 1 = inflow (credit), 2 = outflow (debit)
   */
  private normalizeType(transactionType: number): 'CREDIT' | 'DEBIT' {
    if (transactionType === 1) {
      return 'CREDIT';
    }
    if (transactionType === 2) {
      return 'DEBIT';
    }
    return 'CREDIT'; // default
  }

  /**
   * Normalizes status_code to canonical PENDING/POSTED/FAILED enum.
   * 0 = pending, 1 = posted, 2 = failed
   */
  private normalizeStatus(statusCode: number): 'PENDING' | 'POSTED' | 'FAILED' {
    if (statusCode === 0) {
      return 'PENDING';
    }
    if (statusCode === 1) {
      return 'POSTED';
    }
    if (statusCode === 2) {
      return 'FAILED';
    }
    return 'PENDING'; // default
  }
}