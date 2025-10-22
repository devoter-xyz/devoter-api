import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import requestTimingPlugin from '../../src/plugins/requestTiming.js';

describe('requestTimingPlugin', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    fastify = Fastify();
    fastify.register(requestTimingPlugin);
    fastify.get('/', async (request, reply) => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate some work
      return { hello: 'world' };
    });
    fastify.get('/slow', async (request, reply) => {
      await new Promise(resolve => setTimeout(resolve, 600)); // Simulate slow work
      return { hello: 'slow world' };
    });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should add X-Response-Time header to responses', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.headers['x-response-time']).toBeDefined();
    expect(response.headers['x-response-time']).toMatch(/\d+\.\d{2}ms/);
  });

  it('should log a warning for slow requests', async () => {
    const warnSpy = vi.spyOn(fastify.log, 'warn');

    await fastify.inject({
      method: 'GET',
      url: '/slow',
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Slow request: GET /slow'));

    warnSpy.mockRestore();
  });
});
