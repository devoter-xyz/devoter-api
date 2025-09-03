# Error Handling in devoter-api

This document explains the error handling strategy implemented in the devoter-api service.

## Architecture

The error handling system is built around these key components:

1. **ApiError Class**: A custom error class that extends JavaScript's native Error
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
4. Prisma database errors are converted to appropriate API errors
5. All errors are logged with request context for debugging

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
