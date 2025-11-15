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
vi.mock('../src/middleware/auth.ts', () => ({
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
    (vi.mocked(await import('../src/middleware/auth.ts'))).verifyWalletSignatureFromHeaders.mockImplementation(async (request, reply) => {
      // Simulate successful verification by doing nothing and resolving the promise
      return Promise.resolve();
    });

    // Ensure verifyWalletSignature is mocked to pass
    (vi.mocked(await import('../src/middleware/auth.ts'))).verifyWalletSignature.mockImplementation(async (request, reply) => {
      // Simulate successful verification by doing nothing and resolving the promise
      return Promise.resolve();
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api-keys', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);

    it('should return all API keys for a wallet with scopes', async () => {
      const mockApiKeys = [
        {
          id: 'key-1',
          key: 'hashed-key-1',
          createdAt: new Date('2023-01-01T10:00:00.000Z'),
          enabled: true,
          scopes: ['polls:read'],
        },
        {
          id: 'key-2',
          key: 'hashed-key-2',
          createdAt: new Date('2023-01-02T11:00:00.000Z'),
          enabled: true,
          scopes: ['comments:write', 'apiKeys:read'],
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
        url: '/api-keys',
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
        key: '************key-2', // Masked
        createdAt: '2023-01-02T11:00:00.000Z',
        enabled: true,
        scopes: ['comments:write', 'apiKeys:read'],
      });
      expect(body.apiKeys[1]).toMatchObject({
        id: 'key-1',
        key: '************key-1', // Masked
        createdAt: '2023-01-01T10:00:00.000Z',
        enabled: true,
        scopes: ['polls:read'],
      });
    });

    it('should return 404 if user not found', async () => {
      (prisma.apiUser.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api-keys',
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
  });

  describe('POST /api-keys/:id/rotate', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);
    const apiKeyId = 'existing-key-id';

    it('should rotate an API key and preserve scopes', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
      };
      const existingApiKey = {
        id: apiKeyId,
        userId: 'user-1',
        key: 'old-hashed-key',
        hash: 'old-hashed-key',
        enabled: true,
        createdAt: new Date(),
        algorithm: 'base64url',
        scopes: ['polls:read', 'apiKeys:read'],
      };
      const newApiKeyRecord = {
        id: 'new-key-id',
        userId: 'user-1',
        key: 'new-hashed-key',
        hash: 'new-hashed-key',
        enabled: true,
        createdAt: new Date(),
        algorithm: 'base64url',
        scopes: ['polls:read', 'apiKeys:read'],
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKey.findFirst as any).mockResolvedValue(existingApiKey);
      (prisma.$transaction as any).mockImplementation(async (callback) => {
        const tx = {
          apiKey: {
            update: vi.fn().mockResolvedValue({ ...existingApiKey, enabled: false, rotatedAt: new Date() }),
            create: vi.fn().mockResolvedValue(newApiKeyRecord),
          },
        };
        return callback(tx);
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api-keys/${apiKeyId}/rotate`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.apiKey).toBeDefined();
      expect(body.keyId).toBe('new-key-id');
      expect(body.scopes).toEqual(['polls:read', 'apiKeys:read']);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 404 if API key not found for rotation', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKey.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: `/api-keys/${apiKeyId}/rotate`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('API key not found or already revoked.');
    });
  });

  describe('DELETE /api-keys/:id', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);
    const apiKeyId = 'existing-key-id';

    it('should revoke an API key', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
      };
      const existingApiKey = {
        id: apiKeyId,
        userId: 'user-1',
        enabled: true,
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKey.findFirst as any).mockResolvedValue(existingApiKey);
      (prisma.apiKey.update as any).mockResolvedValue({ ...existingApiKey, enabled: false, revokedAt: new Date() });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api-keys/${apiKeyId}`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('API key revoked successfully');
      expect(prisma.apiKey.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: apiKeyId },
        data: expect.objectContaining({
          enabled: false,
        }),
      }));
    });

    it('should return 404 if API key not found for revocation', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKey.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api-keys/${apiKeyId}`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('API key not found or already revoked.');
    });
  });
});
