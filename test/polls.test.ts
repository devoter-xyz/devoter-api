import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import pollsRoute from '../../src/routes/polls.js';
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
      findUnique: vi.fn(),
    },
    vote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
  })),
}));

// Mock auth middleware
vi.mock('../../src/middleware/auth.js', () => ({
  verifyWalletSignature: vi.fn(),
}));

describe('Polls Route', () => {
  let app: Fastify.FastifyInstance;
  let prisma: PrismaClient;

  beforeEach(async () => {
    app = Fastify();
    prisma = new PrismaClient();

    // Register the route
    await app.register(pollsRoute);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /polls', () => {
    it('should create a new poll successfully', async () => {
      const mockUser = { id: 'user-1', walletAddress: '0x123...' };
      const mockPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        description: 'Test Description',
        options: JSON.stringify(['Option 1', 'Option 2']),
        creatorId: 'user-1',
      };

      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.poll.create as any).mockResolvedValue(mockPoll);

      const response = await app.inject({
        method: 'POST',
        url: '/polls',
        payload: {
          title: 'Test Poll',
          description: 'Test Description',
          options: ['Option 1', 'Option 2'],
          walletAddress: '0x1234567890123456789012345678901234567890',
          message: 'Create poll message',
          signature: '0x' + '1'.repeat(130),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.pollId).toBe('poll-1');
      expect(body.message).toBe('Poll created successfully');
    });

    it('should return 404 if user not found', async () => {
      (prisma.apiUser.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/polls',
        payload: {
          title: 'Test Poll',
          description: 'Test Description',
          options: ['Option 1', 'Option 2'],
          walletAddress: '0x1234567890123456789012345678901234567890',
          message: 'Create poll message',
          signature: '0x' + '1'.repeat(130),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('User not found');
    });
  });

  describe('GET /polls', () => {
    it('should return all polls', async () => {
      const mockPolls = [
        {
          id: 'poll-1',
          title: 'Poll 1',
          description: 'Description 1',
          options: JSON.stringify(['A', 'B']),
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'poll-2',
          title: 'Poll 2',
          description: null,
          options: JSON.stringify(['X', 'Y', 'Z']),
          createdAt: new Date('2023-01-02'),
        },
      ];

      (prisma.poll.findMany as any).mockResolvedValue(mockPolls);

      const response = await app.inject({
        method: 'GET',
        url: '/polls',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.polls).toHaveLength(2);
      expect(body.polls[0]).toMatchObject({
        id: 'poll-1',
        title: 'Poll 1',
        description: 'Description 1',
        options: ['A', 'B'],
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
  });

  describe('POST /polls/:id/vote', () => {
    it('should record a vote successfully', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        options: JSON.stringify(['Option 1', 'Option 2']),
      };
      const mockUser = { id: 'user-1', walletAddress: '0x123...' };

      (prisma.poll.findUnique as any).mockResolvedValue(mockPoll);
      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.vote.findUnique as any).mockResolvedValue(null);
      (prisma.vote.create as any).mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/polls/poll-1/vote',
        payload: {
          optionIndex: 0,
          walletAddress: '0x1234567890123456789012345678901234567890',
          message: 'Vote message',
          signature: '0x' + '1'.repeat(130),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Vote recorded successfully');
    });

    it('should return 404 if poll not found', async () => {
      (prisma.poll.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/polls/poll-1/vote',
        payload: {
          optionIndex: 0,
          walletAddress: '0x1234567890123456789012345678901234567890',
          message: 'Vote message',
          signature: '0x' + '1'.repeat(130),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Poll not found');
    });

    it('should return 400 if user already voted', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        options: JSON.stringify(['Option 1', 'Option 2']),
      };
      const mockUser = { id: 'user-1', walletAddress: '0x123...' };

      (prisma.poll.findUnique as any).mockResolvedValue(mockPoll);
      (prisma.apiUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.vote.findUnique as any).mockResolvedValue({ pollId: 'poll-1', userId: 'user-1' });

      const response = await app.inject({
        method: 'POST',
        url: '/polls/poll-1/vote',
        payload: {
          optionIndex: 0,
          walletAddress: '0x1234567890123456789012345678901234567890',
          message: 'Vote message',
          signature: '0x' + '1'.repeat(130),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('User has already voted on this poll');
    });
  });

  describe('GET /polls/:id/results', () => {
    it('should return poll results', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        description: 'Test Description',
        options: JSON.stringify(['Option 1', 'Option 2', 'Option 3']),
      };
      const mockVotes = [
        { optionIndex: 0, _count: { optionIndex: 5 } },
        { optionIndex: 1, _count: { optionIndex: 3 } },
        // Option 2 has 0 votes
      ];

      (prisma.poll.findUnique as any).mockResolvedValue(mockPoll);
      (prisma.vote.groupBy as any).mockResolvedValue(mockVotes);

      const response = await app.inject({
        method: 'GET',
        url: '/polls/poll-1/results',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.poll).toMatchObject({
        id: 'poll-1',
        title: 'Test Poll',
        description: 'Test Description',
        options: ['Option 1', 'Option 2', 'Option 3'],
        results: [5, 3, 0],
        totalVotes: 8,
      });
    });

    it('should return 404 if poll not found', async () => {
      (prisma.poll.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/polls/poll-1/results',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Poll not found');
    });
  });
});
