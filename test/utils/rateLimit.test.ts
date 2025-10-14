import { test, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRateLimiting, rateLimitConfigs } from '../../src/middleware/rateLimit';

// Mock the rate limit configuration to make it easy to exceed
const mockRateLimitConfig = {
  max: 1, // Allow only 1 request
  timeWindow: 1000, // per second
  skipSuccessfulRequests: false,
  skipOnError: false,
};

// Mock the environment variable for the test
vi.stubEnv('RATE_LIMIT_GENERAL_MAX', '1');

beforeEach(() => {
  vi.clearAllMocks();
});

test('should return 429 status and Retry-After header when rate limit is exceeded', async () => {
  const fastify = Fastify();
  await registerRateLimiting(fastify);

  fastify.get('/test-rate-limit', {
    config: {
      rateLimit: mockRateLimitConfig,
    },
    handler: async (request, reply) => {
      return { message: 'OK' };
    },
  });

  // First request - should pass
  const response1 = await fastify.inject({
    method: 'GET',
    url: '/test-rate-limit',
  });

  expect(response1.statusCode).toBe(200);

  // Second request - should be rate-limited
  const response2 = await fastify.inject({
    method: 'GET',
    url: '/test-rate-limit',
  });

  expect(response2.statusCode).toBe(429);
  expect(response2.headers['retry-after']).toBeDefined();
  expect(Number(response2.headers['retry-after'])).toBeGreaterThan(0);
  expect(Number(response2.headers['retry-after'])).toBeLessThanOrEqual(mockRateLimitConfig.timeWindow / 1000);

  const payload = JSON.parse(response2.payload);
  expect(payload.error).toBe('Rate limit exceeded');
  expect(payload.statusCode).toBe(429);
  expect(payload.retryAfter).toBeDefined();
});

test('should handle multiple rate limit configurations correctly', async () => {
  const fastify = Fastify();
  await registerRateLimiting(fastify);

  // Mock a different rate limit config for another endpoint
  const mockAuthRateLimitConfig = {
    max: 1,
    timeWindow: 1000,
    skipSuccessfulRequests: false,
    skipOnError: false,
  };

  fastify.get('/auth-endpoint', {
    config: {
      rateLimit: mockAuthRateLimitConfig,
    },
    handler: async (request, reply) => {
      return { message: 'Auth OK' };
    },
  });

  fastify.get('/general-endpoint', {
    config: {
      rateLimit: mockRateLimitConfig,
    },
    handler: async (request, reply) => {
      return { message: 'General OK' };
    },
  });

  // Exceed auth endpoint limit
  await fastify.inject({ method: 'GET', url: '/auth-endpoint' });
  const authResponse = await fastify.inject({ method: 'GET', url: '/auth-endpoint' });
  expect(authResponse.statusCode).toBe(429);
  expect(authResponse.headers['retry-after']).toBeDefined();

  // General endpoint should still be accessible
  const generalResponse = await fastify.inject({ method: 'GET', url: '/general-endpoint' });
  expect(generalResponse.statusCode).toBe(200);
});
