// Jest setup file
// Sets up test environment and global mocks

// Mock PrismaClient for all tests
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    idempotencyKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  })),
  Prisma: {
    KnownRequestError: class KnownRequestError extends Error {
      code: string;
      constructor(code: string) {
        super();
        this.code = code;
      }
    },
  },
}));

// Set test environment variables
process.env.PLUGGY_WEBHOOK_SECRET = 'test-pluggy-secret';
process.env.BELVO_WEBHOOK_SECRET = 'test-belvo-secret';
process.env.DATABASE_URL = 'file:./test.db';

// Increase timeout for integration tests
jest.setTimeout(10000);