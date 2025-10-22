import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySignatureWithTimestamp } from "../utils/verifySignature.js";
import { validateWalletAuthInput } from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import { PrismaClient } from "@prisma/client";
import { hashApiKey } from "../utils/generateApiKey.js";

const prisma = new PrismaClient();

/**
 * Extracts a Bearer token from the Authorization header.
 * @param header The Authorization header string.
 * @returns The extracted token string, or null if not found or malformed.
 */
export function extractBearerToken(header: string): string | null {
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1] as string;
  }
  return null;
}

/**
 * Validates the basic format of an API key.
 * @param token The API key string.
 * @returns True if the format is valid, false otherwise.
 */
export function isValidApiKeyFormat(token: string): boolean {
  // Example: Basic check for length and character set. Adjust as per actual API key format.
  return typeof token === 'string' && token.length > 30 && /^[a-zA-Z0-9\-_.]+$/.test(token);
}

// Enhanced middleware with comprehensive input validation
export async function verifyWalletSignature(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Validate input structure and format
  if (!request.body || typeof request.body !== 'object') {
    throw ApiError.badRequest(
      "Missing or invalid request body",
      "INVALID_AUTH_INPUT"
    );
  }
  const validation = validateWalletAuthInput(request.body);
  if (!validation.isValid) {
    throw ApiError.badRequest(
      validation.error || "Invalid wallet authentication input",
      "INVALID_AUTH_INPUT"
    );
  }

  // Type guard for request.body
  const { walletAddress, message, signature } = request.body as { walletAddress: string; message: string; signature: string };
  if (
    typeof walletAddress !== 'string' ||
    typeof message !== 'string' ||
    typeof signature !== 'string'
  ) {
    throw ApiError.badRequest(
      "walletAddress, message, and signature must be strings",
      "INVALID_AUTH_INPUT"
    );
  }

  // Verify signature and freshness (prevents replay)
  const MAX_SIGNATURE_AGE_MINUTES = parseInt(process.env.MAX_SIGNATURE_AGE_MINUTES || '5', 10);
  const { isValid, error } = verifySignatureWithTimestamp(
    message,
    signature,
    walletAddress,
    MAX_SIGNATURE_AGE_MINUTES
  );
  if (!isValid) {
    throw ApiError.unauthorized(
      "Invalid or expired wallet signature",
      "INVALID_SIGNATURE",
      error ? { reason: error } : undefined
    );
  }
  // If all validation passes, continue
}

// Extend FastifyRequest to include a user property for authenticated API key users
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      apiUserId: string;
      apiKeyId: string;
    };
  }
}

/**
 * Middleware to verify API key from Authorization header.
 * Extracts, validates, and authenticates the API key against the database.
 * Attaches user information to request.user if authentication is successful.
 * @param request FastifyRequest instance.
 * @param reply FastifyReply instance.
 * @param done Callback to continue request processing.
 */
export async function verifyApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  // 1. Defensive check for missing Authorization header
  if (!authHeader) {
    throw ApiError.unauthorized(
      "Authorization header missing",
      "MISSING_AUTH_HEADER"
    );
  }

  // 2. Extract token using helper function
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw ApiError.unauthorized(
      "Malformed Authorization header. Expected Bearer token.",
      "MALFORMED_AUTH_HEADER"
    );
  }

  // 3. Validate API key format using helper function
  if (!isValidApiKeyFormat(token)) {
    throw ApiError.unauthorized(
      "Invalid API key format",
      "INVALID_API_KEY_FORMAT"
    );
  }

  // 4. Hash the incoming token for database lookup
  const hashedToken = hashApiKey(token);

  // 5. Look up the API key in the database
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: {
      key: hashedToken,
      status: "ACTIVE", // Ensure the API key is active
    },
    include: {
      apiUser: true, // Include the associated user
    },
  });

  // 6. Validate if API key exists and is active
  if (!apiKeyRecord || !apiKeyRecord.apiUser) {
    throw ApiError.unauthorized(
      "Invalid or inactive API key",
      "INVALID_API_KEY"
    );
  }

  // 7. Attach user and API key information to the request for subsequent handlers
  request.user = {
    apiUserId: apiKeyRecord.apiUserId,
    apiKeyId: apiKeyRecord.id,
  };

  // If all checks pass, the request can proceed
}
