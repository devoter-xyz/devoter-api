import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySignatureWithTimestamp } from "../utils/verifySignature.js";
import { validateWalletAuthInput } from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";

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
  const { walletAddress, message, signature } = request.body as Record<string, unknown>;
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
  const { isValid, error } = verifySignatureWithTimestamp(
    message,
    signature,
    walletAddress,
    5 // maxAgeMinutes; consider making this configurable
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
