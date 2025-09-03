import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { verifyWalletSignature } from "../middleware/auth.js";
import {
  generateUniqueApiKey,
  hashApiKey,
  maskApiKey,
} from "../utils/generateApiKey.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import { Type } from "@sinclair/typebox";
import {
  ApiError,
  asyncHandler,
  HttpStatusCode,
} from "../utils/errorHandler.js";

const prisma = new PrismaClient();

export default async function apiKeysRoute(fastify: FastifyInstance) {
  // POST /api-keys - Create a new API key
  fastify.post("/api-keys", {
    schema: {
      body: Type.Object({
        walletAddress: Type.RegExp(/^0x[a-fA-F0-9]{40}$/),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.RegExp(/^0x[a-fA-F0-9]{130}$/),
      }),
      response: {
        201: Type.Object({
          success: Type.Literal(true),
          apiKey: Type.String(),
          keyId: Type.String(),
          message: Type.String(),
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
      },
    },
    config: {
      rateLimit: rateLimitConfigs.apiKeyCreation,
    },
    preHandler: verifyWalletSignature,
    handler: asyncHandler(async (request, reply) => {
      const { walletAddress } = request.body as {
        walletAddress: string;
        message: string;
        signature: string;
      };

      // Find the user
      const user = await prisma.apiUser.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
        include: {
          apiKeys: {
            where: {
              status: "ACTIVE",
            },
          },
        },
      });

      if (!user) {
        throw ApiError.notFound(
          "User not found. Please register first.",
          "USER_NOT_FOUND"
        );
      }

      // Check if user already has 3 active API keys
      if (user.apiKeys.length >= 3) {
        throw ApiError.badRequest(
          "Maximum API key limit reached. You can have up to 3 active API keys.",
          "MAX_API_KEYS_REACHED",
          { limit: 3, current: user.apiKeys.length }
        );
      }

      // Generate new API key
      const newApiKey = generateUniqueApiKey(user.id);
      const hashedKey = hashApiKey(newApiKey);

      // Store the API key in database
      const createdApiKey = await prisma.apiKey.create({
        data: {
          apiUserId: user.id,
          key: hashedKey, // Store hashed version
          status: "ACTIVE",
        },
      });

      return reply.status(HttpStatusCode.CREATED).send({
        success: true,
        apiKey: newApiKey, // Return the actual key (only time it's shown)
        keyId: createdApiKey.id,
        message: "API key created successfully",
      });
    }),
  });

  // GET /api-keys - Get all API keys for a wallet
  fastify.get("/api-keys", {
    schema: {
      headers: Type.Object(
        {
          "x-wallet-address": Type.RegExp(/^0x[a-fA-F0-9]{40}$/),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.RegExp(/^0x[a-fA-F0-9]{130}$/),
        },
        { additionalProperties: true }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          apiKeys: Type.Array(
            Type.Object({
              id: Type.String(),
              key: Type.String(),
              createdAt: Type.String(),
              totalUsed: Type.Optional(Type.Number()),
              status: Type.String(),
            })
          ),
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
      },
    },
    config: {
      rateLimit: rateLimitConfigs.general,
    },
    preHandler: asyncHandler(async (request, reply) => {
      // Custom validation for GET request with headers
      const walletAddress = request.headers["x-wallet-address"] as string;
      const message = request.headers["x-message"] as string;
      const signature = request.headers["x-signature"] as string;

      if (!walletAddress || !message || !signature) {
        throw ApiError.badRequest(
          "Missing required headers: x-wallet-address, x-message, x-signature",
          "MISSING_AUTH_HEADERS"
        );
      }

      // Create a fake body for the middleware
      request.body = { walletAddress, message, signature };

      // Call the wallet signature verification
      return verifyWalletSignature(request, reply);
    }),
    handler: asyncHandler(async (request, reply) => {
      const walletAddress = request.headers["x-wallet-address"] as string;

      // Find the user and their API keys
      const user = await prisma.apiUser.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
        include: {
          apiKeys: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        throw ApiError.notFound("User not found", "USER_NOT_FOUND");
      }

      // Return masked API keys with metadata
      const apiKeys = user.apiKeys.map((key) => ({
        id: key.id,
        key: maskApiKey(key.key), // Use our utility function to mask the key
        createdAt: key.createdAt.toISOString(),
        totalUsed: key.totalUsed,
        status: key.status,
      }));

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        apiKeys,
      });
    }),
  });
}
