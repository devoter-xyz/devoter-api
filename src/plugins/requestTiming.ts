
import type { FastifyPluginAsync } from 'fastify';
import * as hdr from 'hdr-histogram-js';

declare module 'fastify' {
  interface FastifyInstance {
    getMetricsSnapshot(): MetricsSnapshot;
  }
}

interface MetricsSnapshot {
  totalRequests: number;
  p50: string;
  p95: string;
  simpleP50: string;
  simpleP95: string;
  windowSize: number;
}

const SLOW_REQUEST_THRESHOLD_MS = 500;
const METRICS_RESET_INTERVAL_MS = 3600 * 1000; // 1 hour

let totalRequests = 0;
const histogram = hdr.build({ lowestDiscernibleValue: 1, highestTrackableValue: 60000, numberOfSignificantValueDigits: 3 }); // min, max, significant figures
const metricsQueue: number[] = [];
let processingQueue = false;

const processMetricsQueue = () => {
  if (processingQueue) {
    return;
  }
  processingQueue = true;
  process.nextTick(() => {
    while (metricsQueue.length > 0) {
      const duration = metricsQueue.shift();
      if (duration !== undefined) {
        histogram.recordValue(duration);
        totalRequests++;
      }
    }
    processingQueue = false;
  });
};

const requestTimingPlugin: FastifyPluginAsync = async (fastify) => {
  // Schedule periodic reset of metrics
  const resetInterval = setInterval(() => {
    histogram.reset();
    totalRequests = 0;
    fastify.log.info('Request metrics reset.');
  }, METRICS_RESET_INTERVAL_MS);

  // Ensure interval is cleared on server close
  fastify.addHook('onClose', (instance, done) => {
    clearInterval(resetInterval);
    done();
  });

  fastify.decorateRequest('hrtime', null);

  fastify.addHook('onRequest', async (request, reply) => {
    request.hrtime = process.hrtime.bigint();
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const start = request.hrtime as bigint;
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds

    metricsQueue.push(duration);
    processMetricsQueue();

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

  fastify.decorate('getMetricsSnapshot', (): MetricsSnapshot => {
    const p50 = histogram.getValueAtPercentile(50);
    const p95 = histogram.getValueAtPercentile(95);

    return {
      totalRequests,
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      simpleP50: 'N/A', // Removed simple percentile calculation
      simpleP95: 'N/A', // Removed simple percentile calculation
      windowSize: histogram.totalCount,
    };
  });
};

export default requestTimingPlugin;
