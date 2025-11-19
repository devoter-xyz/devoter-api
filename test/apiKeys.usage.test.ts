import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import apiKeysRoute from '~/routes/apiKeys.js';
import { PrismaClient } from '@prisma/client';
import errorPlugin from '~/plugins/errorPlugin.js';
import { authMiddleware } from '~/middleware/auth.js';
import { recordApiKeyUsage } from '~/lib/apiKeyUsageTracker.js';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    apiUser: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    apiKeyUsage: {
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  })),
}));

// Mock auth middleware to simulate successful authentication
vi.mock('~/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authMiddleware: vi.fn(async (request, reply) => {
      // Simulate successful API key authentication
      request.user = {
        apiUserId: 'test-user-id',
        apiKeyId: 'test-api-key-id',
        scopes: ['apiKeys:read', 'apiKeys:write'],
      };
    }),
    verifyWalletSignatureFromHeaders: vi.fn(async (request, reply) => {
      // Simulate successful verification by doing nothing and resolving the promise
      return Promise.resolve();
    }),
  };
});

// Mock the apiKeyUsageTracker to prevent actual database writes during middleware tests
vi.mock('~/lib/apiKeyUsageTracker.js', () => ({
  recordApiKeyUsage: vi.fn(),
}));

describe('API Keys Usage Route', () => {
  let app: Fastify.FastifyInstance;
  let prisma: PrismaClient;

  beforeEach(async () => {
    app = Fastify({
      logger: false, // Disable logger for tests
    });
    prisma = new PrismaClient();

    // Register plugins and routes
    await app.register(errorPlugin);
    await app.register(apiKeysRoute, { prefix: "/api/v1/api-keys" });

    // Clear all mocks
    vi.clearAllMocks();

    // Reset request.user before each test to ensure isolation
    app.addHook('onRequest', (request, reply, done) => {
      request.user = undefined;
      done();
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api-keys/:id/usage', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);
    const apiKeyId = 'test-api-key-id';
    const userId = 'test-user-id';

    it('should return usage statistics for a valid API key', async () => {
      const mockUser = {
        id: userId,
        walletAddress: walletAddress.toLowerCase(),
        apiKeys: [{ id: apiKeyId }],
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKeyUsage.count as any).mockResolvedValue(100);
      (prisma.apiKeyUsage.groupBy as any).mockResolvedValue([
        { endpoint: '/api/v1/polls', _count: { id: 70 }, _avg: { responseTime: 50 }, _sum: { responseTime: 3500 } },
        { endpoint: '/api/v1/comments', _count: { id: 30 }, _avg: { responseTime: 100 }, _sum: { responseTime: 3000 } },
      ]);
      (prisma.apiKeyUsage.aggregate as any).mockResolvedValue({ _avg: { responseTime: 65 } });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.totalRequests).toBe(100);
      expect(body.usageByEndpoint).toHaveLength(2);
      expect(body.overallAverageResponseTime).toBe(65);
    });

    it('should return 404 if API key not found for the user', async () => {
      (prisma.apiUser.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('API key not found for this user.');
    });

    it('should filter usage statistics by startDate and endDate', async () => {
      const mockUser = {
        id: userId,
        walletAddress: walletAddress.toLowerCase(),
        apiKeys: [{ id: apiKeyId }],
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKeyUsage.count as any).mockResolvedValue(50);
      (prisma.apiKeyUsage.groupBy as any).mockResolvedValue([
        { endpoint: '/api/v1/polls', _count: { id: 30 }, _avg: { responseTime: 60 }, _sum: { responseTime: 1800 } },
      ]);
      (prisma.apiKeyUsage.aggregate as any).mockResolvedValue({ _avg: { responseTime: 60 } });

      const startDate = new Date('2023-10-01T00:00:00.000Z').toISOString();
      const endDate = new Date('2023-10-31T23:59:59.999Z').toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage?startDate=${startDate}&endDate=${endDate}`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.totalRequests).toBe(50);
      expect(prisma.apiKeyUsage.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          apiKeyId: apiKeyId,
          timestamp: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      }));
    });
  });

  describe('GET /api-keys/:id/usage/export', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const message = 'Test message';
    const signature = '0x' + 'a'.repeat(130);
    const apiKeyId = 'test-api-key-id';
    const userId = 'test-user-id';

    const mockUsageRecords = [
      {
        id: 'usage-1',
        apiKeyId: apiKeyId,
        timestamp: new Date('2023-11-15T10:00:00.000Z'),
        endpoint: '/api/v1/polls',
        statusCode: 200,
        responseTime: 50,
      },
      {
        id: 'usage-2',
        apiKeyId: apiKeyId,
        timestamp: new Date('2023-11-15T10:01:00.000Z'),
        endpoint: '/api/v1/comments',
        statusCode: 201,
        responseTime: 100,
      },
    ];

    it('should export usage data as JSON', async () => {
      const mockUser = {
        id: userId,
        walletAddress: walletAddress.toLowerCase(),
        apiKeys: [{ id: apiKeyId }],
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKeyUsage.findMany as any).mockResolvedValue(mockUsageRecords);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage/export?format=json`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.headers['content-disposition']).toContain(`filename="api-key-${apiKeyId}-usage.json"`);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0].endpoint).toBe('/api/v1/polls');
    });

    it('should export usage data as CSV', async () => {
      const mockUser = {
        id: userId,
        walletAddress: walletAddress.toLowerCase(),
        apiKeys: [{ id: apiKeyId }],
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.apiKeyUsage.findMany as any).mockResolvedValue(mockUsageRecords);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage/export?format=csv`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain(`filename="api-key-${apiKeyId}-usage.csv"`);
      const expectedCsv = [
        'id,apiKeyId,timestamp,endpoint,statusCode,responseTime',
        `usage-1,${apiKeyId},${mockUsageRecords[0].timestamp.toISOString()},/api/v1/polls,200,50`,
        `usage-2,${apiKeyId},${mockUsageRecords[1].timestamp.toISOString()},/api/v1/comments,201,100`,
      ].join('\n');
      expect(response.payload).toBe(expectedCsv);
    });

    it('should return 404 if API key not found for export', async () => {
      (prisma.apiUser.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKeyId}/usage/export?format=json`,
        headers: {
          'x-wallet-address': walletAddress,
          'x-message': message,
          'x-signature': signature,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('API key not found for this user.');
    });
  });

  describe('API Key Usage Middleware Integration', () => {
    let testApp: Fastify.FastifyInstance;

    beforeEach(async () => {
      testApp = Fastify({
        logger: false,
      });
      await testApp.register(errorPlugin);

      // Manually add the onRequest hook for startTime
      testApp.addHook("onRequest", (request, reply, done) => {
        request.startTime = Date.now();
        done();
      });
      testApp.addHook("onRequest", authMiddleware);
      testApp.addHook("onResponse", (request, reply, done) => {
        if (request.startTime) {
          recordApiKeyUsage(request, reply, request.startTime);
        }
        done();
      });

      // A dummy route to trigger the middleware and onResponse hook
      testApp.get('/test-endpoint', async (request, reply) => {
        return reply.status(200).send({ message: 'OK' });
      });
    });

    afterEach(async () => {
      await testApp.close();
    });

    it('should call recordApiKeyUsage on successful API key authenticated request', async () => {
      // The authMiddleware mock already sets request.user
      const response = await testApp.inject({
        method: 'GET',
        url: '/test-endpoint',
        headers: {
          'authorization': 'Bearer some-api-key', // This header will trigger authMiddleware
        },
      });

      expect(response.statusCode).toBe(200);
      expect(recordApiKeyUsage).toHaveBeenCalledTimes(1);
      expect(recordApiKeyUsage).toHaveBeenCalledWith(
        expect.any(Object), // request
        expect.any(Object), // reply
        expect.any(Number)  // startTime
      );

      const callArgs = vi.mocked(recordApiKeyUsage).mock.calls[0];
      const requestArg = callArgs[0];
      const replyArg = callArgs[1];
      const startTimeArg = callArgs[2];

      expect(requestArg.user).toBeDefined();
      expect(requestArg.user?.apiKeyId).toBe('test-api-key-id');
      expect(requestArg.url).toBe('/test-endpoint');
      expect(replyArg.statusCode).toBe(200);
      expect(startTimeArg).toBeLessThanOrEqual(Date.now());
    });

    it('should not call recordApiKeyUsage if API key is not authenticated', async () => {
      // Override the authMiddleware mock for this specific test to simulate unauthenticated request
      vi.mocked(authMiddleware).mockImplementationOnce(async (request, reply) => {
        // Do not set request.user, simulate failure or no auth
        throw new Error("Authentication failed"); // Or just let it pass without setting user
      });

      const response = await testApp.inject({
        method: 'GET',
        url: '/test-endpoint',
        headers: {
          'authorization': 'Bearer invalid-api-key',
        },
      });

      // Expect an error from the authMiddleware, so status code might be 500 or 401 depending on error handling
      // The important part is that recordApiKeyUsage should NOT be called
      expect(recordApiKeyUsage).not.toHaveBeenCalled();
    });
  });
});
