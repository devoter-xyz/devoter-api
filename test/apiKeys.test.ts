import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import apiKeysRoute from '~/routes/apiKeys.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    apiUser: {
      findUnique: vi.fn(),
    },
    apiKey: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  })),
}));

// Mock auth middleware
vi.mock('~/middleware/auth.js', () => ({
  verifyWalletSignature: vi.fn((request, reply, done) => { done(); }), // Mock to simply call done
  verifyWalletSignatureFromHeaders: vi.fn((request, reply, done) => { done(); }), // Mock to simply call done
}));

describe('API Keys Route', () => {
  let app: Fastify.FastifyInstance;
  let prisma: PrismaClient;

  beforeEach(async () => {
    app = Fastify();
    prisma = new PrismaClient();

    // Register the route
    await app.register(apiKeysRoute);

    // Clear all mocks
    vi.clearAllMocks();

    // Ensure verifyWalletSignatureFromHeaders is mocked to pass
    (vi.mocked(await import('~/middleware/auth.js'))).verifyWalletSignatureFromHeaders.mockImplementation(async (request, reply) => {
      // Simulate successful verification by doing nothing
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api-keys/metadata', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);

    it('should return non-sensitive metadata for API keys', async () => {
      const mockApiKeys = [
        {
          id: 'key-1',
          createdAt: new Date('2023-01-01T10:00:00.000Z'),
          scopes: ['read', 'write'],
        },
        {
          id: 'key-2',
          createdAt: new Date('2023-01-02T11:00:00.000Z'),
          scopes: ['read'],
        },
      ];
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
        apiKeys: mockApiKeys,
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/api-keys/metadata',
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.apiKeys).toHaveLength(2);
      expect(body.apiKeys[0]).toMatchObject({
        id: 'key-2',
        createdAt: '2023-01-02T11:00:00.000Z',
        scopes: ['read'],
      });
      expect(body.apiKeys[1]).toMatchObject({
        id: 'key-1',
        createdAt: '2023-01-01T10:00:00.000Z',
        scopes: ['read', 'write'],
      });
      // Ensure no sensitive data is exposed
      expect(body.apiKeys[0]).not.toHaveProperty('key');
    });

    it('should return 404 if user not found', async () => {
      (prisma.apiUser.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api-keys/metadata',
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('User not found');
    });

    it('should return 400 for missing headers', async () => {
      // Temporarily restore original implementation to test missing headers
      (vi.mocked(await import('../../src/middleware/auth.js'))).verifyWalletSignatureFromHeaders.mockRestore();

      const response = await app.inject({
        method: 'GET',
        url: '/api-keys/metadata',
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          // Missing x-signature
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required headers');
    });
  });
});
