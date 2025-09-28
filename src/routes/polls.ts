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

export default async function pollsRoute(fastify: FastifyInstance) {
  // POST /polls - Create a new poll
  fastify.post("/polls", {
    schema: {
      body: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 200 }),
        description: Type.String({ maxLength: 1000 }),
        options: Type.Array(Type.String(), { minItems: 2, maxItems: 10 }),
        walletAddress: Type.RegExp(/^0x[a-fA-F0-9]{40}$/),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.RegExp(/^0x[a-fA-F0-9]{130}$/),
      }),
      response: {
        201: Type.Object({
          success: Type.Literal(true),
          pollId: Type.String(),
          message: Type.String(),
        }),
        400: Type.Object({
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
      rateLimit: rateLimitConfigs.apiKeyCreation, // reuse for now
    },
    preHandler: [verifyWalletSignature],
  }, asyncHandler(async (request, reply) => {
    const { title, description, options, walletAddress } = request.body as any;

    // Find user
    const user = await prisma.apiUser.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "User not found");
    }

    // Create poll
    const poll = await prisma.poll.create({
      data: {
        title,
        description,
        options: JSON.stringify(options),
        creatorId: user.id,
      },
    });

    reply.code(201).send({
      success: true,
      pollId: poll.id,
      message: "Poll created successfully",
    });
  }));

  // GET /polls - Get all polls
  fastify.get("/polls", {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          polls: Type.Array(Type.Object({
            id: Type.String(),
            title: Type.String(),
            description: Type.String(),
            options: Type.Array(Type.String()),
            createdAt: Type.String(),
          })),
        }),
        500: Type.Object({
          success: Type.Literal(false),
          error: Type.String(),
        }),
      },
    },
    config: {
      rateLimit: rateLimitConfigs.health,
    },
  }, asyncHandler(async (request, reply) => {
    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const formattedPolls = polls.map((poll: any) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description || "",
      options: JSON.parse(poll.options),
      createdAt: poll.createdAt.toISOString(),
    }));

    reply.send({
      success: true,
      polls: formattedPolls,
    });
  }));

  // POST /polls/:id/vote - Vote on a poll
  fastify.post("/polls/:id/vote", {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        optionIndex: Type.Integer({ minimum: 0 }),
        walletAddress: Type.RegExp(/^0x[a-fA-F0-9]{40}$/),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.RegExp(/^0x[a-fA-F0-9]{130}$/),
      }),
      response: {
        201: Type.Object({
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
      rateLimit: rateLimitConfigs.registration,
    },
    preHandler: [verifyWalletSignature],
  }, asyncHandler(async (request, reply) => {
    const { id } = request.params as any;
    const { optionIndex, walletAddress } = request.body as any;

    // Find poll
    const poll = await prisma.poll.findUnique({
      where: { id },
    });

    if (!poll) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "Poll not found");
    }

    // Find user
    const user = await prisma.apiUser.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "User not found");
    }

    const options = JSON.parse(poll.options);
    if (optionIndex < 0 || optionIndex >= options.length) {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, "Invalid option index");
    }

    // Check if user already voted
    const existingVote = await prisma.vote.findUnique({
      where: {
        pollId_userId: {
          pollId: id,
          userId: user.id,
        },
      },
    });

    if (existingVote) {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, "User has already voted on this poll");
    }

    // Create vote
    await prisma.vote.create({
      data: {
        pollId: id,
        userId: user.id,
        optionIndex,
      },
    });

    reply.code(201).send({
      success: true,
      message: "Vote recorded successfully",
    });
  }));

  // GET /polls/:id/results - Get poll results
  fastify.get("/polls/:id/results", {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Literal(true),
          poll: Type.Object({
            id: Type.String(),
            title: Type.String(),
            description: Type.String(),
            options: Type.Array(Type.String()),
            results: Type.Array(Type.Integer()),
            totalVotes: Type.Integer(),
          }),
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
      rateLimit: rateLimitConfigs.health,
    },
  }, asyncHandler(async (request, reply) => {
    const { id } = request.params as any;

    // Find poll
    const poll = await prisma.poll.findUnique({
      where: { id },
    });

    if (!poll) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "Poll not found");
    }

    // Get vote counts
    const votes = await prisma.vote.groupBy({
      by: ['optionIndex'],
      where: { pollId: id },
      _count: { optionIndex: true },
    });

    const options = JSON.parse(poll.options);
    const results = options.map((_: string, index: number) => {
      const vote = votes.find((v: any) => v.optionIndex === index);
      return vote ? vote._count.optionIndex : 0;
    });

    const totalVotes = results.reduce((sum: number, count: number) => sum + count, 0);

    reply.send({
      success: true,
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description || "",
        options,
        results,
        totalVotes,
      },
    });
  }));
}