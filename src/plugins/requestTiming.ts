
import type { FastifyPluginAsync } from 'fastify';
import { Histogram } from 'hdr-histogram-js';

const SLOW_REQUEST_THRESHOLD_MS = 500;
const METRICS_WINDOW_SIZE = 1000; // Store last 1000 request durations for percentiles

const requestDurations: number[] = [];
let totalRequests = 0;

// Initialize HDR Histogram
const histogram = new Histogram(1, 60000, 3); // min, max, significant figures

const requestTimingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('hrtime', null);

  fastify.addHook('onRequest', async (request, reply) => {
    request.hrtime = process.hrtime.bigint();
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const start = request.hrtime as bigint;
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds

    // Record duration for metrics
    histogram.recordValue(duration);
    totalRequests++;

    // Keep a sliding window of durations for simple percentile calculation if HDR Histogram is not used for that
    requestDurations.push(duration);
    if (requestDurations.length > METRICS_WINDOW_SIZE) {
      requestDurations.shift(); // Remove the oldest duration
    }

    const debugTiming = process.env.REQUEST_TIMING_DEBUG === 'true';
    if (debugTiming) {
      fastify.log.debug(
        {
          path: request.url,
          method: request.method,
          statusCode: reply.statusCode,
          durationMs: duration.toFixed(2),
        },
        'request duration',
      );
    }

    reply.header('X-Response-Time', `${duration.toFixed(2)}ms`);

    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      fastify.log.warn(`Slow request: ${request.method} ${request.url} - ${duration.toFixed(2)}ms`);
    }

    return payload;
  });

  // Function to calculate percentiles from a simple array (for p50, p95)
  const calculateSimplePercentile = (durations: number[], percentile: number): number => {
    if (durations.length === 0) {
      return 0;
    }
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const index = Math.ceil(percentile / 100 * sortedDurations.length) - 1;
    return sortedDurations[index] || 0;
  };

  // Expose a function to get metrics snapshot
  fastify.decorate('getMetricsSnapshot', () => {
    const p50 = histogram.getValueAtPercentile(50);
    const p95 = histogram.getValueAtPercentile(95);
    const simpleP50 = calculateSimplePercentile(requestDurations, 50);
    const simpleP95 = calculateSimplePercentile(requestDurations, 95);

    return {
      totalRequests,
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      simpleP50: simpleP50.toFixed(2), // For comparison/simplicity
      simpleP95: simpleP95.toFixed(2), // For comparison/simplicity
      windowSize: requestDurations.length,
    };
  });
};

export default requestTimingPlugin;
