import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyWalletSignature } from '../middleware/auth.js';
import { generateUniqueApiKey, hashApiKey, maskApiKey } from '../utils/generateApiKey.js';
import { rateLimitConfigs } from '../middleware/rateLimit.js';

const prisma = new PrismaClient();

export default async function apiKeysRoute(fastify: FastifyInstance) {
  // POST /api-keys - Create a new API key
  fastify.post('/api-keys', {
    config: {
      rateLimit: rateLimitConfigs.apiKeyCreation
    },
    preHandler: verifyWalletSignature,
    handler: async (request, reply) => {
      try {
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
                status: 'ACTIVE'
              }
            }
          }
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'User not found. Please register first.'
          });
        }

        // Check if user already has 3 active API keys
        if (user.apiKeys.length >= 3) {
          return reply.status(400).send({
            success: false,
            error: 'Maximum API key limit reached. You can have up to 3 active API keys.'
          });
        }

        // Generate new API key
        const newApiKey = generateUniqueApiKey(user.id);
        const hashedKey = hashApiKey(newApiKey);

        // Store the API key in database
        const createdApiKey = await prisma.apiKey.create({
          data: {
            apiUserId: user.id,
            key: hashedKey, // Store hashed version
            status: 'ACTIVE'
          }
        });

        return reply.status(201).send({
          success: true,
          apiKey: newApiKey, // Return the actual key (only time it's shown)
          keyId: createdApiKey.id,
          message: 'API key created successfully'
        });

      } catch (error) {
        request.log.error(`API key creation error: ${error}`);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  });

  // GET /api-keys - Get all API keys for a wallet
  fastify.get('/api-keys', {
    config: {
      rateLimit: rateLimitConfigs.general
    },
    preHandler: async (request, reply) => {
      // Custom validation for GET request with headers
      const walletAddress = request.headers['x-wallet-address'] as string;
      const message = request.headers['x-message'] as string;
      const signature = request.headers['x-signature'] as string;

      if (!walletAddress || !message || !signature) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required headers: x-wallet-address, x-message, x-signature'
        });
      }

      // Create a fake body for the middleware
      request.body = { walletAddress, message, signature };
      
      // Call the wallet signature verification
      return verifyWalletSignature(request, reply);
    },
    handler: async (request, reply) => {
      try {
        const walletAddress = request.headers['x-wallet-address'] as string;

        // Find the user and their API keys
        const user = await prisma.apiUser.findUnique({
          where: { walletAddress: walletAddress.toLowerCase() },
          include: {
            apiKeys: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'User not found'
          });
        }

        // Return masked API keys with metadata
        const apiKeys = user.apiKeys.map(key => ({
          id: key.id,
          key: maskApiKey(key.key), // Use our utility function to mask the key
          createdAt: key.createdAt.toISOString(),
          totalUsed: key.totalUsed,
          status: key.status
        }));

        return reply.status(200).send({
          success: true,
          apiKeys
        });

      } catch (error) {
        request.log.error(`API keys retrieval error: ${error}`);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  });
}
