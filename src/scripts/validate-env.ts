import { getEnv } from '../config/env';

function validateEnv() {
  try {
    // Accessing env will trigger the validation defined in src/config/env.ts
    // If validation fails, it will throw an error.
    const env = getEnv();
    console.log('Environment variables are valid:', env);
    process.exit(0);
  } catch (error) {
    console.error('Environment variable validation failed:', error);
    process.exit(1);
  }
}

validateEnv();
