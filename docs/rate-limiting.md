
# Rate Limiting Documentation

Rate limiting is essential for protecting APIs from abuse, ensuring fair access, and maintaining service reliability. The `devoter-api` uses a flexible, secure rate limiting strategy tailored to endpoint sensitivity and user context.

## Overview

The devoter-api implements comprehensive rate limiting to prevent abuse and ensure fair usage across all endpoints. Different endpoints have different rate limits based on their security requirements and expected usage patterns.

## Rate Limiting Strategy

### Key Generation
Rate limits are applied based on a combination of:
- **IP address** (always included)
- **Wallet address** (when available for authenticated endpoints)

This dual-key approach prevents both IP-based and wallet-based abuse, and allows for fine-grained control.

**Example key generation logic:**
```typescript
function getRateLimitKey(req) {
  const ip = req.ip;
  const wallet = req.user?.walletAddress;
  return wallet ? `${ip}:${wallet}` : ip;
}
```
## Customizing Per-Route Rate Limits

You can set different rate limits for each route using the Fastify plugin:

```typescript
fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: getRateLimitKey,
  // ...other options
});

fastify.route({
  method: 'POST',
  url: '/register',
  config: {
    rateLimit: { max: 5, timeWindow: '1 minute' }
  },
  handler: registerHandler
});
```
## Example Middleware Configuration

```typescript
import rateLimit from '@fastify/rate-limit';
fastify.register(rateLimit, {
  global: false, // allow per-route overrides
  keyGenerator: getRateLimitKey,
  errorResponseBuilder: (req, context) => ({
    success: false,
    error: 'Rate limit exceeded',
    message: `Too many requests. Try again in ${context.after} seconds.`,
    retryAfter: context.after
  })
});
```

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

## Rate Limit Analytics

To provide better visibility into rate limit usage and violations, a new analytics endpoint has been introduced:

### `/metrics/rate-limits` Endpoint

This endpoint exposes aggregated rate limit data, useful for monitoring dashboards and identifying potential abuse patterns. It provides a JSON response with the following structure:

```json
{
  "timestamp": 1701000000000,
  "totalEvents": 1500,
  "limitedEvents": 50,
  "limitedPercentage": 3.33,
  "hitsByEndpoint": {
    "/api/v1/register": 30,
    "/api/v1/api-keys": 15,
    "/health": 5
  },
  "hitsByLimitType": {
    "registration": 30,
    "apiKeyCreation": 15,
    "health": 5
  },
  "topViolators": [
    { "key": "192.168.1.100:0xabc...", "count": 25 },
    { "key": "10.0.0.5", "count": 10 }
  ]
}
```

**Key Metrics Included:**
- `timestamp`: Time of data generation.
- `totalEvents`: Total rate limit checks performed.
- `limitedEvents`: Total requests that were rate-limited.
- `limitedPercentage`: Percentage of requests that were rate-limited.
- `hitsByEndpoint`: Breakdown of rate limit hits by API endpoint.
- `hitsByLimitType`: Breakdown of rate limit hits by configured limit type (e.g., `general`, `auth`).
- `topViolators`: A list of the top 10 keys (IPs or IP+wallet combinations) that have exceeded rate limits, along with their hit counts.

This data is stored in-memory and is primarily intended for real-time monitoring and quick insights. For persistent storage and advanced analytics, integrate with external monitoring solutions.

### Example Usage:

To retrieve the current rate limit analytics:

```bash
curl http://localhost:3000/metrics/rate-limits
```

## Production Considerations

For production deployment:
1. **Use Redis** for rate limit storage in distributed/multi-instance environments:
   - Install and configure Redis
   - Use `@fastify/rate-limit` with `redis` store:
   ```typescript
   fastify.register(require('@fastify/rate-limit'), {
     redis: new Redis(process.env.REDIS_URL),
     // ...other options
   });
   ```
2. Monitor rate limit patterns and adjust as needed
3. Implement additional security measures for persistent abusers (e.g., IP bans)
4. Set up monitoring and alerting for rate limit violations
## Troubleshooting & FAQ

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| All requests blocked | Misconfigured rate limit or key generator | Check per-route config and key logic |
| Rate limit not enforced | Plugin not registered or wrong route config | Ensure plugin is loaded and route has correct settings |
| High false positives | Shared IPs (e.g., proxies) | Consider using wallet or user ID in key |
| Redis errors | Redis not running or misconfigured | Check Redis connection and logs |

If you encounter persistent issues, review logs and verify your environment variables and plugin configuration.
