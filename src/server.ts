
import fastify from "fastify";
import { config } from "dotenv";
import cors from '@fastify/cors';
import { corsOptions, validateCorsConfig } from './config/cors.js';
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
import rateLimitMetricsRoutes from "./routes/rateLimitMetrics.js";
import { authMiddleware } from "./middleware/auth.js";
import { correlationIdMiddleware } from "./middleware/correlationId.js";
import { prismaPlugin, prisma } from "./lib/prisma.js";
import { getRateLimitAnalytics } from "./lib/rateLimitAnalytics.js";
import { recordApiKeyUsage } from "./lib/apiKeyUsageTracker.js";

config();

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV !== "production") {
      console.error("Database connection error:", errorMessage);
    }
    return { status: "error", error: "database unavailable" };
  }
}



function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`, // Resident Set Size
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`, // Total size of the allocated heap
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`, // Actual memory used during the execution
    external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`, // Memory used by C++ objects bound to JavaScript objects
  };
}

function getRequestQueueDepth() {
  // Fastify does not directly expose a request queue depth.
  // This would require custom instrumentation if needed.
  return { depth: 0, note: "Fastify does not expose direct request queue depth." };
}

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
      server.log.error(`Configuration Error: Missing required environment variable '${envVar}'. Please ensure it is set in your .env file or environment.`);
      process.exit(1);
    }
  }

  validateCorsConfig();

  // Register plugins
  await server.register(errorPlugin);
  await server.register(requestTimingPlugin);
  await server.register(cors, corsOptions);
  await server.register(prismaPlugin);

  // Register middleware
  server.addHook("onRequest", (request, reply, done) => {
    request.startTime = Date.now();
    done();
  });
  server.addHook("onRequest", correlationIdMiddleware);
  server.addHook("onRequest", authMiddleware);

  server.addHook("onResponse", (request, reply, done) => {
    if (request.startTime) {
      recordApiKeyUsage(request, reply, request.startTime);
    }
    done();
  });

  // Register rate limiting
  await registerRateLimiting(server);
  server.setErrorHandler((error, request, reply) => {
    if ((error as any).statusCode === 429) {
      return reply.status(429).send(rateLimitErrorHandler(request, error));
    }
    if (error.message === 'Not allowed by CORS') {
      return reply.status(403).send({ message: 'Forbidden: Not allowed by CORS' });
    }
    reply.send(error);
  });
  // Register routes
  server.register(apiKeysRoutes, { prefix: "/api/v1/api-keys" });
  server.register(commentsRoutes, { prefix: "/api/v1/comments" });
  server.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  // server.register(pollsRoutes, { prefix: "/api/v1/polls" });
  server.register(registerRoutes, { prefix: "/api/v1/register" });

  // Health check route (liveness probe)
  server.get("/health", async (request, reply) => {
    return reply.status(200).send({ status: "ok", uptime: process.uptime() });
  });

  // Liveness probe
  server.get("/health/live", async (request, reply) => {
    return reply.status(200).send({ status: "ok", uptime: process.uptime() });
  });

  // Readiness probe
  server.get("/health/ready", async (request, reply) => {
    const dbStatus = await checkDatabaseConnection();
    const isReady = dbStatus.status === "ok";

    if (isReady) {
      return reply.status(200).send({ status: "ok", database: dbStatus });
    } else {
      reply.status(503).send({
        status: "service unavailable",
        database: dbStatus,
        message: "Database connection failed.",
      });
    }
  });

  // Detailed health check (requires authentication)
  server.get("/health/detailed", { onRequest: [authMiddleware] }, async (request, reply) => {
    const dbStatus = await checkDatabaseConnection();
    const memoryUsage = getMemoryUsage();
    const rateLimit = getRateLimitAnalytics();

    const isHealthy = dbStatus.status === "ok";

    if (isHealthy) {
      return reply.status(200).send({
        status: "ok",
        database: dbStatus,
        memoryUsage,
        rateLimit,
        uptime: process.uptime(),
      });
    } else {
      reply.status(503).send({
        status: "service unavailable",
        database: dbStatus,
        memoryUsage,
        rateLimit,
        message: "One or more services are unhealthy.",
      });
    }
  });

  // Metrics route
  server.get("/metrics", async (request, reply) => {
    const snapshot = server.getMetricsSnapshot();
    return snapshot;
  });

  server.register(rateLimitMetricsRoutes, { prefix: "/metrics" });

  return server;
}
