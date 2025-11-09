
import fastify from "fastify";
import { config } from "dotenv";
import {
  registerRateLimiting,
  rateLimitConfigs,
  createRateLimitHandler,
  rateLimitErrorHandler,
} from "./middleware/rateLimit.js";
import errorPlugin from "./plugins/errorPlugin.js";
import requestTimingPlugin from "./plugins/requestTiming.js";
import apiKeysRoutes from "./routes/apiKeys.js";
import commentsRoutes from "./routes/comments.js";
import notificationsRoutes from "./routes/notifications.js";
// import pollsRoutes from "./routes/polls.js";
import registerRoutes from "./routes/register.js";
import { authMiddleware } from "./middleware/auth.js";
import { prismaPlugin } from "./lib/prisma.js";

config();

export async function build() {
  const server = fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // Validate required environment variables
  const requiredEnvVars = ["NODE_ENV", "DATABASE_URL", "PORT", "HOST"];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      server.log.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Register plugins
  await server.register(errorPlugin);
  await server.register(requestTimingPlugin);
  await server.register(prismaPlugin);

  // Register middleware
  server.addHook("onRequest", authMiddleware);

  // Register rate limiting
  await registerRateLimiting(server);
  server.setErrorHandler((error, request, reply) => {
    if (error.statusCode === 429) {
      return reply.status(429).send(rateLimitErrorHandler(request, error));
    }
    reply.send(error);
  });
  // Register routes
  server.register(apiKeysRoutes, { prefix: "/api/v1/api-keys" });
  server.register(commentsRoutes, { prefix: "/api/v1/comments" });
  server.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  // server.register(pollsRoutes, { prefix: "/api/v1/polls" });
  server.register(registerRoutes, { prefix: "/api/v1/register" });

  // Health check route
  server.get("/health", async (request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });

  return server;
}
