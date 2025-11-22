
import fastify, { FastifyInstance } from "fastify";
import { config } from "dotenv";
import { build } from "./server.js";
import { getEnv } from "./config/env";
import { replayProtectionCache } from "./lib/replayProtectionCache.js";
import { clearRateLimitAnalytics } from "./lib/rateLimitAnalytics.js";

// Load environment variables from .env file into process.env
config();

const env = getEnv();

let isShuttingDown = false;

/**
 * Starts the Fastify server with all middleware, plugins, and routes registered.
 * Handles environment configuration, error handling, CORS, rate limiting, and API routes.
 */
if (env.NODE_ENV !== "test") {
  const start = async () => {
    let server: FastifyInstance;
    let forceShutdownTimeout: NodeJS.Timeout;

    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        server.log.warn("Already shutting down. Ignoring duplicate signal.");
        return;
      }
      isShuttingDown = true;
      server.log.info(`Received ${signal}. Initiating graceful shutdown...`);

      // Mark server as not ready for new requests
      // (This will be handled by the /health/ready endpoint returning 503)
      server.log.info("Server is no longer accepting new connections.");

      // Set a timeout for forceful shutdown
      forceShutdownTimeout = setTimeout(() => {
        server.log.error(`Forceful shutdown after ${env.SHUTDOWN_TIMEOUT_SECONDS} seconds.`);
        process.exit(1);
      }, env.SHUTDOWN_TIMEOUT_SECONDS * 1000);

      try {
        // Close the Fastify server, which stops accepting new connections
        // and waits for existing connections to finish.
        await server.close();
        server.log.info("Fastify server closed.");

        // Cleanup other resources
        replayProtectionCache.stopCleanup();
        server.log.info("Replay protection cache cleanup stopped.");

        clearRateLimitAnalytics();
        server.log.info("Rate limit analytics cleared.");

        // Add other cleanup logic here (e.g., flushing metrics, clearing other intervals)

        server.log.info("Server shut down gracefully.");
        clearTimeout(forceShutdownTimeout);
        process.exit(0);
      } catch (err) {
        server.log.error({ err }, "Error during graceful shutdown.");
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    };

    try {
      server = await build();
      const port = env.PORT;
      const host = env.HOST;

      // Start the Fastify server and listen on the specified host and port
      await server.listen({ port, host });
      server.log.info(`🚀 Server listening at http://${host}:${port} in ${env.NODE_ENV} mode`);

      const signals = ["SIGINT", "SIGTERM"];
      signals.forEach((signal) => {
        process.on(signal, () => gracefulShutdown(signal));
      });

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

export { isShuttingDown };
