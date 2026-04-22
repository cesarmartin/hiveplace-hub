import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { WebhooksController } from '../../src/webhooks/webhooks.controller';
import { IdempotencyService } from '../../src/webhooks/idempotency.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let idempotencyService: jest.Mocked<IdempotencyService>;

  beforeEach(async () => {
    const mockIdempotencyService = {
      reserve: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    idempotencyService = module.get(IdempotencyService);
  });

  describe('receive', () => {
    const mockProvider = 'pluggy';
    const mockBody = {
      eventId: 'evt-123',
      accountId: 'acc-456',
      amount: '100.00',
      currency: 'BRL',
      type: 'CREDIT',
      status: 'POSTED',
    };

    it('should accept fresh webhook and return 202', async () => {
      idempotencyService.reserve.mockResolvedValue(true);

      const result = await controller.receive(mockProvider, mockBody);

      expect(result.status).toBe('accepted');
      expect(result.eventId).toBe('evt-123');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'evt-123');
    });

    it('should detect duplicate webhook and return accepted with duplicate flag', async () => {
      idempotencyService.reserve.mockResolvedValue(false);

      const result = await controller.receive(mockProvider, mockBody);

      expect(result.status).toBe('accepted');
      expect(result.duplicate).toBe(true);
      expect(result.eventId).toBeUndefined();
    });

    it('should handle Belvo-style payload with notification_id', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const belvoBody = {
        notification_id: 'notif-789',
        account_id: 'acc-456',
        amount_cents: 10000,
      };

      const result = await controller.receive('belvo', belvoBody);

      expect(result.eventId).toBe('notif-789');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('belvo', 'notif-789');
    });

    it('should handle payload with id field', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const bodyWithId = { id: 'simple-id', amount: '50.00' };

      const result = await controller.receive('pluggy', bodyWithId);

      expect(result.eventId).toBe('simple-id');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'simple-id');
    });

    it('should accept webhook even when eventId is missing but log warning', async () => {
      const bodyWithoutEventId = { amount: '100.00', currency: 'BRL' };

      const result = await controller.receive('pluggy', bodyWithoutEventId);

      expect(result.status).toBe('accepted');
      expect(result.note).toBe('missing event id');
    });

    it('should fallback to alternative eventId fields in correct priority', async () => {
      idempotencyService.reserve.mockResolvedValue(true);

      // Test eventId (first priority)
      await controller.receive('pluggy', { eventId: 'evt-1', amount: '1.00' });
      expect(idempotencyService.reserve).toHaveBeenLastCalledWith('pluggy', 'evt-1');

      // Test event_id (second priority)
      await controller.receive('pluggy', { event_id: 'evt-2', amount: '2.00' });
      expect(idempotencyService.reserve).toHaveBeenLastCalledWith('pluggy', 'evt-2');

      // Test id (third priority)
      await controller.receive('pluggy', { id: 'evt-3', amount: '3.00' });
      expect(idempotencyService.reserve).toHaveBeenLastCalledWith('pluggy', 'evt-3');

      // Test notification_id (fourth priority)
      await controller.receive('pluggy', { notification_id: 'evt-4', amount: '4.00' });
      expect(idempotencyService.reserve).toHaveBeenLastCalledWith('pluggy', 'evt-4');
    });

    it('should convert numeric eventId to string', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = { eventId: 12345, amount: '100.00' };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', '12345');
    });
  });

  describe('eventId extraction priority', () => {
    it('should extract eventId from eventId field first', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = {
        eventId: 'first-priority',
        event_id: 'second-priority',
        id: 'third-priority',
      };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'first-priority');
    });

    it('should extract eventId from event_id when eventId is absent', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = {
        event_id: 'second-priority',
        id: 'third-priority',
      };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'second-priority');
    });

    it('should extract eventId from id when eventId and event_id are absent', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = {
        id: 'third-priority',
      };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'third-priority');
    });

    it('should extract eventId from notification_id as last resort', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = {
        notification_id: 'last-priority',
      };

      await controller.receive('pluggy', body);

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'last-priority');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string eventId as missing', async () => {
      const body = { eventId: '', amount: '100.00' };

      const result = await controller.receive('pluggy', body);

      // Empty string is falsy, so it goes to missing eventId branch
      expect(result.status).toBe('accepted');
      expect(result.note).toBe('missing event id');
    });

    it('should handle whitespace-only eventId', async () => {
      idempotencyService.reserve.mockResolvedValue(true);
      const body = { eventId: '   ', amount: '100.00' };

      const result = await controller.receive('pluggy', body);

      // Whitespace is truthy
      expect(result.eventId).toBe('   ');
    });

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

    it('should handle both pluggy and belvo providers', async () => {
      idempotencyService.reserve.mockResolvedValue(true);

      await controller.receive('pluggy', { eventId: 'e1', amount: '1.00' });
      await controller.receive('belvo', { notification_id: 'e2', amount_cents: 100 });

      expect(idempotencyService.reserve).toHaveBeenCalledWith('pluggy', 'e1');
      expect(idempotencyService.reserve).toHaveBeenCalledWith('belvo', 'e2');
    });
  });
});