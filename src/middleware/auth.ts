import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySignatureWithTimestamp } from "../utils/verifySignature.js";
import { validateWalletAuthInput } from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import { extractBearerToken } from "../utils/auth.js";
import { hashApiKey, isValidApiKeyFormat } from "../utils/generateApiKey.js";
import { prisma } from "../lib/prisma.js";

/**
 * Extracts a Bearer token from the Authorization header.
 * @param header The Authorization header string.
 * @returns The extracted token string, or null if not found or malformed.
 */
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

export async function verifyWalletSignatureFromHeaders(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const walletAddress = request.headers["x-wallet-address"] as string;
  const message = request.headers["x-message"] as string;
  const signature = request.headers["x-signature"] as string;

  if (!walletAddress || !message || !signature) {
    throw ApiError.badRequest(
      "Missing required headers: x-wallet-address, x-message, x-signature",
      "MISSING_AUTH_HEADERS"
    );
  }

  // Create a temporary body object for validation, similar to how verifyWalletSignature expects it
  const tempBody = { walletAddress, message, signature };

  const validation = validateWalletAuthInput(tempBody);
  if (!validation.isValid) {
    throw ApiError.badRequest(
      validation.error || "Invalid wallet authentication input in headers",
      "INVALID_AUTH_INPUT"
    );
  }

  const MAX_SIGNATURE_AGE_MINUTES = parseInt(process.env.MAX_SIGNATURE_AGE_MINUTES || '5', 10);
  const { isValid, error } = verifySignatureWithTimestamp(
    message,
    signature,
    walletAddress,
    MAX_SIGNATURE_AGE_MINUTES
  );
  if (!isValid) {
    throw ApiError.unauthorized(
      "Invalid or expired wallet signature from headers",
      "INVALID_SIGNATURE",
      error ? { reason: error } : undefined
    );
  }
  // If all validation passes, continue
}

// Middleware to determine authentication strategy
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.headers.authorization) {
    await verifyApiKey(request, reply);
  } else if (request.headers['x-wallet-address'] && request.headers['x-message'] && request.headers['x-signature']) {
    await verifyWalletSignatureFromHeaders(request, reply);
  } else {
    // If no auth headers are present, allow the request to proceed to route handlers
    // Route handlers can then implement their own specific auth requirements
    return;
  }
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

  // Normalize the token: replace underscore delimiters with dot delimiters for backward compatibility
  let normalizedToken = token;
  if (token.includes('_')) {
    // Only replace the first two underscores (delimiters between prefix, timestamp, and random part)
    // The random part may contain underscores as it uses base64url encoding
    const parts = token.split('_');
    if (parts.length >= 3) {
      normalizedToken = `${parts[0]}.${parts[1]}.${parts.slice(2).join('_')}`;
    } else {
      normalizedToken = token.replace(/_/g, '.');
    }
    request.log.warn('Legacy API key format detected and normalized during authentication.');
  }

  // 3. Validate API key format using helper function (now with the normalized token)
  if (!isValidApiKeyFormat(normalizedToken)) {
    throw ApiError.unauthorized(
      "Invalid API key format",
      "INVALID_API_KEY_FORMAT"
    );
  }

  // 4. Hash the incoming token (now normalized) for database lookup
  const hashedToken = hashApiKey(normalizedToken);

  // 5. Look up the API key in the database
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: {
      key: hashedToken,
      enabled: true, // Ensure the API key is active
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
    apiUserId: apiKeyRecord.userId,
    apiKeyId: apiKeyRecord.id,
  };

  // If all checks pass, the request can proceed
}
