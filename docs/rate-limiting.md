# Rate Limiting Documentation

## Overview

The devoter-api implements comprehensive rate limiting to prevent abuse and ensure fair usage across all endpoints. Different endpoints have different rate limits based on their security requirements and expected usage patterns.

## Rate Limiting Strategy

### Key Generation
Rate limits are applied based on a combination of:
- IP address (always included)
- Wallet address (when available for authenticated endpoints)

This provides more granular control while preventing both IP-based and wallet-based abuse.

### Rate Limit Configurations

| Endpoint Type | Max Requests | Time Window | Description |
|---------------|--------------|-------------|-------------|
| Health Checks | 200 | 60 seconds | High limit for monitoring |
| General API | 100 | 60 seconds | Standard API operations |
| Registration | 5 | 60 seconds | User registration attempts |
| API Key Creation | 3 | 60 seconds | Very strict for security |
| Authentication | 10 | 60 seconds | Wallet signature verification |

### Environment Variables

The following environment variables control rate limiting:

```env
RATE_LIMIT_GENERAL_MAX=100
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_API_KEY_CREATION_MAX=3
RATE_LIMIT_REGISTRATION_MAX=5
RATE_LIMIT_HEALTH_MAX=200
```

## Endpoint-Specific Limits

### Health Endpoints
- `/ping`: 200 requests/minute
- `/health`: 200 requests/minute
- Allows successful requests and errors to not count against limit

### Authentication Endpoints
- `POST /register`: 5 requests/minute per IP+wallet combination
- Uses wallet signature verification rate limit

### API Key Management
- `POST /api-keys`: 3 requests/minute per IP+wallet combination
- `GET /api-keys`: 100 requests/minute per IP+wallet combination

## Rate Limit Headers

The API returns the following headers with each response:

- `x-ratelimit-limit`: Maximum number of requests allowed
- `x-ratelimit-remaining`: Number of requests remaining in the current window
- `x-ratelimit-reset`: Time when the rate limit window resets

## Error Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again in X seconds.",
  "retryAfter": 30
}
```

## Security Benefits

1. **DDoS Protection**: Prevents overwhelming the server with requests
2. **Brute Force Prevention**: Limits authentication attempts
3. **Resource Protection**: Prevents abuse of expensive operations like API key generation
4. **Fair Usage**: Ensures all users get fair access to the API

## Implementation Details

The rate limiting is implemented using the `@fastify/rate-limit` plugin with:
- In-memory storage for development
- Configurable per-route limits
- Custom key generation for wallet-based limits
- Graceful error handling with informative responses

## Monitoring

Rate limit violations are logged for monitoring purposes. In production, consider:
- Setting up alerts for repeated rate limit violations
- Analyzing patterns to adjust limits if needed
- Implementing IP-based temporary bans for persistent abuse

## Production Considerations

For production deployment:
1. Consider using Redis for rate limit storage in a distributed environment
2. Monitor rate limit patterns and adjust as needed
3. Implement additional security measures for persistent abusers
4. Set up monitoring and alerting for rate limit violations
