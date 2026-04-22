import { IdempotencyService } from '../../src/webhooks/idempotency.service';

// Mock the PrismaService
jest.mock('../../src/common/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    idempotencyKey: {
      create: jest.fn(),
    },
  })),
}));

// Import after mock
import { PrismaService } from '../../src/common/prisma.service';

// Error code for unique constraint violation
const P2002 = 'P2002';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockPrismaService = new PrismaService() as jest.Mocked<PrismaService>;
    service = new IdempotencyService(mockPrismaService as any);
  });

  describe('reserve', () => {
    it('should return true for a new event', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: 'pluggy:event-123' } as any);

      const result = await service.reserve('pluggy', 'event-123');

      expect(result).toBe(true);
      expect(mockPrismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: { key: 'pluggy:event-123' },
      });
    });

    it('should return false for duplicate event', async () => {
      const error = new Error('Unique constraint violation') as any;
      error.code = P2002;
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockRejectedValue(error);

      const result = await service.reserve('pluggy', 'event-123');

      expect(result).toBe(false);
    });

    it('should construct key with provider:eventId format', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: 'belvo:notif-456' } as any);

      await service.reserve('belvo', 'notif-456');

      expect(mockPrismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: { key: 'belvo:notif-456' },
      });
    });

    it('should throw on non-unique-constraint errors', async () => {
      const error = new Error('Database connection error');
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockRejectedValue(error);

      await expect(service.reserve('pluggy', 'event-123')).rejects.toThrow('Database connection error');
    });

    it('should handle different providers independently', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock)
        .mockResolvedValueOnce({ key: 'pluggy:event-1' } as any)
        .mockResolvedValueOnce({ key: 'belvo:event-1' } as any);

      const result1 = await service.reserve('pluggy', 'event-1');
      expect(result1).toBe(true);

      const result2 = await service.reserve('belvo', 'event-1');
      expect(result2).toBe(true);
    });

    it('should treat different event IDs as unique even for same provider', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock)
        .mockResolvedValueOnce({ key: 'pluggy:event-1' } as any)
        .mockResolvedValueOnce({ key: 'pluggy:event-2' } as any);

      const result1 = await service.reserve('pluggy', 'event-1');
      expect(result1).toBe(true);

      const result2 = await service.reserve('pluggy', 'event-2');
      expect(result2).toBe(true);
    });

    it('should convert eventId to string for key construction', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: 'pluggy:123' } as any);

      await service.reserve('pluggy', 123 as any);

      expect(mockPrismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: { key: 'pluggy:123' },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty eventId', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: 'pluggy:' } as any);

      const result = await service.reserve('pluggy', '');

      expect(result).toBe(true);
    });

    it('should handle special characters in eventId', async () => {
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: 'pluggy:evt-with-dashes_underscores' } as any);

      const result = await service.reserve('pluggy', 'evt-with-dashes_underscores');

      expect(result).toBe(true);
    });

    it('should handle very long eventId', async () => {
      const longEventId = 'a'.repeat(1000);
      (mockPrismaService.idempotencyKey.create as jest.Mock).mockResolvedValue({ key: `pluggy:${longEventId}` } as any);

      const result = await service.reserve('pluggy', longEventId);

      expect(result).toBe(true);
    });
  });
});