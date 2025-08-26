import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyWalletSignature } from '../middleware/auth.js';

const prisma = new PrismaClient();

export default async function registerRoute(fastify: FastifyInstance) {
  // POST /register - Register an account using wallet address
  fastify.post('/register', {
    preHandler: verifyWalletSignature,
    handler: async (request, reply) => {
      try {
        const { walletAddress, message, signature } = request.body as {
          walletAddress: string;
          message: string;
          signature: string;
        };

        // Check if user already exists
        const existingUser = await prisma.apiUser.findUnique({
          where: { walletAddress: walletAddress.toLowerCase() }
        });

        if (existingUser) {
          return reply.status(200).send({
            success: true,
            userId: existingUser.id,
            message: 'User already registered'
          });
        }

        // Create new user
        const newUser = await prisma.apiUser.create({
          data: {
            walletAddress: walletAddress.toLowerCase()
          }
        });

        return reply.status(201).send({
          success: true,
          userId: newUser.id,
          message: 'User registered successfully'
        });

      } catch (error) {
        request.log.error(`Registration error: ${error}`);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  });
}
