import { vi } from 'vitest';

// Set a test database URL for Prisma
process.env.DATABASE_URL = 'sqlite://file:memory.db?mode=memory&cache=shared';
process.env.NODE_ENV = 'test';

// Mock PrismaClient to prevent actual database connections during tests
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    PrismaClient: vi.fn(() => ({
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      // Add other Prisma client methods that are used in your application and need mocking
      // For example, if you use prisma.apiKey.findUnique, you'd add:
      // apiKey: {
      //   findUnique: vi.fn().mockResolvedValue(null),
      // },
    })),
  };
});
