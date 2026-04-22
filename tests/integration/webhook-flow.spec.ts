import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from '../../src/webhooks/webhooks.controller';
import { IdempotencyService } from '../../src/webhooks/idempotency.service';
import { HmacGuard } from '../../src/webhooks/hmac.guard';
import { PluggyAdapter } from '../../src/webhooks/adapters/pluggy.adapter';
import { BelvoAdapter } from '../../src/webhooks/adapters/belvo.adapter';
import { InMemoryQueue } from '../../src/queue/in-memory.queue';
import { NormalizationJob } from '../../src/queue/queue.module';

/**
 * Integration tests for the webhook flow with mocked adapters.
 * These tests verify the complete flow from controller through adapters
 * to the canonical transaction model.
 */
describe('Webhook Flow Integration', () => {
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

  describe('Pluggy adapter integration', () => {
    it('should normalize Pluggy payload to canonical model', () => {
      const pluggyPayload = {
        eventId: 'pluggy-evt-123',
        accountId: 'acc-456',
        amount: '150.75',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-01-15T10:30:00Z',
      };

      expect(pluggyAdapter.canHandle(pluggyPayload)).toBe(true);

      const canonical = pluggyAdapter.normalize(pluggyPayload);

      expect(canonical).toEqual({
        externalId: 'pluggy-evt-123',
        provider: 'pluggy',
        accountId: 'acc-456',
        amountCents: 15075,
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: expect.any(Date),
        rawPayload: JSON.stringify(pluggyPayload),
      });
    });

    it('should handle Pluggy debit transaction', () => {
      const pluggyDebit = {
        eventId: 'pluggy-debit-123',
        accountId: 'acc-789',
        amount: '99.50',
        currency: 'USD',
        type: 'DEBIT',
        status: 'PENDING',
        occurredAt: '2024-02-20T15:45:00Z',
      };

      const canonical = pluggyAdapter.normalize(pluggyDebit);

      expect(canonical.type).toBe('DEBIT');
      expect(canonical.amountCents).toBe(9950);
      expect(canonical.currency).toBe('USD');
    });
  });

  describe('Belvo adapter integration', () => {
    it('should normalize Belvo payload to canonical model', () => {
      const belvoPayload = {
        notification_id: 'belvo-notif-456',
        account_id: 'acc-789',
        amount_cents: 25000,
        currency_code: 'BRL',
        transaction_type: 1,
        status_code: 1,
        occurred_at_epoch: 1705312200,
      };

      expect(belvoAdapter.canHandle(belvoPayload)).toBe(true);

      const canonical = belvoAdapter.normalize(belvoPayload);

      expect(canonical).toEqual({
        externalId: 'belvo-notif-456',
        provider: 'belvo',
        accountId: 'acc-789',
        amountCents: 25000,
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: expect.any(Date),
        rawPayload: JSON.stringify(belvoPayload),
      });
    });

    it('should handle Belvo debit transaction (type 2)', () => {
      const belvoDebit = {
        notification_id: 'belvo-debit-123',
        account_id: 'acc-111',
        amount_cents: 15000,
        currency_code: 'USD',
        transaction_type: 2,
        status_code: 0,
        occurred_at_epoch: 1705398600,
      };

      const canonical = belvoAdapter.normalize(belvoDebit);

      expect(canonical.type).toBe('DEBIT');
      expect(canonical.amountCents).toBe(15000);
      expect(canonical.status).toBe('PENDING');
    });
  });

  describe('Idempotency integration with webhook controller', () => {
    it('should accept fresh webhook and reserve idempotency key', async () => {
      idempotencyService.reserve.mockResolvedValue(true);

      const pluggyPayload = { eventId: 'new-evt', amount: '100.00' };
      const result = await controller.receive('pluggy', pluggyPayload);

      expect(result.status).toBe('accepted');
      expect(result.eventId).toBe('new-evt');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'new-evt');
    });

    it('should mark duplicate webhook as such', async () => {
      idempotencyService.reserve.mockResolvedValue(false);

      const pluggyPayload = { eventId: 'dup-evt', amount: '100.00' };
      const result = await controller.receive('pluggy', pluggyPayload);

      expect(result.status).toBe('accepted');
      expect(result.duplicate).toBe(true);
    });

    it('should handle Belvo notification_id for idempotency', async () => {
      idempotencyService.reserve.mockResolvedValue(true);

      const belvoPayload = { notification_id: 'belvo-123', amount_cents: 5000 };
      const result = await controller.receive('belvo', belvoPayload);

      expect(result.eventId).toBe('belvo-123');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('belvo', 'belvo-123');
    });
  });

  describe('End-to-end canonical transformation', () => {
    it('should transform Pluggy camelCase to canonical model', () => {
      const pluggyPayload = {
        eventId: 'evt-pluggy-001',
        accountId: 'acc-pluggy-001',
        amount: '1234.56',
        currency: 'BRL',
        type: 'CREDIT',
        status: 'POSTED',
        occurredAt: '2024-03-01T12:00:00Z',
      };

      const canonical = pluggyAdapter.normalize(pluggyPayload);

      // Verify all fields are properly transformed
      expect(canonical.provider).toBe('pluggy');
      expect(canonical.amountCents).toBe(123456);
      expect(canonical.type).toBe('CREDIT');
      expect(canonical.status).toBe('POSTED');
      expect(canonical.rawPayload).toContain('"eventId":"evt-pluggy-001"');
    });

    it('should transform Belvo snake_case to canonical model', () => {
      const belvoPayload = {
        notification_id: 'evt-belvo-001',
        account_id: 'acc-belvo-001',
        amount_cents: 99999,
        currency_code: 'USD',
        transaction_type: 2,
        status_code: 2,
        occurred_at_epoch: 1709200000,
      };

      const canonical = belvoAdapter.normalize(belvoPayload);

      // Verify all fields are properly transformed
      expect(canonical.provider).toBe('belvo');
      expect(canonical.amountCents).toBe(99999);
      expect(canonical.type).toBe('DEBIT');
      expect(canonical.status).toBe('FAILED');
      expect(canonical.rawPayload).toContain('"notification_id":"evt-belvo-001"');
    });

    it('should store raw payload for audit trail', () => {
      const originalPayload = {
        eventId: 'audit-test',
        accountId: 'acc-audit',
        amount: '500.00',
        customField: 'custom-value',
      };

      const canonical = pluggyAdapter.normalize(originalPayload);
      const storedPayload = JSON.parse(canonical.rawPayload);

      expect(storedPayload.eventId).toBe('audit-test');
      expect(storedPayload.customField).toBe('custom-value');
    });
  });

  describe('Mixed provider scenarios', () => {
    it('should handle multiple providers independently', () => {
      const pluggyPayload = { eventId: 'p1', amount: '10.00' };
      const belvoPayload = { notification_id: 'b1', amount_cents: 1000 };

      const pluggyCanonical = pluggyAdapter.normalize(pluggyPayload);
      const belvoCanonical = belvoAdapter.normalize(belvoPayload);

      expect(pluggyCanonical.provider).toBe('pluggy');
      expect(belvoCanonical.provider).toBe('belvo');
      expect(pluggyCanonical.amountCents).toBe(1000);
      expect(belvoCanonical.amountCents).toBe(1000);
    });

    it('should detect correct adapter for each provider payload', () => {
      const pluggyPayload = { eventId: 'test', amount: '10.00' };
      const belvoPayload = { notification_id: 'test', amount_cents: 10 };

      expect(pluggyAdapter.canHandle(pluggyPayload)).toBe(true);
      expect(pluggyAdapter.canHandle(belvoPayload)).toBe(false);
      expect(belvoAdapter.canHandle(belvoPayload)).toBe(true);
      expect(belvoAdapter.canHandle(pluggyPayload)).toBe(false);
    });
  });
});