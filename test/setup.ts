import { vi } from 'vitest';

// Set a test database URL for Prisma
process.env.DATABASE_URL = 'sqlite://file:memory.db?mode=memory&cache=shared';
process.env.NODE_ENV = 'test';

// Mock PrismaClient to prevent actual database connections during tests
const mockPrismaClient = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  poll: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn((data) => ({ id: 'mock-poll-id', ...data })),
  },
  apiUser: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
  vote: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn((data) => ({ id: 'mock-vote-id', ...data })),
    groupBy: vi.fn().mockResolvedValue([]),
  },
  apiKey: {
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn((data) => ({ id: 'mock-api-key-id', ...data })),
  },
  apiKeyUsage: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _sum: { requestCount: 0 } }),
  },
  $transaction: vi.fn((cb) => cb()),
  $queryRaw: vi.fn().mockResolvedValue([]),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
}));

vi.mock('~/lib/prisma.js', () => ({
  prisma: mockPrismaClient,
  prismaPlugin: vi.fn(() => {}), // Mock the plugin as well if it's imported
}));
