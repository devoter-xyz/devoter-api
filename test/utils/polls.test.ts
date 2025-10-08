import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pollsRoutes, { polls } from '../../src/routes/polls';

async function setupFastify() {
  const fastify = Fastify();
  await fastify.register(pollsRoutes);
  return fastify;
}

describe('Polls Routes', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Reset the polls array before each test
    polls.length = 0; // Clear the array
    fastify = await setupFastify();
  });

  describe('GET /polls', () => {
    it('should return an empty array if no polls exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/polls',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual([]);
    });
  });
});
