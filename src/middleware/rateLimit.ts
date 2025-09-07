import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Rate limiting configuration for different endpoint types
 */
export const rateLimitConfigs = {
  // General API rate limit (most endpoints)
  general: {
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '100'), // 100 requests
    timeWindow: 60 * 1000, // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Authentication endpoints (stricter limits)
  auth: {
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10'), // 10 requests
    timeWindow: 60 * 1000, // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // API key creation (very strict)
  apiKeyCreation: {
    max: parseInt(process.env.RATE_LIMIT_API_KEY_CREATION_MAX || '3'), // 3 API key creations
    timeWindow: 60 * 1000, // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Registration (moderate limits)
  registration: {
    max: parseInt(process.env.RATE_LIMIT_REGISTRATION_MAX || '5'), // 5 registration attempts
    timeWindow: 60 * 1000, // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Health checks (more lenient)
  health: {
    max: parseInt(process.env.RATE_LIMIT_HEALTH_MAX || '200'), // 200 requests
    timeWindow: 60 * 1000, // per minute
    skipSuccessfulRequests: true,
    skipOnError: true,
  }
};

/**
 * Custom error response for rate limit exceeded
 */
export const rateLimitErrorHandler = (request: FastifyRequest, context: any) => {
  return {
    statusCode: 429,
    error: 'Rate limit exceeded',
    message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    retryAfter: Math.ceil(context.ttl / 1000)
  };
};

/**
 * Key generator for rate limiting - uses IP + wallet address if available
 */
export const rateLimitKeyGenerator = (request: FastifyRequest) => {
  const ip = request.ip;
  let walletAddress: string | undefined;
  if (request.body && typeof request.body === 'object' && 'walletAddress' in request.body) {
    walletAddress = (request.body as any).walletAddress;
  }
  if (!walletAddress && request.headers['x-wallet-address']) {
    walletAddress = String(request.headers['x-wallet-address']);
  }
  // If wallet address is available, use IP + wallet for more granular control
  if (walletAddress) {
    return `${ip}:${walletAddress.toLowerCase()}`;
  }
  // Fallback to just IP
  return ip;
};

/**
 * Register rate limiting plugin with different configurations
 */
export async function registerRateLimiting(fastify: FastifyInstance) {
  // Register the rate limit plugin
  await fastify.register(import('@fastify/rate-limit'), {
    global: false, // We'll apply different limits per route
    errorResponseBuilder: rateLimitErrorHandler,
    keyGenerator: rateLimitKeyGenerator,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    }
  });
}

/**
 * Create rate limit preHandler for specific configurations
 */
export function createRateLimitHandler(config: typeof rateLimitConfigs.general) {
  return {
    config,
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
      // You can add custom logic here if needed
      return;
    }
  };
}
