
# Error Handling in devoter-api

Robust error handling is critical for building reliable APIs. The `devoter-api` service implements a comprehensive error handling strategy to ensure predictable, actionable, and secure responses for both developers and API consumers. This document details the approach, patterns, and best practices used.

## Architecture

The error handling system is built around these key components:

1. **ApiError Class**: A custom error class that extends JavaScript's native Error, providing structured error information
## ApiError Class Structure

The `ApiError` class standardizes error creation and propagation. It typically includes:

```typescript
class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, any>;

  constructor(message: string, status: number, code: string, details?: Record<string, any>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static notFound(message: string, code = "NOT_FOUND", details?: any) {
    return new ApiError(message, 404, code, details);
  }
  // ...other static helpers for badRequest, unauthorized, etc.
}
```

Extend or customize this class as needed for your use case.
2. **HTTP Status Codes**: Well-defined status codes used consistently across all endpoints
3. **Error Response Format**: A consistent format for all API error responses
4. **Global Error Handler**: Centralized handling of all errors
5. **AsyncHandler Utility**: Reduces boilerplate in route handlers

## Error Response Format

All API errors follow this consistent JSON format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional context about the error
  }
}
```

## HTTP Status Codes

We use appropriate HTTP status codes to indicate the nature of errors:

| Status Code | Meaning               | Common Usage                                                    |
| ----------- | --------------------- | --------------------------------------------------------------- |
| 400         | Bad Request           | Invalid input, validation failure                               |
| 401         | Unauthorized          | Missing or invalid authentication                               |
| 403         | Forbidden             | Valid authentication but insufficient permissions               |
| 404         | Not Found             | Requested resource does not exist                               |
| 409         | Conflict              | Request conflicts with current state (e.g., duplicate resource) |
| 429         | Too Many Requests     | Rate limit exceeded                                             |
| 500         | Internal Server Error | Unexpected server-side error                                    |

## Error Codes

We use standardized error codes to help identify specific error conditions:

| Error Code                    | Description                               | HTTP Status |
| ----------------------------- | ----------------------------------------- | ----------- |
| `INVALID_AUTH_INPUT`          | Authentication input validation failed    | 400         |
| `INVALID_SIGNATURE`           | Wallet signature verification failed      | 401         |
| `USER_NOT_FOUND`              | The requested user doesn't exist          | 404         |
| `MAX_API_KEYS_REACHED`        | User has reached maximum allowed API keys | 400         |
| `MISSING_AUTH_HEADERS`        | Required authentication headers missing   | 400         |
| `UNIQUE_CONSTRAINT_VIOLATION` | Attempt to create a duplicate resource    | 409         |
| `DATABASE_ERROR`              | Database operation failed                 | 500         |
| `INTERNAL_ERROR`              | Unspecified server error                  | 500         |

## Exception Handling Flow

1. Route handlers use `asyncHandler` to automatically catch exceptions
2. Specific error conditions throw appropriate `ApiError` instances
3. Global error handler processes all uncaught errors
4. Prisma/database errors are mapped to API errors (see below)
5. All errors are logged with request context for debugging and traceability
## Global Error Handler Example

The global error handler ensures all errors are returned in the standard format and logs relevant context:

```typescript
app.setErrorHandler((err, req, res) => {
  if (err instanceof ApiError) {
    // Log error with request context
    logger.error({ err, path: req.url, user: req.user }, "API error");
    res.status(err.status).send({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details || undefined,
    });
  } else {
    // Handle unexpected errors
    logger.error({ err, path: req.url }, "Unhandled error");
    res.status(500).send({
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
});
```

## Prisma/Database Error Mapping

Prisma errors (e.g., unique constraint violations) are caught and mapped to API errors:

```typescript
try {
  await prisma.user.create({ ... });
} catch (e) {
  if (e.code === 'P2002') {
    throw ApiError.conflict("Duplicate resource", "UNIQUE_CONSTRAINT_VIOLATION");
  }
  throw ApiError.internal("Database error", "DATABASE_ERROR");
}
```
## Logging

All errors are logged with relevant request context (user, endpoint, params) to aid debugging and monitoring. Use a structured logger (e.g., pino, winston) for best results.
## Troubleshooting Common Errors

| Scenario | Likely Cause | Resolution |
|----------|-------------|------------|
| 401 Unauthorized | Missing/invalid auth headers | Check `Authorization` header and signature |
| 409 Conflict | Duplicate resource | Ensure unique fields (e.g., wallet) are not reused |
| 429 Too Many Requests | Rate limit exceeded | Wait and retry after `retryAfter` seconds |
| 500 Internal Error | Unexpected server error | Check logs for stack trace and context |

If you encounter an error not listed here, consult the logs or contact the API maintainer.

## Example Usage

### In Route Handlers

```typescript
// Throwing specific errors
if (!user) {
  throw ApiError.notFound(
    "User not found. Please register first.",
    "USER_NOT_FOUND"
  );
}

// With additional context
if (user.apiKeys.length >= 3) {
  throw ApiError.badRequest(
    "Maximum API key limit reached. You can have up to 3 active API keys.",
    "MAX_API_KEYS_REACHED",
    { limit: 3, current: user.apiKeys.length }
  );
}
```

### In Middleware

```typescript
// Authentication middleware error
if (!isValid) {
  throw ApiError.unauthorized("Invalid wallet signature", "INVALID_SIGNATURE");
}
```

## Benefits

1. **Consistency**: Users receive predictable error responses
2. **Debuggability**: Error codes and details help troubleshoot issues
3. **Clean Code**: Route handlers focus on happy paths with minimal try/catch blocks
4. **Client Friendliness**: Errors are actionable and informative for API consumers
