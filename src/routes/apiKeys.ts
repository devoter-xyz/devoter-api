import { FastifyInstance } from 'fastify';
import { ApiUser } from '@prisma/client';
import { verifyWalletSignature, verifyWalletSignatureFromHeaders } from "../middleware/auth.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import * as Type from "@sinclair/typebox";
import { Static } from "@sinclair/typebox/type";
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
import { validateScopes, ALL_SCOPES } from "../utils/permissions.js";
import { getApiKeyUsageStatistics, getApiKeyUsageData, exportApiKeyUsageData } from "../utils/analytics.js";

export default async function apiKeysRoute(fastify: FastifyInstance) {

  type CreateApiKeyRequestBody = Static<typeof CreateApiKeyRequestBodySchema>;
  const CreateApiKeyRequestBodySchema = Type.Object({
    walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
    message: Type.String({ minLength: 1, maxLength: 1000 }),
    signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
    scopes: Type.Optional(Type.Array(Type.String({ enum: ALL_SCOPES }))),
  });

  type GetApiKeyUsageParams = Static<typeof GetApiKeyUsageParamsSchema>;
  const GetApiKeyUsageParamsSchema = Type.Object({
    id: Type.String(),
  });

  type GetApiKeyUsageQuery = Static<typeof GetApiKeyUsageQuerySchema>;
  const GetApiKeyUsageQuerySchema = Type.Object({
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, default: 100 })),
    offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  });

  type ExportApiKeyUsageQuery = Static<typeof ExportApiKeyUsageQuerySchema>;
  const ExportApiKeyUsageQuerySchema = Type.Object({
    format: Type.Enum(Type.Literal('csv'), Type.Literal('json')), // Use Type.Enum for literal union
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  });

  // POST /api-keys - Create a new API key
  fastify.post("/api-keys", {
    schema: {
      summary: 'Create a new API key',
      description: 'Generates a new API key for the authenticated wallet address. Each wallet can have up to 3 active API keys.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      body: Type.Object({
        walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$', description: 'The wallet address to associate with the API key.' }),
        message: Type.String({ minLength: 1, maxLength: 1000, description: 'The message signed by the wallet to prove ownership.' }),
        signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$', description: 'The signature of the message.' }),
        scopes: Type.Optional(Type.Array(Type.String({ enum: ALL_SCOPES }), { description: 'Optional: An array of scopes to grant to the API key. If omitted, the API key will have no specific scopes.' })),
      }, {
        examples: [
          {
            walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
            message: 'Sign this message to create an API key',
            signature: '0x...',
            scopes: ['read:polls', 'write:comments'],
          },
        ],
      }),
      response: {
        201: Type.Object({
          success: Type.Literal(true),
          apiKey: Type.String({ description: 'The newly generated API key. This is the only time it will be displayed.' }),
          keyId: Type.String({ description: 'The unique identifier for the API key.' }),
          message: Type.String({ description: 'A success message.' }),
          createdAt: Type.Number({ description: 'Timestamp of API key creation.' }),
          algorithm: Type.String({ description: 'The algorithm used to generate the API key.' }),
          scopes: Type.Optional(Type.Array(Type.String(), { description: 'The scopes granted to the API key.' })),
        }, {
          examples: [
            {
              success: true,
              apiKey: 'dv_test_1234567890abcdef',
              keyId: 'clx0z0z0z0000000000000000',
              message: 'API key created successfully',
              createdAt: 1678886400000,
              algorithm: 'HS256',
              scopes: ['read:polls'],
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input or maximum API key limit reached.' }),
          code: Type.String({ description: 'A specific error code (e.g., MAX_API_KEYS_REACHED, INVALID_SCOPES).', examples: ['MAX_API_KEYS_REACHED', 'INVALID_SCOPES'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Maximum API key limit reached. You can have up to 3 active API keys.',
              code: 'MAX_API_KEYS_REACHED',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating user not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., USER_NOT_FOUND).', examples: ['USER_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'User not found. Please register first.',
              code: 'USER_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
        }),
      },
    },
    config: {
      rateLimit: rateLimitConfigs.apiKeyCreation,
    },
    preHandler: verifyWalletSignature,
    handler: asyncHandler(async (request, reply) => {
      const { walletAddress, scopes: rawScopes } = request.body as CreateApiKeyRequestBody;
      const scopes = rawScopes ? validateScopes(rawScopes) : [];

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
      const { key: newApiKey, createdAt, algorithm } = generateUniqueApiKey(user.id, 'dv', undefined, scopes);
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
          scopes: scopes,
        },
      });

      request.log.info({
        userId: user.id,
        keyId: createdApiKey.id,
        createdAt: createdAt,
        algorithm: algorithm,
        scopes: scopes,
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
        scopes: scopes,
      });
    }),
  });

  // GET /api-keys - Get all API keys for a wallet
  fastify.get("/api-keys", {
    schema: {
      summary: 'Get all API keys for a wallet',
      description: 'Retrieves a list of all API keys associated with the authenticated wallet address. The API keys are masked for security.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to retrieve API keys',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          apiKeys: Type.Array(
            Type.Object({
              id: Type.String({ description: 'The unique identifier for the API key.' }),
              key: Type.String({ description: 'The masked API key.' }),
              createdAt: Type.String({ description: 'Timestamp of API key creation.' }),
              totalUsed: Type.Optional(Type.Number({ description: 'Total number of times the API key has been used.' })),
              enabled: Type.Boolean({ description: 'Whether the API key is currently enabled.' }),
              scopes: Type.Optional(Type.Array(Type.String(), { description: 'The scopes granted to the API key.' })),
            })
          ),
        }, {
          examples: [
            {
              success: true,
              apiKeys: [
                {
                  id: 'clx0z0z0z0000000000000000',
                  key: 'dv_test_********************',
                  createdAt: '2023-03-15T10:00:00.000Z',
                  totalUsed: 123,
                  enabled: true,
                  scopes: ['read:polls'],
                },
              ],
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_HEADERS).', examples: ['INVALID_HEADERS'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid wallet address header',
              code: 'INVALID_HEADERS',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating user not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., USER_NOT_FOUND).', examples: ['USER_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'User not found',
              code: 'USER_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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
        scopes?: string[];
      }

      const apiKeys: ApiKeyResponse[] = user.apiKeys.map((key: any) => {
        const apiKeyObj: ApiKeyResponse = {
          id: key.id,
          key: maskApiKey(key.key),
          createdAt: key.createdAt.toISOString(),
          enabled: key.enabled,
          scopes: key.scopes || [],
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
      summary: 'Get API key metadata for a wallet',
      description: 'Retrieves non-sensitive metadata for all API keys associated with the authenticated wallet address.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to retrieve API key metadata',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          apiKeys: Type.Array(
            Type.Object({
              id: Type.String({ description: 'The unique identifier for the API key.' }),
              createdAt: Type.String({ description: 'Timestamp of API key creation.' }),
              scopes: Type.Optional(Type.Array(Type.String(), { description: 'The scopes granted to the API key.' })),
            })
          ),
        }, {
          examples: [
            {
              success: true,
              apiKeys: [
                {
                  id: 'clx0z0z0z0000000000000000',
                  createdAt: '2023-03-15T10:00:00.000Z',
                  scopes: ['read:polls'],
                },
              ],
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_HEADERS).', examples: ['INVALID_HEADERS'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid wallet address header',
              code: 'INVALID_HEADERS',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating user not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., USER_NOT_FOUND).', examples: ['USER_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'User not found',
              code: 'USER_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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
              scopes: true,
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
        scopes?: string[];
      }

      const apiKeysMetadata = user.apiKeys.map((key: ApiKeyMetadata) => ({
        id: key.id,
        createdAt: key.createdAt.toISOString(),
        scopes: key.scopes || [],
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
      summary: 'Rotate an API key',
      description: 'Rotates an existing API key, revoking the old one and issuing a new one with the same scopes.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      params: Type.Object({
        id: Type.String({ description: 'The ID of the API key to rotate.' }),
      }),
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to rotate API key clx0z0z0z0000000000000000',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          apiKey: Type.String({ description: 'The newly generated API key.' }),
          keyId: Type.String({ description: 'The unique identifier for the new API key.' }),
          createdAt: Type.Number({ description: 'Timestamp of new API key creation.' }),
          algorithm: Type.String({ description: 'The algorithm used to generate the new API key.' }),
          message: Type.String({ description: 'A success message.' }),
          scopes: Type.Optional(Type.Array(Type.String(), { description: 'The scopes granted to the new API key.' })),
        }, {
          examples: [
            {
              success: true,
              apiKey: 'dv_test_new_1234567890abcdef',
              keyId: 'clx0z0z0z0000000000000001',
              createdAt: 1678886400000,
              algorithm: 'HS256',
              message: 'API key rotated successfully',
              scopes: ['read:polls'],
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_API_KEY_ID).', examples: ['INVALID_API_KEY_ID'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid API key ID',
              code: 'INVALID_API_KEY_ID',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating user or API key not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., USER_NOT_FOUND, API_KEY_NOT_FOUND).', examples: ['USER_NOT_FOUND', 'API_KEY_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'API key not found or already revoked.',
              code: 'API_KEY_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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
      const { key: newApiKey, createdAt, algorithm, scopes } = generateUniqueApiKey(user.id, 'dv', createdAtTimestamp, existingApiKey.scopes || []);
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
            scopes: scopes,
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
        scopes: scopes,
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
        scopes: scopes,
      });
    }),
  });

  // DELETE /api-keys/:id - Revoke an existing API key
  fastify.delete<{ 
    Params: { id: string };
    Headers: { 'x-wallet-address': string; 'x-message': string; 'x-signature': string };
  }>("/api-keys/:id", {
    schema: {
      summary: 'Revoke an API key',
      description: 'Revokes an existing API key, disabling it permanently.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      params: Type.Object({
        id: Type.String({ description: 'The ID of the API key to revoke.' }),
      }),
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to revoke API key clx0z0z0z0000000000000000',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          message: Type.String({ description: 'A success message.' }),
        }, {
          examples: [
            {
              success: true,
              message: 'API key revoked successfully',
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_API_KEY_ID).', examples: ['INVALID_API_KEY_ID'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid API key ID',
              code: 'INVALID_API_KEY_ID',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating user or API key not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., USER_NOT_FOUND, API_KEY_NOT_FOUND).', examples: ['USER_NOT_FOUND', 'API_KEY_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'API key not found or already revoked.',
              code: 'API_KEY_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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

  // GET /api-keys/:id/usage - Get usage statistics for a specific API key
  fastify.get<{ 
    Params: GetApiKeyUsageParams;
    Querystring: GetApiKeyUsageQuery;
    Headers: { 'x-wallet-address': string; 'x-message': string; 'x-signature': string };
  }>("/api-keys/:id/usage", {
    schema: {
      summary: 'Get API key usage statistics',
      description: 'Retrieves usage statistics for a specific API key, including total requests, usage by endpoint, and usage by status code.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      params: GetApiKeyUsageParamsSchema,
      querystring: GetApiKeyUsageQuerySchema,
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to get usage for API key clx0z0z0z0000000000000000',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          totalRequests: Type.Number({ description: 'Total number of requests made with this API key.' }),
          usageByEndpoint: Type.Array(Type.Object({
            endpoint: Type.String({ description: 'The API endpoint.' }),
            count: Type.Number({ description: 'Number of requests to this endpoint.' }),
            averageResponseTime: Type.Union([Type.Number(), Type.Null()], { description: 'Average response time for this endpoint in milliseconds.' }),
            totalResponseTime: Type.Union([Type.Number(), Type.Null()], { description: 'Total response time for this endpoint in milliseconds.' }),
          }), { description: 'Usage statistics grouped by API endpoint.' }),
          usageByStatusCode: Type.Array(Type.Object({
            statusCode: Type.Number({ description: 'HTTP status code.' }),
            count: Type.Number({ description: 'Number of responses with this status code.' }),
          }), { description: 'Usage statistics grouped by HTTP status code.' }),
          overallAverageResponseTime: Type.Union([Type.Number(), Type.Null()], { description: 'Overall average response time for all requests with this API key in milliseconds.' }),
        }, {
          examples: [
            {
              success: true,
              totalRequests: 100,
              usageByEndpoint: [
                {
                  endpoint: '/api/v1/polls',
                  count: 50,
                  averageResponseTime: 120.5,
                  totalResponseTime: 6025,
                },
              ],
              usageByStatusCode: [
                {
                  statusCode: 200,
                  count: 90,
                },
                {
                  statusCode: 404,
                  count: 10,
                },
              ],
              overallAverageResponseTime: 150.2,
            },
          ],
        }),
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_DATE_RANGE).', examples: ['INVALID_DATE_RANGE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid date range',
              code: 'INVALID_DATE_RANGE',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        403: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating forbidden access.' }),
          code: Type.String({ description: 'A specific error code (e.g., FORBIDDEN).', examples: ['FORBIDDEN'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Forbidden',
              code: 'FORBIDDEN',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating API key not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., API_KEY_NOT_FOUND).', examples: ['API_KEY_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'API key not found for this user.',
              code: 'API_KEY_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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
      const { startDate, endDate } = request.query;

      const user = await prisma.apiUser.findUnique({
        where: { walletAddress },
        include: {
          apiKeys: {
            where: { id: apiKeyId },
          },
        },
      });

      if (!user || user.apiKeys.length === 0) {
        throw ApiError.notFound("API key not found for this user.", "API_KEY_NOT_FOUND");
      }

      const stats = await getApiKeyUsageStatistics({
        apiKeyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      request.log.info({
        userId: user.id,
        apiKeyId: apiKeyId,
        correlationId: request.correlationId,
        operation: 'apiKey.getUsageStatistics',
        outcome: 'success',
        message: 'Successfully retrieved API key usage statistics',
      });

      return reply.status(HttpStatusCode.OK).send({
        success: true,
        ...stats,
      });
    }),
  });

  // GET /api-keys/:id/usage/export - Export usage data for a specific API key
  fastify.get<{ 
    Params: GetApiKeyUsageParams;
    Querystring: ExportApiKeyUsageQuery;
    Headers: { 'x-wallet-address': string; 'x-message': string; 'x-signature': string };
  }>("/api-keys/:id/usage/export", {
    schema: {
      summary: 'Export API key usage data',
      description: 'Exports detailed usage data for a specific API key in either CSV or JSON format.',
      tags: ['API Keys'],
      security: [
        {
          signature: [],
        },
      ],
      params: GetApiKeyUsageParamsSchema,
      querystring: ExportApiKeyUsageQuerySchema,
      headers: Type.Object(
        {
          "x-wallet-address": Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
          "x-message": Type.String({ minLength: 1, maxLength: 1000 }),
          "x-signature": Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
        },
        { additionalProperties: true,
          examples: [
            {
              'x-wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
              'x-message': 'Sign this message to export usage for API key clx0z0z0z0000000000000000',
              'x-signature': '0x...',
            },
          ],
        }
      ),
      response: {
        200: Type.Any({ description: 'The exported usage data in the requested format (CSV string or JSON array).', examples: ['endpoint,count\n/api/v1/polls,50', '[{\"endpoint\":\"/api/v1/polls\",\"count\":50}]'] }), // Response can be CSV string or JSON array
        400: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating invalid input or format.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_FORMAT, INVALID_DATE_RANGE).', examples: ['INVALID_FORMAT', 'INVALID_DATE_RANGE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid export format',
              code: 'INVALID_FORMAT',
            },
          ],
        }),
        401: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating authentication failure.' }),
          code: Type.String({ description: 'A specific error code (e.g., INVALID_SIGNATURE).', examples: ['INVALID_SIGNATURE'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Invalid signature',
              code: 'INVALID_SIGNATURE',
            },
          ],
        }),
        403: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating forbidden access.' }),
          code: Type.String({ description: 'A specific error code (e.g., FORBIDDEN).', examples: ['FORBIDDEN'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Forbidden',
              code: 'FORBIDDEN',
            },
          ],
        }),
        404: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Error message indicating API key not found.' }),
          code: Type.String({ description: 'A specific error code (e.g., API_KEY_NOT_FOUND).', examples: ['API_KEY_NOT_FOUND'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'API key not found for this user.',
              code: 'API_KEY_NOT_FOUND',
            },
          ],
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String({ description: 'Internal server error.' }),
          code: Type.String({ description: 'A specific error code (e.g., INTERNAL_SERVER_ERROR).', examples: ['INTERNAL_SERVER_ERROR'] }),
        }, {
          examples: [
            {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_SERVER_ERROR',
            },
          ],
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
      const { format, startDate, endDate } = request.query;

      const user = await prisma.apiUser.findUnique({
        where: { walletAddress },
        include: {
          apiKeys: {
            where: { id: apiKeyId },
          },
        },
      });

      if (!user || user.apiKeys.length === 0) {
        throw ApiError.notFound("API key not found for this user.", "API_KEY_NOT_FOUND");
      }

      const exportData = await exportApiKeyUsageData({
        apiKeyId,
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      request.log.info({
        userId: user.id,
        apiKeyId: apiKeyId,
        format: format,
        correlationId: request.correlationId,
        operation: 'apiKey.exportUsageData',
        outcome: 'success',
        message: 'Successfully exported API key usage data',
      });

      if (format === 'csv') {
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="api-key-${apiKeyId}-usage.csv"`);
      } else if (format === 'json') {
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="api-key-${apiKeyId}-usage.json"`);
      }

      return reply.status(HttpStatusCode.OK).send(exportData);
    }),
  });
}

