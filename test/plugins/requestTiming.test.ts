import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import requestTimingPlugin, { MetricsSnapshot } from '../../src/plugins/requestTiming.js';

declare module 'fastify' {
  interface FastifyInstance {
    getMetricsSnapshot(): MetricsSnapshot;
  }
}

describe('requestTimingPlugin', () => {
  let fastify: Fastify.FastifyInstance;
  let mockHrtimeNano: bigint;

  beforeEach(async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'setInterval'], // Let Vitest handle setInterval
    });

    mockHrtimeNano = BigInt(0);

    fastify = Fastify();
    await fastify.register(requestTimingPlugin, {
      getHrtime: () => mockHrtimeNano,
    });

    fastify.get('/', async (request, reply) => {
      mockHrtimeNano += BigInt(0); // This will be the start time, end time will be current mockHrtimeNano
      await new Promise(resolve => setImmediate(resolve)); // allow nextTick for processMetricsQueue
      return { hello: 'world' };
    });
    fastify.get('/long', async (request, reply) => {
      mockHrtimeNano += BigInt(500 * 1_000_000); // Simulate 500ms work (nanoseconds)
      await new Promise(resolve => setImmediate(resolve));
      return { hello: 'long world' };
    });
    fastify.get('/very-long', async (request, reply) => {
      mockHrtimeNano += BigInt(1000 * 1_000_000); // Simulate 1000ms work (nanoseconds)
      await new Promise(resolve => setImmediate(resolve));
      return { hello: 'very long world' };
    });
    fastify.get('/slow', async (request, reply) => {
      mockHrtimeNano += BigInt(600 * 1_000_000); // Simulate 600ms work, above SLOW_REQUEST_THRESHOLD_MS
      await new Promise(resolve => setImmediate(resolve));
      return { hello: 'slow world' };
    });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.runOnlyPendingTimers();
    vi.restoreAllMocks();
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

  it('should return correct metrics snapshot', async () => {
    await fastify.inject({
      method: 'GET',
      url: '/',
    });
    await fastify.inject({
      method: 'GET',
      url: '/long',
    });
    await fastify.inject({
      method: 'GET',
      url: '/very-long',
    });

    // Advance timers for the metrics queue to be processed
    vi.advanceTimersByTime(0); // Process any pending nextTick for metricsQueue

    const metrics = fastify.getMetricsSnapshot();

    expect(metrics.totalRequests).toBe(3);
    // The durations simulated are 0ms, 500ms, and 1000ms.
    // The hdr-histogram might not give exact values due to buckets and significant figures.
    // We expect values close to 0, 500, and 1000 for p50, p95 depending on distribution.
    // With 3 requests: 0ms (from '/'), 500ms (from '/long'), 1000ms (from '/very-long')
    // p50 should be around 500ms (median)
    // p95 should be around 1000ms (close to max)
    expect(parseFloat(metrics.p50)).toBeCloseTo(500, -1); // Allow some tolerance
    expect(parseFloat(metrics.p95)).toBeCloseTo(1000, -1); // Allow some tolerance
    expect(metrics.windowSize).toBe(3);
  });

  it('should reset metrics periodically', async () => {
    // Make some requests
    await fastify.inject({
      method: 'GET',
      url: '/',
    });
    vi.advanceTimersByTime(0); // Process metrics queue
    expect(fastify.getMetricsSnapshot().totalRequests).toBe(1);

    // Advance time past the METRICS_RESET_INTERVAL_MS (3600 * 1000 ms)
    vi.advanceTimersByTime(3600 * 1000 + 100);

    // The metrics should be reset
    expect(fastify.getMetricsSnapshot().totalRequests).toBe(0);
    expect(parseFloat(fastify.getMetricsSnapshot().p50)).toBe(0); // Histogram resets to 0
    expect(parseFloat(fastify.getMetricsSnapshot().p95)).toBe(0); // Histogram resets to 0
  });
});
