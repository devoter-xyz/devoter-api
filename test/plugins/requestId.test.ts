import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';
import errorPlugin from '../../src/plugins/errorPlugin.js';
import { ApiError, HttpStatusCode } from '../../src/utils/errorHandler.js';

describe('requestIdMiddleware', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    fastify = Fastify({
      logger: false,
    });
    fastify.register(requestIdMiddleware);
    fastify.register(errorPlugin);

    fastify.get('/', async (request, reply) => {
      return { requestId: request.id };
    });

    fastify.get('/error', async (request, reply) => {
      throw ApiError.internal('Test error');
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should add X-Request-ID header to responses', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  it('should make request.id accessible and consistent with X-Request-ID header', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/',
    });

    const payload = JSON.parse(response.payload);
    const requestIdFromHeader = response.headers['x-request-id'];

    expect(payload.requestId).toBeDefined();
    expect(payload.requestId).toBe(requestIdFromHeader);
  });

  it('should include request ID in error responses', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/error',
    });

    const errorResponse = JSON.parse(response.payload);
    const requestIdFromHeader = response.headers['x-request-id'];

    expect(response.statusCode).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(errorResponse.correlationId).toBeDefined();
    expect(errorResponse.correlationId).toBe(requestIdFromHeader);
  });
});
