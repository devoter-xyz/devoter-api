
import fastify from "fastify";
import { config } from "dotenv";
import {
  registerRateLimiting,
  rateLimitConfigs,
  createRateLimitHandler,
} from "./middleware/rateLimit.js";
import errorPlugin from "./plugins/errorPlugin.js";
import requestTimingPlugin from "./plugins/requestTiming.js";
import apiKeysRoutes from "./routes/apiKeys.js";
import commentsRoutes from "./routes/comments.js";
import notificationsRoutes from "./routes/notifications.js";
import pollsRoutes from "./routes/polls.js";
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

  // Register plugins
  await server.register(errorPlugin);
  await server.register(requestTimingPlugin);
  await server.register(prismaPlugin);

  // Register middleware
  server.addHook("onRequest", authMiddleware);

  // Register rate limiting
  await registerRateLimiting(server, rateLimitConfigs);
  server.setErrorHandler(createRateLimitHandler(server));

  // Register routes
  server.register(apiKeysRoutes, { prefix: "/api/v1/api-keys" });
  server.register(commentsRoutes, { prefix: "/api/v1/comments" });
  server.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  server.register(pollsRoutes, { prefix: "/api/v1/polls" });
  server.register(registerRoutes, { prefix: "/api/v1/register" });

  return server;
}
