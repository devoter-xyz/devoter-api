/*
import type { FastifyInstance } from "fastify";
import { verifyWalletSignature } from "../middleware/auth.js";
import { rateLimitConfigs } from "../middleware/rateLimit.js";
import * as Type from "@sinclair/typebox";
import {
  ApiError,
  asyncHandler,
  HttpStatusCode,
} from "../utils/errorHandler.js";
import { prisma } from "../lib/prisma.js";

export default async function pollsRoute(fastify: FastifyInstance) {
  // POST /polls - Create a new poll
  fastify.post("/polls", {
    schema: {
      body: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 200 }),
        description: Type.Optional(Type.String({ maxLength: 1000 })),
        options: Type.Array(Type.String(), { minItems: 2, maxItems: 10 }),
        walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
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
      querystring: Type.Object({
        limit: Type.Integer({ minimum: 1, default: 50 }),
        offset: Type.Integer({ minimum: 0, default: 0 }),
      }),
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
    const { limit, offset } = request.query as { limit: number; offset: number };

    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
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
        walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
        message: Type.String({ minLength: 1, maxLength: 1000 }),
        signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
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
    const { id: pollId } = request.params as { id: string };
    const { optionIndex, walletAddress } = request.body as { optionIndex: number; walletAddress: string };

    // 1. Find the poll
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "Poll not found");
    }

    // 2. Validate optionIndex
    const options = JSON.parse(poll.options as string);
    if (optionIndex < 0 || optionIndex >= options.length) {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, "Invalid option index");
    }

    // 3. Find the user
    const user = await prisma.apiUser.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new ApiError(HttpStatusCode.NOT_FOUND, "User not found");
    }

    // 4. Check if user has already voted on this poll
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId: poll.id,
        voterId: user.id,
      },
    });

    if (existingVote) {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, "User has already voted on this poll");
    }

    // In src/routes/polls.ts around lines 198 to 218, the transaction uses a stale
    // poll snapshot and may create sparse arrays; re-read the poll votes inside the
    // transaction (e.g., tx.poll.findUnique/ findFirst) to get the current votes,
    // parse them, normalize the array to the poll's options length by filling missing
    // indexes with 0 (so no sparse/null entries), increment the chosen optionIndex,
    // then create the vote and update the poll.votes with the JSON-stringified
    // normalized array — all using the same tx to avoid lost updates under
    // concurrency.
    await prisma.$transaction(async (tx) => {
      // Re-check duplicate vote inside transaction
      const existingVoteInsideTx = await tx.vote.findFirst({ where: { pollId: poll.id, voterId: user.id } });
      if (existingVoteInsideTx) {
        throw new ApiError(HttpStatusCode.BAD_REQUEST, "User has already voted on this poll");
      }

      // Read latest votes (and options if you prefer) inside the transaction
      const pollForUpdate = await tx.poll.findUnique({
        where: { id: poll.id },
        select: { votes: true, options: true },
      });

      const parsedOptions = JSON.parse(pollForUpdate?.options ?? (poll.options as string));
      const currentVotes = JSON.parse(pollForUpdate?.votes ?? '[]');

      // Normalize votes array to options length without sparse entries
      const normalizedVotes = Array.from({ length: parsedOptions.length }, (_, i) => Number(currentVotes[i] ?? 0));
      normalizedVotes[optionIndex] = (normalizedVotes[optionIndex] || 0) + 1;

      // Create vote and update poll within same tx
      await tx.vote.create({
        data: { pollId: poll.id, voterId: user.id, optionIndex },
      });

      await tx.poll.update({
        where: { id: poll.id },
        data: { votes: JSON.stringify(normalizedVotes) },
      });
    });

    reply.code(201).send({
      success: true,
      message: "Vote recorded successfully",
    });
  }));
}
*/