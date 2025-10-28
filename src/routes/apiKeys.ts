import type { FastifyInstance } from "fastify";
import { verifyWalletSignature, verifyWalletSignatureFromHeaders } from "../middleware/auth.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import * as Type from "@sinclair/typebox";
import {
  generateUniqueApiKey,
  hashApiKey,
  maskApiKey,
} from "../utils/generateApiKey.js";
import {
  ApiError,
  asyncHandler,
  HttpStatusCode,
} from "../utils/errorHandler.js";
import { prisma } from "../lib/prisma.js";

export default async function apiKeysRoute(fastify: FastifyInstance) {
  // POST /api-keys - Create a new API key
  fastify.post("/api-keys", {
    schema: {
      body: Type.Object({
        walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
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
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
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
    preHandler: verifyWalletSignatureFromHeaders,
    handler: asyncHandler(async (request, reply) => {
      const walletAddress = (request.headers["x-wallet-address"] as string).trim().toLowerCase();

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
      interface ApiKeyResponse {
        id: string;
        key: string;
        createdAt: string;
        totalUsed?: number;
        status: string;
      }

      const apiKeys: ApiKeyResponse[] = user.apiKeys.map((key: {
        id: string;
        key: string;
        createdAt: Date;
        totalUsed?: number;
        status: string;
      }): ApiKeyResponse => {
        const apiKeyObj: ApiKeyResponse = {
          id: key.id,
          key: maskApiKey(key.key),
          createdAt: key.createdAt.toISOString(),
          status: key.status,
        };
        if (key.totalUsed !== undefined) {
          apiKeyObj.totalUsed = key.totalUsed;
        }
        return apiKeyObj;
      });

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        apiKeys,
      });
    }),
  });

  // GET /api-keys/metadata - Get non-sensitive metadata for all API keys for a wallet
  fastify.get("/api-keys/metadata", {
    schema: {
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          apiKeys: Type.Array(
            Type.Object({
              id: Type.String(),
              createdAt: Type.String(),
              scopes: Type.Optional(Type.Array(Type.String())),
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
    preHandler: verifyWalletSignatureFromHeaders,
    handler: asyncHandler(async (request, reply) => {
      const walletAddress = (request.headers["x-wallet-address"] as string).trim().toLowerCase();

      const user = await prisma.apiUser.findUnique({
        where: { walletAddress },
        include: {
          apiKeys: {
            select: {
              id: true,
              createdAt: true,
              scopes: true, // Assuming 'scopes' field exists in your Prisma model
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        throw ApiError.notFound("User not found", "USER_NOT_FOUND");
      }

      const apiKeysMetadata = user.apiKeys.map((key) => ({
        id: key.id,
        createdAt: key.createdAt.toISOString(),
        scopes: key.scopes || [], // Provide an empty array if scopes is null/undefined
      }));

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        apiKeys: apiKeysMetadata,
      });
    }),
  });
}
