import { FastifyInstance } from 'fastify';
import { ApiUser } from '@prisma/client';
import { verifyWalletSignature, verifyWalletSignatureFromHeaders } from "../middleware/auth.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import * as Type from "@sinclair/typebox";
import {
  generateUniqueApiKey,
  hashApiKey,
  maskApiKey,
  ApiKeyData,
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
          createdAt: Type.Number(),
          algorithm: Type.String(),
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
              enabled: true,
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
      const { key: newApiKey, createdAt, algorithm } = generateUniqueApiKey(user.id);
      const hashedKey = hashApiKey(newApiKey);

      // Store the API key in database
      const createdApiKey = await prisma.apiKey.create({
        data: {
          userId: user.id,
          key: hashedKey, // Store hashed version
          hash: hashedKey, // Also store in hash field as per schema
          enabled: true,
          createdAt: new Date(createdAt),
          algorithm: algorithm,
        },
      });

      request.log.info({
        userId: user.id,
        keyId: createdApiKey.id,
        createdAt: createdAt,
        algorithm: algorithm,
        correlationId: request.correlationId,
        operation: 'apiKey.create',
        outcome: 'success',
        message: 'API key created successfully',
      });

      return reply.status(HttpStatusCode.CREATED).send({
        success: true,
        apiKey: newApiKey, // Return the actual key (only time it's shown)
        keyId: createdApiKey.id,
        message: "API key created successfully",
        createdAt: createdAt,
        algorithm: algorithm,
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
              enabled: Type.Boolean(),
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
        request.log.warn({
          walletAddress: walletAddress,
          correlationId: request.correlationId,
          operation: 'apiKey.retrieve',
          outcome: 'failure',
          reason: 'User not found',
          message: 'Attempted to retrieve API keys for a non-existent user',
        });
        throw ApiError.notFound("User not found", "USER_NOT_FOUND");
      }

      request.log.info({
        userId: user.id,
        walletAddress: walletAddress,
        correlationId: request.correlationId,
        operation: 'apiKey.retrieve',
        outcome: 'success',
        message: 'Successfully retrieved API keys for user',
      });

      // Return masked API keys with metadata
      interface ApiKeyResponse {
        id: string;
        key: string;
        createdAt: string;
        totalUsed?: number;
        enabled: boolean;
      }

      const apiKeys: ApiKeyResponse[] = user.apiKeys.map((key: any) => {
        const apiKeyObj: ApiKeyResponse = {
          id: key.id,
          key: maskApiKey(key.key),
          createdAt: key.createdAt.toISOString(),
          enabled: key.enabled,
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

      const user: (ApiUser & { apiKeys: ApiKeyMetadata[] }) | null = await prisma.apiUser.findUnique({
        where: { walletAddress },
        include: {
          apiKeys: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        request.log.warn({
          walletAddress: walletAddress,
          correlationId: request.correlationId,
          operation: 'apiKey.retrieveMetadata',
          outcome: 'failure',
          reason: 'User not found',
          message: 'Attempted to retrieve API key metadata for a non-existent user',
        });
        throw ApiError.notFound("User not found", "USER_NOT_FOUND");
      }

      request.log.info({
        userId: user.id,
        walletAddress: walletAddress,
        correlationId: request.correlationId,
        operation: 'apiKey.retrieveMetadata',
        outcome: 'success',
        message: 'Successfully retrieved API key metadata for user',
      });

      interface ApiKeyMetadata {
        id: string;
        createdAt: Date;
      }

      const apiKeysMetadata = user.apiKeys.map((key: ApiKeyMetadata) => ({
        id: key.id,
        createdAt: key.createdAt.toISOString(),
      }));

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        apiKeys: apiKeysMetadata,
      });
    }),
  });

  // POST /api-keys/:id/rotate - Rotate an existing API key
  fastify.post<{ 
    Params: { id: string };
    Headers: { 'x-wallet-address': string; 'x-message': string; 'x-signature': string };
  }>("/api-keys/:id/rotate", {
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
          apiKey: Type.String(),
          keyId: Type.String(),
          createdAt: Type.Number(),
          algorithm: Type.String(),
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
      rateLimit: rateLimitConfigs.apiKeyCreation, // Using apiKeyCreation limit for rotation
    },
    preHandler: verifyWalletSignatureFromHeaders,
    handler: asyncHandler(async (request, reply) => {
      const { id: apiKeyId } = request.params;
      const walletAddress = (request.headers["x-wallet-address"] as string).trim().toLowerCase();

      // Find the user
      const user = await prisma.apiUser.findUnique({
        where: { walletAddress },
      });

      if (!user) {
        request.log.warn({
          apiKeyId: apiKeyId,
          walletAddress: walletAddress,
          correlationId: request.correlationId,
          operation: 'apiKey.rotate',
          outcome: 'failure',
          reason: 'User not found',
          message: 'Attempted to rotate API key for a non-existent user',
        });
        throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
      }

      // Find the API key to rotate
      const existingApiKey = await prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId: user.id,
          enabled: true, // Only rotate enabled keys
        },
      });

      if (!existingApiKey) {
        request.log.warn({
          userId: user.id,
          apiKeyId: apiKeyId,
          correlationId: request.correlationId,
          operation: 'apiKey.rotate',
          outcome: 'failure',
          reason: 'API key not found or already revoked',
          message: 'Attempted to rotate a non-existent or revoked API key',
        });
        throw ApiError.notFound("API key not found or already revoked.", "API_KEY_NOT_FOUND");
      }

      // Generate a new API key and a single timestamp for both key and metadata
      const createdAtTimestamp = Date.now();
      const { key: newApiKey, createdAt, algorithm } = generateUniqueApiKey(user.id, 'dv', createdAtTimestamp);
      const hashedKey = hashApiKey(newApiKey);

      // Perform revocation and creation in a single transaction
      const [_, createdApiKey] = await prisma.$transaction(async (tx) => {
        // Revoke the old key
        const updatedKey = await tx.apiKey.update({
          where: { id: existingApiKey.id },
          data: {
            enabled: false,
            rotatedAt: new Date(createdAtTimestamp),
          },
        });

        // Store the new API key in database
        const newKey = await tx.apiKey.create({
          data: {
            userId: user.id,
            key: hashedKey,
            hash: hashedKey,
            enabled: true,
            createdAt: new Date(createdAt), // Use the createdAt from generateUniqueApiKey
            algorithm: algorithm,
          },
        });
        return [updatedKey, newKey];
      });

      request.log.info({
        userId: user.id,
        oldKeyId: existingApiKey.id,
        newKeyId: createdApiKey.id,
        createdAt: createdAt,
        algorithm: algorithm,
        correlationId: request.correlationId,
        operation: 'apiKey.rotate',
        outcome: 'success',
        message: 'API key rotated successfully',
      });

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        apiKey: newApiKey,
        keyId: createdApiKey.id,
        createdAt: createdAt,
        algorithm: algorithm,
        message: "API key rotated successfully",
      });
    }),
  });

  // DELETE /api-keys/:id - Revoke an existing API key
  fastify.delete<{ 
    Params: { id: string };
    Headers: { 'x-wallet-address': string; 'x-message': string; 'x-signature': string };
  }>("/api-keys/:id", {
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
      rateLimit: rateLimitConfigs.general,
    },
    preHandler: verifyWalletSignatureFromHeaders,
    handler: asyncHandler(async (request, reply) => {
      const { id: apiKeyId } = request.params;
      const walletAddress = (request.headers["x-wallet-address"] as string).trim().toLowerCase();

      const user = await prisma.apiUser.findUnique({
        where: { walletAddress },
      });

      if (!user) {
        request.log.warn({
          apiKeyId: apiKeyId,
          walletAddress: walletAddress,
          correlationId: request.correlationId,
          operation: 'apiKey.revoke',
          outcome: 'failure',
          reason: 'User not found',
          message: 'Attempted to revoke API key for a non-existent user',
        });
        throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
      }

      const existingApiKey = await prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId: user.id,
          enabled: true,
        },
      });

      if (!existingApiKey) {
        request.log.warn({
          userId: user.id,
          apiKeyId: apiKeyId,
          correlationId: request.correlationId,
          operation: 'apiKey.revoke',
          outcome: 'failure',
          reason: 'API key not found or already revoked',
          message: 'Attempted to revoke a non-existent or already revoked API key',
        });
        throw ApiError.notFound("API key not found or already revoked.", "API_KEY_NOT_FOUND");
      }

      await prisma.apiKey.update({
        where: { id: existingApiKey.id },
        data: {
          enabled: false,
          revokedAt: new Date(),
        },
      });

      request.log.info({
        userId: user.id,
        apiKeyId: existingApiKey.id,
        correlationId: request.correlationId,
        operation: 'apiKey.revoke',
        outcome: 'success',
        message: 'API key revoked successfully',
      });

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        message: "API key revoked successfully",
      });
    }),
  });
}
