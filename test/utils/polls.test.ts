import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pollsRoutes from '../../src/routes/polls';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    apiUser: {
      findUnique: vi.fn(),
    },
    poll: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  })),
}));

async function setupFastify() {
  const fastify = Fastify();
  await fastify.register(pollsRoutes);
  return fastify;
}

describe('Polls Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;

  beforeEach(async () => {
    fastify = await setupFastify();
    prisma = new PrismaClient();
    vi.clearAllMocks();
  });

  describe('GET /polls', () => {
    it('should return an empty array if no polls exist', async () => {
      (prisma.poll.findMany as any).mockResolvedValue([]);

      const response = await fastify.inject({
        method: 'GET',
        url: '/polls',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        polls: [],
      });
    });
  });
});
