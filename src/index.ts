import fastify from "fastify";
import { config } from "dotenv";
import {
  registerRateLimiting,
  rateLimitConfigs,
} from "./middleware/rateLimit.js";
import errorPlugin from "./plugins/errorPlugin.js";

// Load environment variables
config();

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

const start = async () => {
  try {
    // Register error handling plugin first
    await server.register(errorPlugin);

    // Register CORS
    await server.register((await import("@fastify/cors")).default, {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    });

    // Register rate limiting
    await registerRateLimiting(server);


    // Consolidated health endpoint with rate limiting
    server.get(
      "/health",
      {
        config: {
          rateLimit: rateLimitConfigs.health,
        },
      },
      async () => {
        return {
          status: "healthy",
          timestamp: new Date().toISOString(),
          service: "devoter-api",
        };
      }
    );

    // API routes will be registered here
    await server.register(import("./routes/register.js"));
    await server.register(import("./routes/apiKeys.js"));

    // Validate and parse port
    const portStr = process.env.PORT || "3000";
    const port = Number(portStr);
    if (isNaN(port) || port <= 0 || !Number.isInteger(port)) {
      server.log.error(`Invalid PORT environment variable: '${portStr}'. Must be a positive integer.`);
      process.exit(1);
    }
    const host = process.env.HOST || "localhost";

    await server.listen({ port, host });
    server.log.info(`🚀 Server listening at http://${host}:${port}`);
  } catch (err) {
    server.log.error({ err }, "Startup error occurred in Fastify server");
    process.exit(1);
  }
};

start();
