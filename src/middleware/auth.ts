import { FastifyRequest, FastifyReply } from "fastify";
import { verifySignature } from "../utils/verifySignature.js";

// Minimal middleware to verify signed messages from request body
export async function verifyWalletSignature(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { walletAddress, message, signature } = request.body as any;

  if (!walletAddress || !message || !signature) {
    return reply
      .status(400)
      .send({
        success: false,
        error: "Missing walletAddress, message, or signature",
      });
  }

  const isValid = verifySignature(message, signature, walletAddress);
  if (!isValid) {
    return reply
      .status(401)
      .send({ success: false, error: "Invalid signature" });
  }
  // If valid, continue
}
