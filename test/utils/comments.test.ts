import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import commentsRoutes, { comments } from '../../src/routes/comments';
import errorPlugin from '../../src/plugins/errorPlugin';

// Helper to create a mock Fastify instance and register the plugin
async function setupFastify() {
  const fastify = Fastify();
  await fastify.register(errorPlugin);
  // Manually inject the mock comments array into the plugin if needed, or ensure the plugin uses a way to reset it.
  // For now, we'll assume the plugin directly uses the `comments` array defined in its scope,
  // and we'll reset it here before each test.
  await fastify.register(commentsRoutes);
  return fastify;
}

describe('Comments Routes', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Reset the comments array before each test
    comments.length = 0; // Clear the array
    fastify = await setupFastify();
  });

  describe('GET /poll/:pollId', () => {
    it('should return an empty array if no comments exist for a poll', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/poll/nonExistentPoll',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ success: true, comments: [] });
    });

    it('should return comments for a specific poll', async () => {
      // Manually add comments to the mock array
      comments.push({
        id: '1',
        pollId: 'poll123',
        user: 'userA',
        comment: 'Comment 1 for poll 123',
        createdAt: new Date(),
      });
      comments.push({
        id: '2',
        pollId: 'poll123',
        user: 'userB',
        comment: 'Comment 2 for poll 123',
        createdAt: new Date(),
      });
      comments.push({
        id: '3',
        pollId: 'poll456',
        user: 'userC',
        comment: 'Comment for poll 456',
        createdAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/poll/poll123',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.comments.length).toBe(2);
      expect(payload.comments[0].comment).toBe('Comment 1 for poll 123');
      expect(payload.comments[1].comment).toBe('Comment 2 for poll 123');
    });
  });

  describe('POST /poll/:pollId', () => {
    it('should successfully post a new comment with trimmed user and comment', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: '  newUserWithSpaces  ',
          comment: '  This is a new comment with spaces.  ',
        },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('id');
      expect(payload.pollId).toBe('poll789');
      expect(payload.user).toBe('newUserWithSpaces'); // Should be trimmed
      expect(payload.comment).toBe('This is a new comment with spaces.'); // Should be trimmed
      expect(comments.length).toBe(1);
    });

    it('should return 400 if trimmed user is too short', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: '  a  ', // Trimmed length is 1, min is 3
          comment: 'This is a new comment.',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'User is required and must be a string between 3 and 50 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should return 400 if trimmed comment is too short (empty)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'newUser',
          comment: '   ', // Trimmed length is 0, min is 1
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Comment is required and must be a string between 1 and 500 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should successfully post a new comment', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'newUser',
          comment: 'This is a new comment.',
        },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('id');
      expect(payload.pollId).toBe('poll789');
      expect(payload.user).toBe('newUser');
      expect(payload.comment).toBe('This is a new comment.');
      expect(comments.length).toBe(1); // Check if comment was added to the mock array
    });

    it('should return 400 if user is missing or invalid', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          comment: 'This is a new comment.',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'User is required and must be a string between 3 and 50 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should return 400 if user is too short', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'ab',
          comment: 'This is a new comment.',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'User is required and must be a string between 3 and 50 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should return 400 if user is too long', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'a'.repeat(51),
          comment: 'This is a new comment.',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'User is required and must be a string between 3 and 50 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should return 400 if comment is missing or invalid', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'newUser',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Comment is required and must be a string between 1 and 500 characters',
      });
      expect(comments.length).toBe(0);
    });

    it('should return 400 if comment is too long', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/poll/poll789',
        payload: {
          user: 'newUser',
          comment: 'a'.repeat(501),
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Comment is required and must be a string between 1 and 500 characters',
      });
      expect(comments.length).toBe(0);
    });
  });

  describe('DELETE /:id', () => {
    it('should successfully delete an existing comment', async () => {
      // Manually add a comment to delete
      comments.push({
        id: 'commentToDelete',
        pollId: 'poll123',
        user: 'userA',
        comment: 'Comment to be deleted',
        createdAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/commentToDelete',
      });

      expect(response.statusCode).toBe(204);
      expect(response.payload).toBe(''); // 204 No Content should have an empty payload
      expect(comments.length).toBe(0); // Check if comment was removed
    });

    it('should return 404 if the comment is not found', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/nonExistentComment',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Comment not found.',
      });
      expect(comments.length).toBe(0);
    });
  });
});
