import { test, expect, beforeAll, afterAll, vi } from "vitest";
import { build } from "../src/server.js";

// Mock prisma for database checks
vi.mock("../src/lib/prisma.js", () => {
  const mockPrisma = {
    $queryRaw: vi.fn(),
    // Add other prisma client methods if they are used in the server.ts and need to be mocked
  };
  return {
    prisma: mockPrisma,
    prismaPlugin: async (fastify, opts) => {
      fastify.decorate("prisma", mockPrisma);
    },
  };
});

let server;

// Mock authMiddleware for detailed health check
vi.mock("../src/middleware/auth.js", () => ({
  authMiddleware: vi.fn(async (request, reply) => {
    if (request.headers["x-api-key"] === "valid-api-key") {
      return;
    } else {
      throw new Error("Unauthorized");
    }
  }),
}));

beforeAll(async () => {
  server = await build();
  await server.listen({ port: 0 }); // Listen on a random available port
});

afterAll(async () => {
  await server.close();
});

test("GET /health should return 200 for liveness probe", async () => {
  const response = await server.inject({
    method: "GET",
    url: "/health",
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(expect.objectContaining({ status: "ok", uptime: expect.any(Number) }));
});

test("GET /health/live should return 200 for liveness probe", async () => {
  const response = await server.inject({
    method: "GET",
    url: "/health/live",
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(expect.objectContaining({ status: "ok", uptime: expect.any(Number) }));
});

test("GET /health/ready should return 200 when database is connected", async () => {
  prisma.$queryRaw.mockResolvedValueOnce([{}]); // Simulate successful DB connection
  const response = await server.inject({
    method: "GET",
    url: "/health/ready",
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(expect.objectContaining({ status: "ok", database: { status: "ok" } }));
});

test("GET /health/ready should return 503 when database is disconnected", async () => {
  prisma.$queryRaw.mockRejectedValueOnce(new Error("DB connection failed")); // Simulate failed DB connection
  const response = await server.inject({
    method: "GET",
    url: "/health/ready",
  });
  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual(expect.objectContaining({
    status: "service unavailable",
    database: { status: "error", error: "DB connection failed" },
    message: "Database connection failed.",
  }));
});

test("GET /health/detailed should return 401 if not authenticated", async () => {
  const response = await server.inject({
    method: "GET",
    url: "/health/detailed",
  });
  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual({ message: "Unauthorized" });
});

test("GET /health/detailed should return 200 with detailed info if authenticated and healthy", async () => {
  prisma.$queryRaw.mockResolvedValueOnce([{}]); // Simulate successful DB connection
  const response = await server.inject({
    method: "GET",
    url: "/health/detailed",
    headers: {
      "x-api-key": "valid-api-key",
    },
  });
  expect(response.statusCode).toBe(200);
  const payload = response.json();
  expect(payload).toEqual(expect.objectContaining({
    status: "ok",
    database: { status: "ok" },
    prismaConnectionPool: expect.any(Object),
    memoryUsage: expect.any(Object),
    requestQueue: expect.any(Object),
    rateLimit: expect.any(Object),
    uptime: expect.any(Number),
  }));
  expect(payload.prismaConnectionPool.note).toBe("Prisma does not expose direct connection pool metrics.");
  expect(payload.requestQueue.note).toBe("Fastify does not expose direct request queue depth.");
});

test("GET /health/detailed should return 503 with detailed info if authenticated and unhealthy", async () => {
  prisma.$queryRaw.mockRejectedValueOnce(new Error("DB connection failed")); // Simulate failed DB connection
  const response = await server.inject({
    method: "GET",
    url: "/health/detailed",
    headers: {
      "x-api-key": "valid-api-key",
    },
  });
  expect(response.statusCode).toBe(503);
  const payload = response.json();
  expect(payload).toEqual(expect.objectContaining({
    status: "service unavailable",
    database: { status: "error", error: "DB connection failed" },
    prismaConnectionPool: expect.any(Object),
    memoryUsage: expect.any(Object),
    requestQueue: expect.any(Object),
    rateLimit: expect.any(Object),
    message: "One or more services are unhealthy.",
  }));
});
