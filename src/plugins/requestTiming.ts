
import type { FastifyPluginAsync } from 'fastify';

const SLOW_REQUEST_THRESHOLD_MS = 500;

const requestTimingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('hrtime', null);

  fastify.addHook('onRequest', async (request, reply) => {
    request.hrtime = process.hrtime.bigint();
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const start = request.hrtime as bigint;
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
    console.log(`Request duration: ${duration.toFixed(2)}ms`); // Debugging line

    reply.header('X-Response-Time', `${duration.toFixed(2)}ms`);

    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      fastify.log.warn(`Slow request: ${request.method} ${request.url} - ${duration.toFixed(2)}ms`);
    }

    return payload;
  });
};

export default requestTimingPlugin;
