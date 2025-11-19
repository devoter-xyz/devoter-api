import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Devoter API',
        description: 'API documentation for the Devoter platform',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
          },
          signature: {
            type: 'apiKey',
            name: 'x-signature',
            in: 'header',
          },
        },
      },
      tags: [
        { name: 'API Keys', description: 'API key management' },
        { name: 'Polls', description: 'Poll management' },
        { name: 'Comments', description: 'Comment management' },
        { name: 'Notifications', description: 'Notification management' },
        { name: 'Register', description: 'User registration' },
        { name: 'Health', description: 'Health check' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) { next() },
      preHandler: function (request, reply, next) { next() }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
    transformSpecificationClone: true
  });
});
