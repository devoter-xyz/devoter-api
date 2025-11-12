import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

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

  fastify.get('/poll/:pollId', async (request: FastifyRequest<{ Params: { pollId: string } }>, reply: FastifyReply) => {
    const { pollId } = request.params;
    const pollComments = comments.filter(c => c.pollId === pollId);
    return { success: true, comments: pollComments };
  });

  // Post a new comment to a poll

  fastify.post('/poll/:pollId', asyncHandler(async (request: FastifyRequest<{ Params: { pollId: string }; Body: { user: string; comment: string } }>, reply: FastifyReply) => {
    const { pollId } = request.params;
    const { user, comment }: { user: string; comment: string } = request.body as { user: string; comment: string };

    const trimmedUser = user!.trim();
    const trimmedComment = comment!.trim();

    const validation = validateCommentInput({ user: trimmedUser as string, comment: trimmedComment as string });
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
