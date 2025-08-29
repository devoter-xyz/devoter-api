import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySignature } from "../utils/verifySignature.js";
import { validateWalletAuthInput } from "../utils/validation.js";

// Enhanced middleware with comprehensive input validation
export async function verifyWalletSignature(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Validate input structure and format
  const validation = validateWalletAuthInput(request.body);
  if (!validation.isValid) {
    return reply.status(400).send({
      success: false,
      error: validation.error,
    });
  }

  const { walletAddress, message, signature } = request.body as {
    walletAddress: string;
    message: string;
    signature: string;
  };

  // Verify the signature
  const isValid = verifySignature(message, signature, walletAddress);
  if (!isValid) {
    return reply.status(401).send({
      success: false,
      error: "Invalid signature",
    });
  }

  // If all validation passes, continue
}
