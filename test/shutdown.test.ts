import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { build } from '../src/server';
import { getEnv } from '../src/config/env';
import type { FastifyInstance } from 'fastify';
import { replayProtectionCache } from '../src/lib/replayProtectionCache';
import * as rateLimitAnalytics from '../src/lib/rateLimitAnalytics';

// Mock process.exit to prevent actual process termination during tests
const mockExit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
  throw new Error(`Process exited with code: ${code}`);
}) as any);

// Mock console.error to prevent test logs from being too noisy
vi.spyOn(console, 'error').mockImplementation(() => {});

let server: FastifyInstance;
let env: ReturnType<typeof getEnv>;

beforeAll(async () => {
  env = getEnv();
  server = await build();
  await server.listen({ port: 0, host: env.HOST }); // Use port 0 to get a random available port
});

afterAll(async () => {
  await server.close();
  mockExit.mockRestore(); // Restore original process.exit
});

const sendSignal = (signal: 'SIGTERM' | 'SIGINT') => {
  process.emit(signal as any, signal);
};

test('should gracefully shut down the server on SIGTERM', async () => {
  const serverCloseSpy = vi.spyOn(server, 'close');
  const replayProtectionCacheStopCleanupSpy = vi.spyOn(replayProtectionCache, 'stopCleanup');
  const clearRateLimitAnalyticsSpy = vi.spyOn(rateLimitAnalytics, 'clearRateLimitAnalytics');

  const shutdownPromise = new Promise<void>((resolve) => {
    server.addHook('onClose', () => {
      resolve();
    });
  });

  sendSignal('SIGTERM');

  await expect(shutdownPromise).resolves.toBeUndefined();
  expect(serverCloseSpy).toHaveBeenCalledOnce();
  expect(replayProtectionCacheStopCleanupSpy).toHaveBeenCalledOnce();
  expect(clearRateLimitAnalyticsSpy).toHaveBeenCalledOnce();
  expect(mockExit).toHaveBeenCalledWith(0);
});

test('should reject new requests during shutdown', async () => {
  const address = server.addresses()[0];
  const port = typeof address === 'string' ? address.split(':').pop() : address?.port;
  const host = typeof address === 'string' ? address.split(':')[0] : address?.address;

  // Simulate a long-running request
  server.get('/long-request', async (request, reply) => {
    await new Promise(resolve => setTimeout(resolve, env.SHUTDOWN_TIMEOUT_SECONDS * 1000 / 2)); // Half the shutdown timeout
    return { status: 'long request completed' };
  });

  const longRequestPromise = fetch(`http://${host}:${port}/long-request`);

  // Immediately send shutdown signal
  sendSignal('SIGTERM');

  // Try to send a new request immediately after shutdown signal
  const newRequestPromise = fetch(`http://${host}:${port}/health/ready`);

  // Expect the long-running request to complete successfully
  const longRequestResponse = await longRequestPromise;
  expect(longRequestResponse.ok).toBe(true);
  expect(await longRequestResponse.json()).toEqual({ status: 'long request completed' });

  // Expect new requests to be rejected with 503
  const newRequestResponse = await newRequestPromise;
  expect(newRequestResponse.status).toBe(503);
  expect(await newRequestResponse.json()).toEqual({ status: 'service unavailable', message: 'Server is shutting down.' });
});

test('should forcefully shut down after timeout if connections persist', async () => {
  const address = server.addresses()[0];
  const port = typeof address === 'string' ? address.split(':').pop() : address?.port;
  const host = typeof address === 'string' ? address.split(':')[0] : address?.address;

  // Simulate a very long-running request that exceeds shutdown timeout
  server.get('/very-long-request', async (request, reply) => {
    await new Promise(resolve => setTimeout(resolve, (env.SHUTDOWN_TIMEOUT_SECONDS + 5) * 1000)); // Longer than shutdown timeout
    return { status: 'very long request completed' };
  });

  const veryLongRequestPromise = fetch(`http://${host}:${port}/very-long-request`);

  const shutdownStartTime = Date.now();
  sendSignal('SIGTERM');

  await expect(veryLongRequestPromise).rejects.toThrow(); // Expect the request to be aborted/fail

  const shutdownEndTime = Date.now();
  const shutdownDuration = (shutdownEndTime - shutdownStartTime) / 1000;

  // Expect forceful exit after timeout
  expect(mockExit).toHaveBeenCalledWith(1);
  expect(shutdownDuration).toBeGreaterThanOrEqual(env.SHUTDOWN_TIMEOUT_SECONDS);
  expect(shutdownDuration).toBeLessThan(env.SHUTDOWN_TIMEOUT_SECONDS + 5); // Allow a small buffer
});

test('readiness probe should return 503 during shutdown', async () => {
  const address = server.addresses()[0];
  const port = typeof address === 'string' ? address.split(':').pop() : address?.port;
  const host = typeof address === 'string' ? address.split(':')[0] : address?.address;

  // Send shutdown signal
  sendSignal('SIGTERM');

  // Check readiness probe immediately after signal
  const readinessResponse = await fetch(`http://${host}:${port}/health/ready`);
  expect(readinessResponse.status).toBe(503);
  expect(await readinessResponse.json()).toEqual({ status: 'service unavailable', message: 'Server is shutting down.' });
});
