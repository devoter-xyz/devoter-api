
// Import test utilities from Vitest
import { describe, it, expect } from 'vitest';

// Import API key utility functions to be tested
import {
  generateApiKey, // Generates a random API key
  generateUniqueApiKey, // Generates a unique API key with prefix and timestamp
  hashApiKey, // Hashes an API key using SHA-256
  maskApiKey, // Masks an API key for display
  isValidApiKeyFormat, // Validates API key format
  generateMultipleApiKeys // Generates multiple API keys at once
} from '../../src/utils/generateApiKey';

// Test suite for API Key generation and validation utilities
describe('API Key Generation', () => {
  // Tests for the generateApiKey function
  describe('generateApiKey', () => {
  // Should generate a random API key of default length (32 bytes, 43 base64url chars)
    it('should generate a random API key of default length (32 bytes, 43 base64url chars)', () => {
      const apiKey = generateApiKey();
      // Default length is 32 bytes, which is approximately 43 characters in base64url
      expect(typeof apiKey.key).toBe('string');
      expect(apiKey.key.length).toBeGreaterThanOrEqual(42);
      expect(apiKey.key.length).toBeLessThanOrEqual(44);
      // Should be a valid base64url string
      expect(apiKey.key).toMatch(/^[A-Za-z0-9_-]+$/); 
    });

  // Should generate a random API key of custom byte length
    it('should generate a random API key of custom byte length', () => {
      const length = 16; // 16 bytes
      const apiKey = generateApiKey(length);
      // 16 bytes is approximately 22 characters in base64url
      expect(typeof apiKey.key).toBe('string');
      expect(apiKey.key.length).toBeGreaterThanOrEqual(21);
      expect(apiKey.key.length).toBeLessThanOrEqual(23);
      expect(apiKey.key).toMatch(/^[A-Za-z0-9_-]+$/);
    });

  // Should generate different keys on each call (randomness)
    it('should generate different API keys on each call (randomness)', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    // Should generate deterministic API keys when a seed is provided
    it('should generate deterministic API keys when a seed is provided', () => {
      const seed = 'test-seed-123';
      const key1 = generateApiKey(32, 'base64url', seed); // Corrected seed parameter
      const key2 = generateApiKey(32, 'base64url', seed); // Corrected seed parameter
      expect(key1.key).toBe(key2.key); // Expect same key for same seed

      const key3 = generateApiKey(16, 'base64url', seed); // Corrected seed parameter
      const key4 = generateApiKey(16, 'base64url', seed); // Corrected seed parameter
      expect(key3.key).toBe(key4.key); // Expect same key for same seed and length

      const differentSeed = 'another-seed';
      const key5 = generateApiKey(32, 'base64url', differentSeed); // Corrected seed parameter
      expect(key1.key).not.toBe(key5.key); // Expect different key for different seed
    });
  });

  // Tests for the generateUniqueApiKey function
  describe('generateUniqueApiKey', () => {
  // Should generate a unique API key with the default 'dv' prefix
    it('should generate a unique API key with the default "dv" prefix', () => {
      const userId = '123456';
      const apiKey = generateUniqueApiKey(userId);
      
      // Should start with default prefix 'dv'
      expect(apiKey.key.startsWith('dv.')).toBe(true);
      
      // Should have the format: prefix_timestamp_randompart
      const parts = apiKey.key.split('.');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe('dv');
      
      // Second part should be a timestamp in base36
      expect(parts[1]).toMatch(/^[0-9a-z]+$/);
      
      // Third part should be a random string
      expect(parts[2].length).toBeGreaterThan(0);
      expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
    });

  // Should generate a unique API key with a custom prefix
    it('should generate a unique API key with a custom prefix', () => {
      const userId = '123456';
      const prefix = 'test';
      const apiKey = generateUniqueApiKey(userId, prefix);
      
      expect(apiKey.key.startsWith('test.')).toBe(true);
      
      const parts = apiKey.key.split('.');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe('test');
    });

  // Should generate different keys for the same user (random part)
    it('should generate different unique API keys for the same user', () => {
      const userId = '123456';
      const key1 = generateUniqueApiKey(userId);
      const key2 = generateUniqueApiKey(userId);
      expect(key1.key).not.toBe(key2.key);
    });
  });

  // Tests for the hashApiKey function
  describe('hashApiKey', () => {
  // Should hash an API key consistently (same input, same output)
    it('should hash an API key consistently (same input, same output)', () => {
      const apiKey = 'dv_test_key';
      const hash = hashApiKey(apiKey);
      
      // SHA-256 hash is 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
      
      // Should be consistent for the same input
      const hash2 = hashApiKey(apiKey);
      expect(hash).toBe(hash2);
    });

  // Should produce different hashes for different API keys
    it('should produce different hashes for different API keys', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');
      expect(hash1).not.toBe(hash2);
    });
  });

  // Tests for the maskApiKey function
  describe('maskApiKey', () => {
  // Should mask an API key, showing only the last 8 characters by default
    it('should mask an API key, showing only the last 8 characters by default', () => {
      const apiKey = 'dv_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = maskApiKey(apiKey);
      
      // Default is to show last 8 characters
      expect(masked.slice(-8)).toBe('stuvwxyz');
      expect(masked.slice(0, -8)).toBe('*'.repeat(apiKey.length - 8));
      expect(masked).toHaveLength(apiKey.length);
    });

  // Should mask an API key, showing a custom number of visible characters
    it('should mask an API key, showing a custom number of visible characters', () => {
      const apiKey = 'dv_1234567890abcdefghijklmnopqrstuvwxyz';
      const visibleChars = 4;
      const masked = maskApiKey(apiKey, visibleChars);
      
      // Check that the last 4 characters are visible and the rest are masked
      expect(masked.slice(-4)).toBe('wxyz');
      expect(masked.slice(0, -4)).toBe('*'.repeat(apiKey.length - 4));
      expect(masked).toHaveLength(apiKey.length);
    });

  // Should handle short API keys (all masked if shorter than visible chars)
    it('should handle short API keys (all masked if shorter than visible chars)', () => {
      const apiKey = 'short';
      const masked = maskApiKey(apiKey, 8);
      
      // If key is shorter than visible chars, all asterisks
      expect(masked).toBe('*****');
      expect(masked).toHaveLength(apiKey.length);
    });
  });

  // Tests for the isValidApiKeyFormat function
  describe('isValidApiKeyFormat', () => {
  // Should validate correctly formatted API keys (prefix, timestamp, random part)
    it('should return true for correctly formatted API keys (prefix, timestamp, random part)', () => {
      // Generate a valid key with current timestamp
      const validKey = generateUniqueApiKey('test-user');
      expect(isValidApiKeyFormat(validKey.key)).toBe(true);
      
      // Test with custom valid keys that have valid timestamps
      const currentTimestamp = Date.now().toString(36);
      const validKeys = [
        `dv.${Date.now().toString(36)}.${'a'.repeat(32)}`,
        `custom.${(Date.now() - 1000).toString(36)}.${'b'.repeat(32)}`,
      ];
      
      validKeys.forEach(key => {
        expect(isValidApiKeyFormat(key)).toBe(true);
        expect(isValidApiKeyFormat(key, true)).toBe(true); // Should also be valid in strict mode
      });
    });

    it('should return true for legacy underscore-delimited API keys when not in strict mode', () => {
      const currentTimestamp = Date.now().toString(36);
      const legacyKey = `dv_${currentTimestamp}_${'c'.repeat(32)}`;
      expect(isValidApiKeyFormat(legacyKey)).toBe(true);
    });

    it('should return false for legacy underscore-delimited API keys when in strict mode', () => {
      const currentTimestamp = Date.now().toString(36);
      const legacyKey = `dv_${currentTimestamp}_${'d'.repeat(32)}`;
      expect(isValidApiKeyFormat(legacyKey, true)).toBe(false);
    });

  // Should reject API keys with invalid format (missing parts, invalid chars, etc.)
    it('should return false for API keys with invalid format (missing parts, invalid chars, etc.)', () => {
      const invalidKeys = [
        '', // Empty
        'no_underscores',
        'a_timestamp_tooshort', // Random part too short
        '_timestamp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh', // No prefix
        'dv__ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh', // Empty timestamp
        'dv_timestamp_', // Empty random part
        'a_timestamp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh', // Prefix too short (only 1 character)
        'dv_timestamp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh!', // Invalid characters
      ];
      
      invalidKeys.forEach(key => {
        expect(isValidApiKeyFormat(key)).toBe(false);
        expect(isValidApiKeyFormat(key, true)).toBe(false); // Should also be invalid in strict mode
      });
    });
    
  // Should reject API keys with invalid or future timestamps
    it('should return false for API keys with invalid or future timestamps', () => {
      const currentTimestamp = Date.now();
      const futureTimestamp = (currentTimestamp + 1000000).toString(36); // Far future
      const invalidTimestampKeys = [
        // Future timestamp (more than buffer allows)
        `dv.${futureTimestamp}.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh`,
        `dv_${futureTimestamp}_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh`,
        // Invalid timestamp format (not a valid base36 number)
        'dv.invalid!.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh',
        'dv_invalid!_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh',
        // Negative timestamp (converted to base36)
        'dv.-1.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh',
        'dv_-1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh'
      ];
      
      invalidTimestampKeys.forEach(key => {
        expect(isValidApiKeyFormat(key)).toBe(false);
        expect(isValidApiKeyFormat(key, true)).toBe(false); // Should also be invalid in strict mode
      });
    });
  });

  // Tests for the generateMultipleApiKeys function
  describe('generateMultipleApiKeys', () => {
  // Should generate the requested number of API keys, all valid and unique
    it('should generate the requested number of API keys, all valid and unique', () => {
      const count = 5;
      const userId = '123456';
      const keys = generateMultipleApiKeys(count, userId);
      
      expect(keys).toHaveLength(count);
      
      // Each key should be valid
      keys.forEach(key => {
        expect(key.key.startsWith('dv.')).toBe(true);
        expect(isValidApiKeyFormat(key.key)).toBe(true);
      });
    });

  // Should generate unique API keys in bulk
    it('should generate unique API keys in bulk', () => {
      const count = 10;
      const userId = '123456';
      const keys = generateMultipleApiKeys(count, userId);
      
      // Check that all keys are unique
      const uniqueKeys = new Set(keys.map(k => k.key));
      expect(uniqueKeys.size).toBe(count);
    });

  // Should handle zero count (returns empty array)
    it('should return an empty array when count is zero', () => {
      const keys = generateMultipleApiKeys(0, '123456');
      expect(keys).toHaveLength(0);
    });
  });
});