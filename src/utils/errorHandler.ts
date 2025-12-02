import type { FastifyReply, RouteGenericInterface, FastifyRequest } from "fastify";
import { randomUUID } from 'crypto';
import { env } from '../config/env.js'; // Import environment variables

export enum HttpStatusCode {
  // Success codes
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,

  // Client error codes
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,

  // Server error codes
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503,
}

export interface ErrorResponse {
  statusCode: HttpStatusCode;
  message: string;
  code: string;
  details?: Record<string, any>;
  correlationId?: string; // Optional: A unique ID to track the error across systems
  stack?: string; // Optional: Stack trace for debugging in non-production environments
}

export class ApiError extends Error {
  statusCode: HttpStatusCode;
  code: string;
  details?: Record<string, any>;
  correlationId?: string; // Optional: A unique ID to track the error across systems

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    code: string = "UNKNOWN_ERROR",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details || {}; // Default to empty object if undefined
    this.correlationId = correlationId;
    if (stack !== undefined) {
      this.stack = stack;
    } // Assign the stack trace only if it's not undefined
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(
    message: string,
    code: string = "BAD_REQUEST",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(HttpStatusCode.BAD_REQUEST, message, code, details, correlationId, stack);
  }

  static unauthorized(
    message: string,
    code: string = "UNAUTHORIZED",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(HttpStatusCode.UNAUTHORIZED, message, code, details, correlationId, stack);
  }

  static forbidden(
    message: string,
    code: string = "FORBIDDEN",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(HttpStatusCode.FORBIDDEN, message, code, details, correlationId, stack);
  }

  static notFound(
    message: string,
    code: string = "NOT_FOUND",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
): ApiError {
    return new ApiError(HttpStatusCode.NOT_FOUND, message, code, details, correlationId, stack);
  }

  static conflict(
    message: string,
    code: string = "CONFLICT",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(HttpStatusCode.CONFLICT, message, code, details, correlationId, stack);
  }

  static tooManyRequests(
    message: string,
    code: string = "TOO_MANY_REQUESTS",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(
      HttpStatusCode.TOO_MANY_REQUESTS,
      message,
      code,
      details,
      correlationId,
      stack
    );
  }

  static internal(
    message: string = "An unexpected error occurred",
    code: string = "INTERNAL_ERROR",
    details?: Record<string, any>,
    correlationId?: string,
    stack?: string
  ): ApiError {
    return new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      message,
      code,
      details,
      correlationId,
      stack
    );
  }

  toResponse(): ErrorResponse {
    const response: ErrorResponse = {
      statusCode: this.statusCode,
      message: this.message,
      code: this.code,
    };

    if (this.details && Object.keys(this.details).length > 0) {
      response.details = this.details;
    }

    if (this.correlationId) {
      response.correlationId = this.correlationId;
    }

    // Only include stack trace in non-production environments
    if (this.stack && env.NODE_ENV !== 'production') {
      response.stack = this.stack;
    }

    return response;
  }
}

/**
 * Global error handler for consistent API error responses
 */
export function handleError(
  error: Error | ApiError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  let apiError: ApiError;

  // Determine correlation ID: use existing from ApiError, request ID, or generate a new UUID
  const correlationId = (error instanceof ApiError && error.correlationId)
    ? error.correlationId
    : request.id || randomUUID();

  // Capture stack trace for all errors, but only expose in non-production environments
  const errorStack = error.stack;

  // Log the error with correlation ID and stack trace (full error object)
  request.log.error({ error, correlationId, stack: errorStack }, error.message);

  if (error instanceof ApiError) {
    apiError = error;
    // Ensure stack is added if it's missing from an ApiError created without one
    if (!apiError.stack && errorStack) {
      apiError.stack = errorStack;
    }
  } else if (
    (error as any)?.code === "FST_ERR_VALIDATION" ||
    (error as any)?.validation
  ) {
    // Fastify schema validation error
    apiError = ApiError.badRequest(
      "Request validation failed",
      "VALIDATION_ERROR",
      { errors: (error as any).validation || (error as any).errors || [] },
      correlationId,
      errorStack
    );
  } else if (
    typeof (error as any)?.statusCode === "number" &&
    (error as any).statusCode >= 400 &&
    (error as any).statusCode < 600
  ) {
    // Preserve known HTTP status from third-party errors
    const status = (error as any).statusCode as number;
    apiError = new ApiError(
      status as HttpStatusCode,
      (error as any).message || "Request failed",
      "UPSTREAM_ERROR",
      undefined,
      correlationId,
      errorStack
    );
  } else if (error.name === "PrismaClientKnownRequestError") {
    // Handle Prisma specific errors
    const prismaError = error as any; // Type assertion for Prisma error

    if (prismaError.code === "P2002") {
      // Unique constraint failed
      apiError = ApiError.conflict(
        "A resource with this identifier already exists",
        "UNIQUE_CONSTRAINT_VIOLATION",
        { fields: prismaError.meta?.target || [] },
        correlationId,
        errorStack
      );
    } else if (prismaError.code === "P2025") {
      // Record not found
      apiError = ApiError.notFound(
        "The requested resource was not found",
        "RESOURCE_NOT_FOUND",
        undefined,
        correlationId,
        errorStack
      );
    } else {
      apiError = ApiError.internal(
        "Database operation failed",
        "DATABASE_ERROR",
        undefined,
        correlationId,
        errorStack
      );
    }
  } else if (error.name === "PrismaClientValidationError") {
    apiError = ApiError.badRequest(
      "Invalid database query",
      "PRISMA_VALIDATION_ERROR",
      undefined,
      correlationId,
      errorStack
    );
  } else {
    // Generic error handling
    const errorMessage = "An unexpected error occurred";
    apiError = ApiError.internal(errorMessage, "INTERNAL_ERROR", undefined, correlationId, errorStack);
  }

  // Send the response with the appropriate status code
  reply.status(apiError.statusCode).send(apiError.toResponse());
}

/**
 * Helper function to safely execute async route handlers with error handling
 */
export function asyncHandler<RouteGeneric extends RouteGenericInterface = RouteGenericInterface>(
  handler: (request: FastifyRequest<RouteGeneric>, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest<RouteGeneric>, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      handleError(error as Error, request, reply);
    }
  };
}
