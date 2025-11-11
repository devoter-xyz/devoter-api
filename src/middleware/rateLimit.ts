
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
/**
 * Rate limiting configuration for different endpoint types
 */
/**
 * Rate limiting configuration for different endpoint types.
 *
 * Configuration options can be set via environment variables:
 * - RATE_LIMIT_<TYPE>_MAX: Maximum requests allowed (e.g., RATE_LIMIT_GENERAL_MAX)
 * - RATE_LIMIT_<TYPE>_TIMEWINDOW: Time window in milliseconds (e.g., RATE_LIMIT_GENERAL_TIMEWINDOW)
 *
 * Example:
 * ```typescript
 * // Set general rate limit to 200 requests per 30 seconds
 * process.env.RATE_LIMIT_GENERAL_MAX = '200';
 * process.env.RATE_LIMIT_GENERAL_TIMEWINDOW = '30000';
 * ```
 */
export const rateLimitConfigs = {
  // General API rate limit
  general: {
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '100'), // 100 requests
    timeWindow: parseInt(process.env.RATE_LIMIT_GENERAL_TIMEWINDOW || String(60 * 1000)), // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Authentication endpoints
  auth: {
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10'), // 10 requests
    timeWindow: parseInt(process.env.RATE_LIMIT_AUTH_TIMEWINDOW || String(60 * 1000)), // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // API key creation
  apiKeyCreation: {
    max: parseInt(process.env.RATE_LIMIT_API_KEY_CREATION_MAX || '3'), // 3 API key creations
    timeWindow: parseInt(process.env.RATE_LIMIT_API_KEY_CREATION_TIMEWINDOW || String(60 * 1000)), // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Registration
  registration: {
    max: parseInt(process.env.RATE_LIMIT_REGISTRATION_MAX || '5'), // 5 registration attempts
    timeWindow: parseInt(process.env.RATE_LIMIT_REGISTRATION_TIMEWINDOW || String(60 * 1000)), // per minute
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Health checks
  health: {
    max: parseInt(process.env.RATE_LIMIT_HEALTH_MAX || '200'), // 200 requests
    timeWindow: parseInt(process.env.RATE_LIMIT_HEALTH_TIMEWINDOW || String(60 * 1000)), // per minute
    skipSuccessfulRequests: true,
    skipOnError: true,
  }
};

/**
/**
 * Custom error response for rate limit exceeded
 */
export const rateLimitErrorHandler = (request: FastifyRequest, context: any) => {
  const retryAfter = Math.ceil(context.ttl / 1000);
  return {
    statusCode: 429,
    error: 'Rate limit exceeded',
    message: `Too many requests for ${request.url}. Try again in ${retryAfter} seconds.`,
    headers: {
      'Retry-After': retryAfter,
    },
  };
};

/**
/**
 * Key generator for rate limiting - uses IP + wallet address if available
 */
export const rateLimitKeyGenerator = (request: FastifyRequest) => {
  const ip = request.ip;
  let walletAddress: string | undefined;
  if (request.body && typeof request.body === 'object' && 'walletAddress' in request.body) {
    walletAddress = (request.body as { walletAddress?: string }).walletAddress;
  }
  if (!walletAddress && request.headers['x-wallet-address']) {
    walletAddress = String(request.headers['x-wallet-address']);
  }
  if (walletAddress) {
    return `${ip}:${walletAddress.toLowerCase()}`;
  }
  return ip;
};

/**
/**
 * Register rate limiting plugin with different configurations
 */
export async function registerRateLimiting(fastify: FastifyInstance) {
  await fastify.register(import('@fastify/rate-limit'), {
    global: false,
    errorResponseBuilder: rateLimitErrorHandler,
    keyGenerator: rateLimitKeyGenerator,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });
}

/**
/**
 * Create rate limit preHandler for specific configurations
 */
export interface RateLimitOptions {
  max?: number;
  timeWindow?: number;
  skipSuccessfulRequests?: boolean;
  skipOnError?: boolean;
}

export function createRateLimitHandler(options?: RateLimitOptions) {
  const config = {
    ...rateLimitConfigs.general, // Use general config as base
    ...options, // Override with provided options
  };

  return {
    rateLimit: config,
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
      return;
    },
  };
}
