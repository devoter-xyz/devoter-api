import { test, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRateLimiting, rateLimitConfigs, createRateLimitHandler } from '../../src/middleware/rateLimit';

test('should return 429 status and Retry-After header when rate limit is exceeded for a custom route', async () => {
  const fastify = Fastify();
  await registerRateLimiting(fastify);

  fastify.get('/custom-rate-limit', createRateLimitHandler({ max: 1, timeWindow: 1000 }), async () => {
    return { message: 'OK' };
  });

  // First request - should pass
  const response1 = await fastify.inject({
    method: 'GET',
    url: '/custom-rate-limit',
  });

  expect(response1.statusCode).toBe(200);

  // Second request - should be rate-limited
  const response2 = await fastify.inject({
    method: 'GET',
    url: '/custom-rate-limit',
  });

  expect(response2.statusCode).toBe(429);
  expect(response2.headers['retry-after']).toBeDefined();
  expect(Number(response2.headers['retry-after'])).toBeGreaterThan(0);

  const payload = JSON.parse(response2.payload);
  expect(payload.error).toBe('Rate limit exceeded');
  expect(payload.statusCode).toBe(429);
});

test('should handle multiple rate limit configurations correctly', async () => {
  const fastify = Fastify();
  await registerRateLimiting(fastify);

  fastify.get('/auth-endpoint', createRateLimitHandler({ max: 1, timeWindow: 1000 }), async () => {
    return { message: 'Auth OK' };
  });

  fastify.get('/general-endpoint', createRateLimitHandler({ max: 1, timeWindow: 1000 }), async () => {
    return { message: 'General OK' };
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
