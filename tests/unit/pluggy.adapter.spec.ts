import { PluggyAdapter } from '../../src/webhooks/adapters/pluggy.adapter';

describe('PluggyAdapter', () => {
  let adapter: PluggyAdapter;

  beforeEach(() => {
    adapter = new PluggyAdapter();
  });

  describe('provider property', () => {
    it('should have provider name set to "pluggy"', () => {
      expect(adapter.provider).toBe('pluggy');
    });
  });

  describe('canHandle', () => {
    it('should return true for valid Pluggy payload', () => {
      const payload = {
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '123.45',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      };

      expect(adapter.canHandle(payload)).toBe(true);
    });

    it('should return false when eventId is missing', () => {
      const payload = {
        accountId: 'acc-456',
        amount: '123.45',
      };

      expect(adapter.canHandle(payload)).toBe(false);
    });

    it('should return false when amount is not a string', () => {
      const payload = {
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: 12345, // number instead of string
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
      eventId: 'evt-123',
      accountId: 'acc-456',
      amount: '123.45',
      currency: 'BRL',
      type: 'CREDIT',
      status: 'POSTED',
      occurredAt: '2024-01-15T10:30:00Z',
    };

    it('should normalize basic credit transaction', () => {
      const result = adapter.normalize(basePayload);

      expect(result).toEqual({
        externalId: 'evt-123',
        provider: 'pluggy',
        accountId: 'acc-456',
        amountCents: 12345,
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: expect.any(Date),
        rawPayload: expect.any(String),
      });
    });

    it('should convert string amount to cents correctly', () => {
      const cases = [
        { input: '100.00', expected: 10000 },
        { input: '0.01', expected: 1 },
        { input: '999.99', expected: 99999 },
        { input: '1234.56', expected: 123456 },
      ];

      for (const { input, expected } of cases) {
        const result = adapter.normalize({ ...basePayload, amount: input });
        expect(result.amountCents).toBe(expected);
      }
    });

    it('should handle numeric amount (legacy support)', () => {
      const result = adapter.normalize({ ...basePayload, amount: 100.5 });

      expect(result.amountCents).toBe(10050);
    });

    it('should parse ISO-8601 timestamp correctly', () => {
      const isoDate = '2024-06-15T14:30:00Z';
      const result = adapter.normalize({ ...basePayload, occurredAt: isoDate });

      expect(result.occurredAt.toISOString()).toBe('2024-06-15T14:30:00.000Z');
    });

    it('should handle debits', () => {
      const result = adapter.normalize({ ...basePayload, type: 'DEBIT' });

      expect(result.type).toBe('DEBIT');
    });

    it('should normalize status values', () => {
      const statuses = ['PENDING', 'POSTED', 'FAILED'];

      for (const status of statuses) {
        const result = adapter.normalize({ ...basePayload, status });
        expect(result.status).toBe(status);
      }
    });

    it('should default currency to BRL if missing', () => {
      const { currency, ...payloadWithoutCurrency } = basePayload;
      const result = adapter.normalize(payloadWithoutCurrency);

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
  });

  describe('edge cases', () => {
    it('should handle invalid amount string gracefully', () => {
      const payload = {
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: 'invalid',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      };

      const result = adapter.normalize(payload);

      expect(result.amountCents).toBe(0); // parseFloat('invalid') = NaN → 0
    });

    it('should handle empty amount string', () => {
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      });

      expect(result.amountCents).toBe(0);
    });

    it('should handle invalid timestamp gracefully', () => {
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '100.00',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: 'invalid-date',
      });

      expect(result.occurredAt).toBeInstanceOf(Date);
    });

    it('should handle missing timestamp by defaulting to current date', () => {
      const before = new Date();
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '100.00',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '',
      });
      const after = new Date();

      expect(result.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should normalize unknown type to CREDIT', () => {
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '100.00',
        currency: 'BRL',
        type: 'UNKNOWN',
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      });

      expect(result.type).toBe('CREDIT');
    });

    it('should normalize unknown status to PENDING', () => {
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '100.00',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'UNKNOWN_STATUS',
        occurredAt: '2024-01-15T10:30:00Z',
      });

      expect(result.status).toBe('PENDING');
    });

    it('should handle numeric type value', () => {
      const result = adapter.normalize({
        eventId: 'evt-123',
        accountId: 'acc-456',
        amount: '100.00',
        currency: 'BRL',
        type: 1, // numeric
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      });

      expect(result.type).toBe('CREDIT');
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve cents precision for typical values', () => {
      const typicalAmounts = ['10.00', '99.99', '1000.00', '0.01'];

      for (const amount of typicalAmounts) {
        const result = adapter.normalize({
          eventId: 'evt-123',
          accountId: 'acc-456',
          amount,
          currency: 'BRL',
          type: 'CREDIT',
          status: 'POSTED',
          occurredAt: '2024-01-15T10:30:00Z',
        });

        const expected = Math.round(parseFloat(amount) * 100);
        expect(result.amountCents).toBe(expected);
      }
    });
  });
});