import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// In-memory store for comments (replace with DB in production)
export const comments: Array<{
  id: string;
  pollId: string;
  user: string;
  comment: string;
  createdAt: Date;
}> = [];

import { validateCommentInput } from '../utils/validation.js';
import { ApiError, asyncHandler } from '../utils/errorHandler.js';

const commentsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get comments for a poll

  fastify.get<{
    Params: { pollId: string };
    Querystring: { limit?: number; cursor?: string };
  }>('/poll/:pollId', {
    schema: {
      querystring: z.object({
        limit: z.coerce.number().int().min(1).default(10).transform(value => Math.min(value, 50)),
        cursor: z.string().optional(),
      }),
    },
  }, async (request, reply) => {
    const { pollId } = request.params;
    const { limit = 10, cursor } = request.query;

    let pollComments = comments.filter(c => c.pollId === pollId);

    // Sort by createdAt descending for consistent pagination
    pollComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = pollComments.findIndex(c => c.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      } else {
        // If cursor is invalid or not found, treat it as no cursor
        startIndex = 0;
      }
    }

    const paginatedComments = pollComments.slice(startIndex, startIndex + limit);

    const nextCursor = paginatedComments.length === limit && (startIndex + limit) < pollComments.length
      ? paginatedComments[paginatedComments.length - 1]?.id
      : undefined;

    const totalHint = pollComments.length;

    return {
      success: true,
      comments: paginatedComments,
      pagination: {
        nextCursor,
        limit,
        totalHint,
      },
    };
  });

  // Post a new comment to a poll

  fastify.post('/poll/:pollId', asyncHandler(async (request: FastifyRequest<{ Params: { pollId: string }; Body: { user?: string; comment?: string } }>, reply: FastifyReply) => {
    const { pollId } = request.params;
    const { user, comment } = request.body as { user?: string; comment?: string };

    const trimmedUser = (user || '').trim();
    const trimmedComment = (comment || '').trim();

    const validation = validateCommentInput({ user: trimmedUser, comment: trimmedComment });
    if (!validation.isValid) {
      throw ApiError.badRequest(validation.error, "BAD_REQUEST");
    }
    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      pollId,
      user: trimmedUser,
      comment: trimmedComment,
      createdAt: new Date(),
    };
    comments.push(newComment);
    reply.status(201);
    return newComment;
  }));

  // Delete a comment by id

  fastify.delete('/:id', asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const idx = comments.findIndex(c => c.id === id);
    if (idx === -1) {
      throw ApiError.notFound("Comment not found.", "NOT_FOUND");
    }
    comments.splice(idx, 1);
    reply.status(204);
    return undefined;
  }));
};

export default commentsRoutes;
