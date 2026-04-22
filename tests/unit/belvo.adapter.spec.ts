import { BelvoAdapter } from '../../src/webhooks/adapters/belvo.adapter';

describe('BelvoAdapter', () => {
  let adapter: BelvoAdapter;

  beforeEach(() => {
    adapter = new BelvoAdapter();
  });

  describe('provider property', () => {
    it('should have provider name set to "belvo"', () => {
      expect(adapter.provider).toBe('belvo');
    });
  });

  describe('canHandle', () => {
    it('should return true for valid Belvo payload', () => {
      const payload = {
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: 12345,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      expect(adapter.canHandle(payload)).toBe(true);
    });

    it('should return false when notification_id is missing', () => {
      const payload = {
        account_id: 'acc-456',
        amount_cents: 12345,
      };

      expect(adapter.canHandle(payload)).toBe(false);
    });

    it('should return false when amount_cents is not a number', () => {
      const payload = {
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: '12345', // string instead of number
      };

      expect(adapter.canHandle(payload)).toBe(false);
    });

    it('should return false for null payload', () => {
      expect(adapter.canHandle(null)).toBe(false);
    });

    it('should return false for undefined payload', () => {
      expect(adapter.canHandle(undefined)).toBe(false);
    });

    it('should return false for non-object payload', () => {
      expect(adapter.canHandle('string')).toBe(false);
      expect(adapter.canHandle(123)).toBe(false);
    });
  });

  describe('normalize', () => {
    const basePayload = {
      notification_id: 'notif-123',
      account_id: 'acc-456',
      amount_cents: 12345,
      currency_code: 'BRL',
      transaction_type: 1,
      status_code: 1,
      occurred_at_epoch: 1705312200,
    };

    it('should normalize basic credit transaction', () => {
      const result = adapter.normalize(basePayload);

      expect(result).toEqual({
        externalId: 'notif-123',
        provider: 'belvo',
        accountId: 'acc-456',
        amountCents: 12345,
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: expect.any(Date),
        rawPayload: expect.any(String),
      });
    });

    it('should map transaction_type 1 to CREDIT', () => {
      const result = adapter.normalize({ ...basePayload, transaction_type: 1 });
      expect(result.type).toBe('CREDIT');
    });

    it('should map transaction_type 2 to DEBIT', () => {
      const result = adapter.normalize({ ...basePayload, transaction_type: 2 });
      expect(result.type).toBe('DEBIT');
    });

    it('should map status_code 0 to PENDING', () => {
      const result = adapter.normalize({ ...basePayload, status_code: 0 });
      expect(result.status).toBe('PENDING');
    });

    it('should map status_code 1 to POSTED', () => {
      const result = adapter.normalize({ ...basePayload, status_code: 1 });
      expect(result.status).toBe('POSTED');
    });

    it('should map status_code 2 to FAILED', () => {
      const result = adapter.normalize({ ...basePayload, status_code: 2 });
      expect(result.status).toBe('FAILED');
    });

    it('should parse epoch timestamp correctly', () => {
      const epoch = 1705312200; // 2024-01-15T10:30:00Z
      const result = adapter.normalize({ ...basePayload, occurred_at_epoch: epoch });

      // Should convert seconds to milliseconds
      expect(result.occurredAt.getTime()).toBe(epoch * 1000);
    });

    it('should handle millisecond epoch timestamps', () => {
      const epochMs = 1705312200000; // Very large number indicates milliseconds
      const result = adapter.normalize({ ...basePayload, occurred_at_epoch: epochMs });

      // Should detect milliseconds and not multiply
      expect(result.occurredAt.getTime()).toBe(epochMs);
    });

    it('should default currency to BRL if missing', () => {
      const { currency_code, ...payloadWithoutCurrency } = basePayload;
      const result = adapter.normalize(payloadWithoutCurrency as any);

      expect(result.currency).toBe('BRL');
    });

    it('should store raw payload as JSON string', () => {
      const result = adapter.normalize(basePayload);
      const parsed = JSON.parse(result.rawPayload);

      expect(parsed).toEqual(basePayload);
    });

    it('should convert all required fields to strings', () => {
      const result = adapter.normalize(basePayload);

      expect(typeof result.externalId).toBe('string');
      expect(typeof result.accountId).toBe('string');
      expect(typeof result.amountCents).toBe('number');
      expect(typeof result.currency).toBe('string');
    });

    describe('epoch vs milliseconds detection', () => {
      it('should correctly identify seconds vs milliseconds', () => {
        // A timestamp of 1000000000 = Sep 2001 (in seconds)
        const secondsTimestamp = 1000000000;
        const result1 = adapter.normalize({ ...basePayload, occurred_at_epoch: secondsTimestamp });
        expect(result1.occurredAt.getTime()).toBe(secondsTimestamp * 1000);

        // A timestamp of 10000000000 = Sep 1970 (in milliseconds)
        const millisecondsTimestamp = 10000000000;
        const result2 = adapter.normalize({ ...basePayload, occurred_at_epoch: millisecondsTimestamp });
        expect(result2.occurredAt.getTime()).toBe(millisecondsTimestamp);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle invalid amount_cents gracefully', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: NaN,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      });

      expect(result.amountCents).toBe(0);
    });

    it('should handle invalid epoch timestamp gracefully', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 'invalid' as any,
      });

      expect(result.occurredAt).toBeInstanceOf(Date);
    });

    it('should handle empty payload fields', () => {
      const result = adapter.normalize({
        notification_id: '',
        account_id: '',
        amount_cents: 0,
        currency_code: '',
        transaction_type: 0,
        status_code: 0,
        occurred_at_epoch: 0,
      });

      expect(result.externalId).toBe('');
      expect(result.accountId).toBe('');
      expect(result.amountCents).toBe(0);
    });

    it('should normalize unknown transaction_type to CREDIT', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 999, // unknown
        status_code: 1,
        occurred_at_epoch: 1705312200,
      });

      expect(result.type).toBe('CREDIT');
    });

    it('should normalize unknown status_code to PENDING', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 999, // unknown
        occurred_at_epoch: 1705312200,
      });

      expect(result.status).toBe('PENDING');
    });

    it('should handle negative amount_cents', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: -5000,
        currency_code: 'BRL',
        transaction_type: 2,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      });

      expect(result.amountCents).toBe(-5000);
    });

    it('should handle very large amount_cents', () => {
      const result = adapter.normalize({
        notification_id: 'notif-123',
        account_id: 'acc-456',
        amount_cents: 999999999,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      });

      expect(result.amountCents).toBe(999999999);
    });
  });
});