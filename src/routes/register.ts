import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { verifyWalletSignature } from "../middleware/auth.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import { Type } from "@sinclair/typebox";
import {
  ApiError,
  asyncHandler,
  HttpStatusCode,
} from "../utils/errorHandler.js";

const prisma = new PrismaClient();

export default async function registerRoute(fastify: FastifyInstance) {
  // POST /register - Register a new user with wallet authentication
  fastify.post("/register", {
    schema: {
      body: Type.Object({
        walletAddress: Type.RegExp(/^0x[a-fA-F0-9]{40}$/),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.RegExp(/^0x[a-fA-F0-9]{130}$/),
      }),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          userId: Type.String(),
          message: Type.String(),
        }),
        201: Type.Object({
          success: Type.Literal(true),
          userId: Type.String(),
          message: Type.String(),
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
      },
    },
    config: {
      rateLimit: rateLimitConfigs.registration,
    },
    preHandler: verifyWalletSignature,
    handler: asyncHandler(async (request, reply) => {
      const { walletAddress } = request.body as {
        walletAddress: string;
        message: string;
        signature: string;
      };

      // Check if user already exists
      const existingUser = await prisma.apiUser.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (existingUser) {
        return reply.status(HttpStatusCode.OK).send({
          success: true,
          userId: existingUser.id,
          message: "User already registered",
        });
      }

      try {
        // Create new user
        const newUser = await prisma.apiUser.create({
          data: {
            walletAddress: walletAddress.toLowerCase(),
          },
        });

        return reply.status(HttpStatusCode.CREATED).send({
          success: true,
          userId: newUser.id,
          message: "User registered successfully",
        });
      } catch (error) {
        // This will be caught by asyncHandler
        if ((error as any)?.code === "P2002") {
          // Handle race condition where user was created between our check and create
          const existingUser = await prisma.apiUser.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
          });

          if (existingUser) {
            return reply.status(HttpStatusCode.OK).send({
              success: true,
              userId: existingUser.id,
              message: "User already registered",
            });
          }
        }

        // Re-throw to be caught by asyncHandler
        throw error;
      }
    }),
  });
}
