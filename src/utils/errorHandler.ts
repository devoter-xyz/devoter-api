import type { FastifyRequest, FastifyReply } from "fastify";

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
  success: boolean;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

export class ApiError extends Error {
  statusCode: HttpStatusCode;
  code: string;
  details?: Record<string, any>;

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    code: string = "UNKNOWN_ERROR",
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details || {}; // Default to empty object if undefined
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(
    message: string,
    code: string = "BAD_REQUEST",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(HttpStatusCode.BAD_REQUEST, message, code, details);
  }

  static unauthorized(
    message: string,
    code: string = "UNAUTHORIZED",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(HttpStatusCode.UNAUTHORIZED, message, code, details);
  }

  static forbidden(
    message: string,
    code: string = "FORBIDDEN",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(HttpStatusCode.FORBIDDEN, message, code, details);
  }

  static notFound(
    message: string,
    code: string = "NOT_FOUND",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(HttpStatusCode.NOT_FOUND, message, code, details);
  }

  static conflict(
    message: string,
    code: string = "CONFLICT",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(HttpStatusCode.CONFLICT, message, code, details);
  }

  static tooManyRequests(
    message: string,
    code: string = "TOO_MANY_REQUESTS",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(
      HttpStatusCode.TOO_MANY_REQUESTS,
      message,
      code,
      details
    );
  }

  static internal(
    message: string = "An unexpected error occurred",
    code: string = "INTERNAL_ERROR",
    details?: Record<string, any>
  ): ApiError {
    return new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      message,
      code,
      details
    );
  }

  toResponse(): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: this.message,
      code: this.code,
    };

    if (this.details && Object.keys(this.details).length > 0) {
      response.details = this.details;
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

  // Log the error
  request.log.error(error);

  if (error instanceof ApiError) {
    apiError = error;
  } else if (
    (error as any)?.code === "FST_ERR_VALIDATION" ||
    (error as any)?.validation
  ) {
    // Fastify schema validation error
    apiError = ApiError.badRequest(
      "Request validation failed",
      "VALIDATION_ERROR",
      { errors: (error as any).validation || (error as any).errors || [] }
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
      "UPSTREAM_ERROR"
    );
  } else if (error.name === "PrismaClientKnownRequestError") {
    // Handle Prisma specific errors
    const prismaError = error as any; // Type assertion for Prisma error

    if (prismaError.code === "P2002") {
      // Unique constraint failed
      apiError = ApiError.conflict(
        "A resource with this identifier already exists",
        "UNIQUE_CONSTRAINT_VIOLATION",
        { fields: prismaError.meta?.target || [] }
      );
    } else if (prismaError.code === "P2025") {
      // Record not found
      apiError = ApiError.notFound(
        "The requested resource was not found",
        "RESOURCE_NOT_FOUND"
      );
    } else {
      apiError = ApiError.internal(
        "Database operation failed",
        "DATABASE_ERROR"
      );
    }
  } else if (error.name === "PrismaClientValidationError") {
    apiError = ApiError.badRequest(
      "Invalid database query",
      "PRISMA_VALIDATION_ERROR"
    );
  } else {
    // Generic error handling
    apiError = ApiError.internal();
  }

  // Send the response with the appropriate status code
  reply.status(apiError.statusCode).send(apiError.toResponse());
}

/**
 * Helper function to safely execute async route handlers with error handling
 */
export function asyncHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await handler(request, reply);
    } catch (error) {
      handleError(error as Error, request, reply);
    }
  };
}
