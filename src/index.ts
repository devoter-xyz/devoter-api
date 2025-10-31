
// Import Fastify, a fast and low overhead web framework for Node.js
import fastify from "fastify";
// Import dotenv to load environment variables from a .env file
import { config } from "dotenv";
import { build } from "./server.js";

// Load environment variables from .env file into process.env
config();

/**
 * Starts the Fastify server with all middleware, plugins, and routes registered.
 * Handles environment configuration, error handling, CORS, rate limiting, and API routes.
 */
if (process.env.NODE_ENV !== "test") {
  const start = async () => {
    let server;
    try {
      server = await build();
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
      const tempServer = fastify(); // Create a temporary server instance for logging
      tempServer.log.error({ err }, "Startup error occurred in Fastify server");
      process.exit(1);
    }
  };

  // Start the server
  start();
}
