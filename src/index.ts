
// Import Fastify, a fast and low overhead web framework for Node.js
import fastify from "fastify";

// Import dotenv to load environment variables from a .env file
import { config } from "dotenv";

// Import custom middleware for rate limiting
import {
  registerRateLimiting,
  rateLimitConfigs,
  createRateLimitHandler,
} from "./middleware/rateLimit.js";

// Import custom error handling plugin
import errorPlugin from "./plugins/errorPlugin.js";
import requestTimingPlugin from "./plugins/requestTiming.js";
import apiKeysRoutes from "./routes/apiKeys.js";


// Load environment variables from .env file into process.env
config();


// Create a Fastify server instance with logging configuration
// Log level is set to 'info' in production, 'debug' otherwise
const server = fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});


/**
 * Starts the Fastify server with all middleware, plugins, and routes registered.
 * Handles environment configuration, error handling, CORS, rate limiting, and API routes.
 */
if (process.env.NODE_ENV !== "test") {
  const start = async () => {
    try {
      const server = await build();
      // Parse and validate the port from environment variables (default: 3000)
      const portStr = process.env.PORT || "3000";
      const port = Number(portStr);
      if (isNaN(port) || port <= 0 || !Number.isInteger(port)) {
        server.log.error(`Invalid PORT environment variable: '${portStr}'. Must be a positive integer.`);
        process.exit(1);
      }
      // Parse the host from environment variables (default: localhost)
      const host = process.env.HOST || "localhost";

      // Start the Fastify server and listen on the specified host and port
      await server.listen({ port, host });
      server.log.info(`🚀 Server listening at http://${host}:${port}`);
    } catch (err) {
      // Log startup errors and exit process with failure code
      const server = fastify(); // Create a temporary server instance for logging
      server.log.error({ err }, "Startup error occurred in Fastify server");
      process.exit(1);
    }
  };

  // Start the server
  start();
}
