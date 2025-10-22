
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
const start = async () => {
  try {
    // Register error handling plugin first to catch errors from subsequent plugins/routes
    await server.register(errorPlugin);
    // Register request timing plugin to measure and log request durations
    await server.register(requestTimingPlugin);

    // Register CORS (Cross-Origin Resource Sharing) to allow requests from specified origins
    await server.register((await import("@fastify/cors")).default, {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    });

    // Register rate limiting middleware to protect endpoints from abuse
    await registerRateLimiting(server);

    // Health check endpoint with rate limiting
    // Returns service status, timestamp, and name
    server.get(
      "/health",
      {
        ...createRateLimitHandler({
          max: 2, // Allow only 2 requests for health check
          timeWindow: 10000, // per 10 seconds
        }),
        handler: async () => {
        return {
          status: "healthy",
          timestamp: new Date().toISOString(),
          service: "devoter-api",
        };
      }
    );

    // Register API routes
    // - /register: Handles user or entity registration
    // - /apiKeys: Handles API key management
    // - /polls: Handles poll creation, voting, and results
    await server.register(import("./routes/register.js"));
    await server.register(import("./routes/apiKeys.js"));
    await server.register(import("./routes/polls.js"));

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
    server.log.error({ err }, "Startup error occurred in Fastify server");
    process.exit(1);
  }
};

// Start the server
start();
