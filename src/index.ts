
import fastify from "fastify";
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
      server.log.info(`🚀 Server listening at http://${host}:${port} in ${process.env.NODE_ENV} mode`);

      // Perform a simple health check
      try {
        const resolvedHealthCheckHost = host === '0.0.0.0' ? '127.0.0.1' : (host === '::' ? '::1' : host);
        const healthCheckUrl = resolvedHealthCheckHost.includes(':')
          ? `http://[${resolvedHealthCheckHost}]:${port}/health`
          : `http://${resolvedHealthCheckHost}:${port}/health`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

        const healthCheckResponse = await fetch(healthCheckUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!healthCheckResponse.ok) {
          server.log.error(`Health check failed with status: ${healthCheckResponse.status}`);
          process.exit(1);
        }
        server.log.info("✅ Server health check passed.");
      } catch (healthCheckError: any) {
        if (healthCheckError.name === 'AbortError') {
          server.log.error("Server health check timed out.");
        } else {
          server.log.error({ err: healthCheckError }, "Server health check failed.");
        }
        process.exit(1);
      }

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
