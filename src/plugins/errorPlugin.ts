
// Import Fastify types for plugin typing
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
// Import fastify-plugin to enable plugin encapsulation and reuse
import fp from "fastify-plugin";
// Import the custom error handler utility
import { handleError } from "../utils/errorHandler.js";


/**
 * Fastify plugin to register global error handling.
 *
 * - Sets a custom validator compiler (currently a pass-through for TypeBox schemas).
 *   This can be extended to add custom validation logic if needed.
 * - Registers a global error handler that delegates to the custom handleError utility.
 *
 * @param fastify Fastify instance to decorate
 */
const errorPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Override Fastify's validator compiler.
  // This implementation simply returns the data as-is, assuming TypeBox schemas handle validation.
  // Modify this if you need custom validation logic.


  // Register a global error handler for all uncaught errors in Fastify routes and hooks.
  // This ensures consistent error responses and logging.
  fastify.setErrorHandler((error, request, reply) => {
    handleError(error, request, reply);
  });
};


// Export the plugin wrapped with fastify-plugin for encapsulation and reuse
export default fp(errorPlugin);
