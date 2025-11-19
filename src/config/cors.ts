import { FastifyCorsOptions } from '@fastify/cors';
import { env } from 'process';

interface CorsConfig {
  allowedOrigins: (string | RegExp)[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

const getCorsConfig = (): CorsConfig => {
  const allowedOriginsEnv = env.CORS_ALLOWED_ORIGINS || '';
  const allowedMethodsEnv = env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,DELETE,OPTIONS';
  const allowedHeadersEnv = env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-API-Key';

  const allowedOrigins: (string | RegExp)[] = allowedOriginsEnv
    .split(',')
    .map((origin) => {
      const trimmedOrigin = origin.trim();
      if (trimmedOrigin.startsWith('/') && trimmedOrigin.endsWith('/')) {
        // Treat as a regular expression
        return new RegExp(trimmedOrigin.slice(1, -1));
      }
      return trimmedOrigin;
    })
    .filter((origin) => origin !== '');

  return {
    allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ['*'], // Default to '*' if no origins are specified
    allowedMethods: allowedMethodsEnv.split(',').map((method) => method.trim()),
    allowedHeaders: allowedHeadersEnv.split(',').map((header) => header.trim()),
    credentials: env.CORS_CREDENTIALS === 'true',
  };
};

export const corsOptions: FastifyCorsOptions = {
  origin: (origin, callback) => {
    const config = getCorsConfig();
    if (!origin || config.allowedOrigins.includes('*')) {
      callback(null, true);
      return;
    }

    const isAllowed = config.allowedOrigins.some((allowedOrigin) => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      }
      return allowedOrigin.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: getCorsConfig().allowedMethods,
  allowedHeaders: getCorsConfig().allowedHeaders,
  credentials: getCorsConfig().credentials,
};

export const validateCorsConfig = () => {
  const config = getCorsConfig();
  if (config.allowedOrigins.length === 0 && !config.allowedOrigins.includes('*')) {
    console.warn('CORS: No allowed origins specified. Consider setting CORS_ALLOWED_ORIGINS or explicitly using "*" for all origins.');
  }
  console.log('CORS Configuration Validated:', config);
};
