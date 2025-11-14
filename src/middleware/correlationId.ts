import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

export async function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.correlationId = request.id || uuidv4();
  reply.header('X-Correlation-ID', request.correlationId);
}
