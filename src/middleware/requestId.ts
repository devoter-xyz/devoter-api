import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    id: string;
  }
}

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    request.id = uuidv4();
    reply.header('X-Request-ID', request.id);
    done();
  });
};

export const requestIdMiddleware = fp(requestIdPlugin);
