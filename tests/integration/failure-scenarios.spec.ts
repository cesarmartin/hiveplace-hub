import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from '../../src/webhooks/webhooks.controller';
import { IdempotencyService } from '../../src/webhooks/idempotency.service';
import { PluggyAdapter } from '../../src/webhooks/adapters/pluggy.adapter';
import { BelvoAdapter } from '../../src/webhooks/adapters/belvo.adapter';
import { InMemoryQueue } from '../../src/queue/in-memory.queue';
import { NormalizationJob } from '../../src/queue/queue.module';

/**
 * Failure scenario tests simulating real-world edge cases:
 * - Incomplete payloads
 * - Invalid data handling
 * - Edge cases in adapter normalization
 */
describe('Failure Scenarios Unit', () => {
  let controller: WebhooksController;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let pluggyAdapter: PluggyAdapter;
  let belvoAdapter: BelvoAdapter;
  let mockQueue: InMemoryQueue<NormalizationJob>;

  beforeEach(async () => {
    const mockIdempotencyService = {
      reserve: jest.fn(),
      release: jest.fn(),
    };

    mockQueue = new InMemoryQueue<NormalizationJob>({ maxSize: 1000 });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: InMemoryQueue,
          useValue: mockQueue,
        },
        PluggyAdapter,
        BelvoAdapter,
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    idempotencyService = module.get(IdempotencyService);
    pluggyAdapter = module.get<PluggyAdapter>(PluggyAdapter);
    belvoAdapter = module.get<BelvoAdapter>(BelvoAdapter);
  });

  describe('Incomplete payloads', () => {
    it('should accept webhook with only required fields', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const minimalPayload = { eventId: 'minimal-' + Date.now() };

      const result = await controller.receive('pluggy', minimalPayload);

      expect(result.status).toBe('accepted');
    });

    it('should accept webhook with missing optional fields', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const payloadWithMissingOptional = {
        eventId: 'missing-optional-' + Date.now(),
        amount: '100.00',
        // missing currency, type, status, occurredAt
      };

      const result = await controller.receive('pluggy', payloadWithMissingOptional);

      expect(result.status).toBe('accepted');
    });

    it('should handle payload with null values via adapter', () => {
      const payloadWithNulls = {
        eventId: 'null-values-' + Date.now(),
        accountId: null,
        amount: null,
      };

      const canonical = pluggyAdapter.normalize(payloadWithNulls);

      expect(canonical.externalId).toBe(payloadWithNulls.eventId);
      expect(canonical.accountId).toBe('null'); // String(null)
    });

    it('should handle payload with undefined values via adapter', () => {
      const payloadWithUndefined = {
        eventId: 'undefined-values-' + Date.now(),
        accountId: undefined,
        amount: undefined,
      };

      const canonical = pluggyAdapter.normalize(payloadWithUndefined);

      expect(canonical.externalId).toBe(payloadWithUndefined.eventId);
      expect(canonical.amountCents).toBe(0); // undefined converts to 0
    });
  });

  describe('Invalid data handling in adapters', () => {
    it('should handle invalid amount string gracefully', () => {
      const invalidPayload = {
        eventId: 'invalid-amount',
        accountId: 'acc-1',
        amount: 'not-a-number',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-01T00:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(invalidPayload);

      expect(canonical.amountCents).toBe(0); // parseFloat returns NaN → 0
    });

    it('should handle empty amount string', () => {
      const emptyAmountPayload = {
        eventId: 'empty-amount',
        accountId: 'acc-1',
        amount: '',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-01T00:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(emptyAmountPayload);

      expect(canonical.amountCents).toBe(0);
    });

    it('should handle invalid timestamp gracefully', () => {
      const invalidTimestampPayload = {
        eventId: 'invalid-timestamp',
        accountId: 'acc-1',
        amount: '100.00',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: 'invalid-date',
      };

      const canonical = pluggyAdapter.normalize(invalidTimestampPayload);

      expect(canonical.occurredAt).toBeInstanceOf(Date);
    });

    it('should normalize unknown type to CREDIT', () => {
      const unknownTypePayload = {
        eventId: 'unknown-type',
        accountId: 'acc-1',
        amount: '100.00',
        currency: 'BRL',
        type: 'UNKNOWN_TYPE',
        status: 'POSTED',
        occurredAt: '2024-01-01T00:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(unknownTypePayload);

      expect(canonical.type).toBe('CREDIT');
    });

    it('should normalize unknown status to PENDING', () => {
      const unknownStatusPayload = {
        eventId: 'unknown-status',
        accountId: 'acc-1',
        amount: '100.00',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'UNKNOWN_STATUS',
        occurredAt: '2024-01-01T00:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(unknownStatusPayload);

      expect(canonical.status).toBe('PENDING');
    });

    it('should handle numeric type value', () => {
      const numericTypePayload = {
        eventId: 'numeric-type',
        accountId: 'acc-1',
        amount: '100.00',
        currency: 'BRL',
        type: 1, // numeric value
        status: 'POSTED',
        occurredAt: '2024-01-01T00:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(numericTypePayload);

      expect(canonical.type).toBe('CREDIT');
    });
  });

  describe('Edge cases in Belvo adapter', () => {
    it('should handle invalid amount_cents gracefully', () => {
      const invalidPayload = {
        notification_id: 'invalid-amount',
        account_id: 'acc-1',
        amount_cents: NaN,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      const canonical = belvoAdapter.normalize(invalidPayload);

      expect(canonical.amountCents).toBe(0);
    });

    it('should handle invalid epoch timestamp gracefully', () => {
      const invalidTimestampPayload = {
        notification_id: 'invalid-epoch',
        account_id: 'acc-1',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 'invalid' as any,
      };

      const canonical = belvoAdapter.normalize(invalidTimestampPayload);

      expect(canonical.occurredAt).toBeInstanceOf(Date);
    });

    it('should handle empty payload fields', () => {
      const emptyPayload = {
        notification_id: '',
        account_id: '',
        amount_cents: 0,
        currency_code: '',
        transaction_type: 0,
        status_code: 0,
        occurred_at_epoch: 0,
      };

      const canonical = belvoAdapter.normalize(emptyPayload);

      expect(canonical.externalId).toBe('');
      expect(canonical.accountId).toBe('');
      expect(canonical.amountCents).toBe(0);
    });

    it('should normalize unknown transaction_type to CREDIT', () => {
      const unknownTypePayload = {
        notification_id: 'unknown-type',
        account_id: 'acc-1',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 999,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      const canonical = belvoAdapter.normalize(unknownTypePayload);

      expect(canonical.type).toBe('CREDIT');
    });

    it('should normalize unknown status_code to PENDING', () => {
      const unknownStatusPayload = {
        notification_id: 'unknown-status',
        account_id: 'acc-1',
        amount_cents: 10000,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 999,
        occurred_at_epoch: 1705312200,
      };

      const canonical = belvoAdapter.normalize(unknownStatusPayload);

      expect(canonical.status).toBe('PENDING');
    });

    it('should handle negative amount_cents', () => {
      const negativeAmountPayload = {
        notification_id: 'negative-amount',
        account_id: 'acc-1',
        amount_cents: -5000,
        currency_code: 'BRL',
        transaction_type: 2,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      const canonical = belvoAdapter.normalize(negativeAmountPayload);

      expect(canonical.amountCents).toBe(-5000);
    });
  });

  describe('Special characters and edge values', () => {
    it('should handle special characters in eventId', () => {
      const specialCharsPayload = {
        eventId: 'evt-with-special-chars-äöü-你好-🎉',
        accountId: 'acc-1',
        amount: '10.00',
      };

      const canonical = pluggyAdapter.normalize(specialCharsPayload);

      expect(canonical.externalId).toBe(specialCharsPayload.eventId);
    });

    it('should handle very long eventId', () => {
      const longEventId = 'a'.repeat(10000);
      const longPayload = {
        eventId: longEventId,
        accountId: 'acc-1',
        amount: '10.00',
      };

      const canonical = pluggyAdapter.normalize(longPayload);

      expect(canonical.externalId).toBe(longEventId);
    });

    it('should handle very large amount_cents', () => {
      const largeAmountPayload = {
        notification_id: 'large-amount',
        account_id: 'acc-1',
        amount_cents: 999999999,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      const canonical = belvoAdapter.normalize(largeAmountPayload);

      expect(canonical.amountCents).toBe(999999999);
    });
  });

  describe('Timestamp detection edge cases', () => {
    it('should correctly identify seconds vs milliseconds', () => {
      // A timestamp of 1000000000 = Sep 2001 (in seconds)
      const secondsTimestamp = 1000000000;
      const result1 = belvoAdapter.normalize({
        notification_id: 'sec',
        account_id: 'acc',
        amount_cents: 100,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: secondsTimestamp,
      });
      expect(result1.occurredAt.getTime()).toBe(secondsTimestamp * 1000);

      // A timestamp of 10000000000 = Sep 1970 (in milliseconds)
      const millisecondsTimestamp = 10000000000;
      const result2 = belvoAdapter.normalize({
        notification_id: 'ms',
        account_id: 'acc',
        amount_cents: 100,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: millisecondsTimestamp,
      });
      expect(result2.occurredAt.getTime()).toBe(millisecondsTimestamp);
    });
  });

  describe('Idempotency edge cases', () => {
    it('should handle empty string eventId as missing', async () => {
      const body = { eventId: '', amount: '100.00' };

      const result = await controller.receive('pluggy', body);

      expect(result.status).toBe('accepted');
      expect(result.note).toBe('missing event id');
    });

    it('should handle whitespace-only eventId as valid', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = { eventId: '   ', amount: '100.00' };

      const result = await controller.receive('pluggy', body);

      expect(result.eventId).toBe('   ');
    });

    it('should handle numeric eventId', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = { eventId: 12345, amount: '100.00' };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', '12345');
    });
  });

  describe('Null body handling', () => {
    it('should handle null body gracefully', async () => {
      const result = await controller.receive('pluggy', null);

      expect(result.status).toBe('accepted');
    });

    it('should handle undefined body gracefully', async () => {
      const result = await controller.receive('pluggy', undefined);

      expect(result.status).toBe('accepted');
    });

    it('should handle non-object body', async () => {
      const result = await controller.receive('pluggy', 'string-body' as any);

      expect(result.status).toBe('accepted');
    });
  });
});