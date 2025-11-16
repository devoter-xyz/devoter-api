
import type { FastifyInstance } from 'fastify';
import { getRateLimitAnalytics } from '../lib/rateLimitAnalytics.js';

export default async function rateLimitMetricsRoutes(fastify: FastifyInstance) {
  fastify.get('/rate-limits', async (request, reply) => {
    const analytics = getRateLimitAnalytics();
    return reply.status(200).send(analytics);
  });
}
