import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import commentsRoute from '~/routes/comments.js';
import { asyncHandler } from '~/utils/errorHandler.js'; // Import asyncHandler

const mockComments: any[] = []; // Declare mockComments here

// Mock the comments array and asyncHandler
vi.mock('~/routes/comments.js', async (importOriginal) => {
  const originalModule = await importOriginal();
  return {
    ...originalModule,
    comments: mockComments,
  };
});

vi.mock('~/utils/errorHandler.js', async (importOriginal) => {
  const originalModule = await importOriginal();
  return {
    ...originalModule,
    asyncHandler: vi.fn((fn) => fn), // Mock asyncHandler to just return the function
  };
});

describe('Comments Route Pagination', () => {
  let app: Fastify.FastifyInstance;
  const pollId = 'test-poll-1';
  const otherPollId = 'test-poll-2';

  beforeEach(async () => {
    app = Fastify();
    await app.register(commentsRoute);

    // Clear comments and populate with test data
    mockComments.length = 0; // Clear the array
    for (let i = 0; i < 25; i++) {
      mockComments.push({
        id: `comment-${i < 10 ? '0' : ''}${i}`,
        pollId: pollId,
        user: `user-${i}`,
        comment: `Comment ${i}`,
        createdAt: new Date(Date.now() - (24 - i) * 1000), // Older comments first
      });
    }
    // Add some comments for another poll
    mockComments.push({
      id: 'comment-other-0',
      pollId: otherPollId,
      user: 'user-other',
      comment: 'Comment for other poll',
      createdAt: new Date(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return comments with default pagination (limit 10)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(10);
    expect(body.comments[0].id).toBe('comment-24'); // Newest comment first
    expect(body.pagination.nextCursor).toBe('comment-15');
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should return comments with a specified limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}?limit=5`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(5);
    expect(body.comments[0].id).toBe('comment-24');
    expect(body.pagination.nextCursor).toBe('comment-20');
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should return comments starting after a given cursor', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}?cursor=comment-20&limit=5`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(5);
    expect(body.comments[0].id).toBe('comment-19');
    expect(body.pagination.nextCursor).toBe('comment-15');
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should handle limit exceeding the maximum cap (50)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}?limit=100`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(25); // All 25 comments, as limit is capped at 50
    expect(body.pagination.nextCursor).toBeUndefined();
    expect(body.pagination.limit).toBe(50); // Should be capped at 50
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should return an empty array and no nextCursor if no comments for poll', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/non-existent-poll`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(0);
    expect(body.pagination.nextCursor).toBeUndefined();
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalHint).toBe(0);
  });

  it('should return the last page correctly with no nextCursor', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}?limit=10&cursor=comment-05`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(5); // comments 4, 3, 2, 1, 0
    expect(body.comments[0].id).toBe('comment-04');
    expect(body.pagination.nextCursor).toBeUndefined();
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should handle an invalid cursor by starting from the beginning', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${pollId}?cursor=invalid-cursor&limit=5`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(5);
    expect(body.comments[0].id).toBe('comment-24'); // Should start from the beginning
    expect(body.pagination.nextCursor).toBe('comment-20');
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.totalHint).toBe(25);
  });

  it('should return all comments if totalHint is less than limit', async () => {
    // Only 1 comment for otherPollId
    const response = await app.inject({
      method: 'GET',
      url: `/poll/${otherPollId}?limit=10`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].id).toBe('comment-other-0');
    expect(body.pagination.nextCursor).toBeUndefined();
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalHint).toBe(1);
  });
});
