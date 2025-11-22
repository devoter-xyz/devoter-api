import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),
  DATABASE_URL: z.string().url(),
  API_KEY_SECRET: z.string().min(32).default(process.env.NODE_ENV === 'test' ? 'test-api-key-secret-for-devoter-api' : ''),
  SHUTDOWN_TIMEOUT_SECONDS: z.coerce.number().default(30),
  // Add other environment variables as needed
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsedEnv = envSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', parsedEnv.error.format());
    throw parsedEnv.error;
  }

  const env = parsedEnv.data;

  // Environment-specific validation rules
  if (env.NODE_ENV === 'production') {
    const productionEnvSchema = envSchema.extend({
      API_KEY_SECRET: z.string().min(64),
    });
    const productionParsedEnv = productionEnvSchema.safeParse(process.env);
    if (!productionParsedEnv.success) {
      console.error('❌ Invalid production environment variables:', productionParsedEnv.error.format());
      throw productionParsedEnv.error;
    }
    return productionParsedEnv.data;
  }

  console.log('Environment variables loaded and validated.');
  return env;
}
