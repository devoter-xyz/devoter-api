import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    id: string;
  }
}

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    const requestId = request.id || uuidv4();
    request.id = requestId;
    reply.header('X-Request-ID', requestId);
    done();
  });
};

export const requestIdMiddleware = fp(requestIdPlugin);
