
import { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000; // 1 second

async function initializePrismaWithRetries(retries = MAX_RETRIES): Promise<PrismaClient> {
  try {
    const client = new PrismaClient();
    await client.$connect();
    console.log("Prisma client connected successfully.");
    return client;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Prisma client connection failed. Retrying in ${RETRY_DELAY_MS / 1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return initializePrismaWithRetries(retries - 1);
    } else {
      console.error("Failed to connect Prisma client after multiple retries.", error);
      throw error;
    }
  }
}

export const prisma: PrismaClient = globalForPrisma.prisma || (await initializePrismaWithRetries());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const prismaPlugin: FastifyPluginAsync = async (server) => {
  server.decorate("prisma", prisma);
  server.addHook("onClose", async () => {
    server.log.info("Disconnecting Prisma client...");
    await server.prisma.$disconnect();
    server.log.info("Prisma client disconnected.");
  });
};
