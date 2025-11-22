import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { envSchema, getEnv } from '../../src/config/env';

const originalEnv = process.env;

describe('Environment Variable Validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv }; // Restore original env before each test
  });

  it('should validate development environment variables successfully', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3001';
    process.env.HOST = '127.0.0.1';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/devoter_dev';
    process.env.API_KEY_SECRET = 'development-api-key-secret-at-least-32-chars';

    const env = getEnv();
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.DATABASE_URL).toBe('postgresql://user:password@localhost:5432/devoter_dev');
    expect(env.API_KEY_SECRET).toBe('development-api-key-secret-at-least-32-chars');
  });

  it('should validate production environment variables successfully with stricter rules', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '4000';
    process.env.HOST = '0.0.0.0';
    process.env.DATABASE_URL = 'postgresql://user:password@prod-host:5432/devoter_prod';
    process.env.API_KEY_SECRET = 'production-api-key-secret-that-is-at-least-64-characters-long-and-very-secure';

    const env = getEnv();
    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.DATABASE_URL).toBe('postgresql://user:password@prod-host:5432/devoter_prod');
    expect(env.API_KEY_SECRET).toBe('production-api-key-secret-that-is-at-least-64-characters-long-and-very-secure');
  });

  it('should throw an error if a required environment variable is missing', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.HOST = 'localhost';
    process.env.DATABASE_URL = undefined; // Explicitly set to undefined
    process.env.API_KEY_SECRET = 'development-api-key-secret-at-least-32-chars';

    expect(() => getEnv()).toThrow(z.ZodError);
    expect(() => getEnv()).toThrow(/Invalid input: expected string, received undefined/);
  });

  it('should throw an error if DATABASE_URL is not a valid URL', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.HOST = 'localhost';
    process.env.DATABASE_URL = 'invalid-url';
    process.env.API_KEY_SECRET = 'development-api-key-secret-at-least-32-chars';

    expect(() => getEnv()).toThrow(z.ZodError);
    expect(() => getEnv()).toThrow(/Invalid URL/);
  });

  it('should throw an error if API_KEY_SECRET is too short in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.HOST = 'localhost';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/devoter_dev';
    process.env.API_KEY_SECRET = 'short'; // Too short

    expect(() => getEnv()).toThrow(z.ZodError);
    expect(() => getEnv()).toThrow(/Too small: expected string to have >=32 characters/);
  });

  it('should throw an error if API_KEY_SECRET is too short in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '3000';
    process.env.HOST = 'localhost';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/devoter_dev';
    process.env.API_KEY_SECRET = 'this-is-a-32-char-secret-for-production'; // Too short for production

    expect(() => getEnv()).toThrow(z.ZodError);
    expect(() => getEnv()).toThrow(/Too small: expected string to have >=64 characters/);
  });

  it('should use default PORT if not provided', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = undefined; // Set to undefined to test default
    process.env.HOST = 'localhost';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/devoter_dev';
    process.env.API_KEY_SECRET = 'development-api-key-secret-at-least-32-chars';

    const env = getEnv();
    expect(env.PORT).toBe(3000);
  });

  it('should use default HOST if not provided', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.HOST = undefined; // Set to undefined to test default
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/devoter_dev';
    process.env.API_KEY_SECRET = 'development-api-key-secret-at-least-32-chars';

    const env = getEnv();
    expect(env.HOST).toBe('localhost');
  });
});
