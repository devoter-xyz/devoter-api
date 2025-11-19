import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./prisma.js";

interface ApiKeyUsageEvent {
  apiKeyId: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
}

const usageBuffer: ApiKeyUsageEvent[] = [];
const BATCH_SIZE = 10; // Number of events to buffer before writing to DB
const BATCH_INTERVAL_MS = 5000; // Maximum time to wait before flushing buffer (5 seconds)

let flushTimeout: NodeJS.Timeout | null = null;

async function flushUsageBuffer() {
  if (usageBuffer.length === 0) {
    return;
  }

  const eventsToFlush = [...usageBuffer];
  usageBuffer.length = 0; // Clear the buffer

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  try {
    await prisma.apiKeyUsage.createMany({
      data: eventsToFlush.map(event => ({
        apiKeyId: event.apiKeyId,
        endpoint: event.endpoint,
        statusCode: event.statusCode,
        responseTime: event.responseTime,
      })),
    });
    console.log(`Flushed ${eventsToFlush.length} API key usage events.`);
  } catch (error) {
    console.error("Failed to flush API key usage events:", error);
    // Optionally, re-add events to buffer or log to a dead-letter queue
  }
}

export function recordApiKeyUsage(
  request: FastifyRequest,
  reply: FastifyReply,
  startTime: number
) {
  if (request.user && request.user.apiKeyId) {
    const responseTime = Date.now() - startTime;
    const event: ApiKeyUsageEvent = {
      apiKeyId: request.user.apiKeyId,
      endpoint: request.url,
      statusCode: reply.statusCode,
      responseTime: responseTime,
    };
    usageBuffer.push(event);

    if (usageBuffer.length >= BATCH_SIZE) {
      flushUsageBuffer();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(flushUsageBuffer, BATCH_INTERVAL_MS);
    }
  }
}

// Ensure any remaining events are flushed when the process exits
process.on('beforeExit', async () => {
  if (usageBuffer.length > 0) {
    console.log("Flushing remaining API key usage events before exit...");
    await flushUsageBuffer();
  }
});
