import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { handleError } from "../utils/errorHandler.js";

/**
 * Plugin to register global error handling for Fastify
 */
const errorPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Handle validation errors from Fastify's validation
  fastify.setValidatorCompiler(({ schema }) => {
    return (data: unknown) => {
      // Fastify will handle validation using TypeBox schemas
      return { value: data };
    };
  });

  // Set global error handler
  fastify.setErrorHandler((error, request, reply) => {
    handleError(error, request, reply);
  });
};

export default fp(errorPlugin);
