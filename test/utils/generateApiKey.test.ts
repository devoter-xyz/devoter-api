import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  generateUniqueApiKey,
  hashApiKey,
  maskApiKey,
  isValidApiKeyFormat,
  generateMultipleApiKeys
} from '../../src/utils/generateApiKey';

describe('API Key Generation', () => {
  describe('generateApiKey', () => {
    it('should generate a random API key with default length', () => {
      const apiKey = generateApiKey();
      // Default length is 32 bytes, which is 43 characters in base64url
      expect(apiKey).toHaveLength(43);
      // Should be a valid base64url string
      expect(apiKey).toMatch(/^[A-Za-z0-9_-]+$/); 
    });

    it('should generate a random API key with custom length', () => {
      const length = 16; // 16 bytes
      const apiKey = generateApiKey(length);
      // 16 bytes is 22 characters in base64url (rounded up from 21.33)
      expect(apiKey).toHaveLength(22);
      expect(apiKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate different keys on each call', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateUniqueApiKey', () => {
    it('should generate a unique API key with default prefix', () => {
      const userId = '123456';
      const apiKey = generateUniqueApiKey(userId);
      
      // Should start with default prefix 'dv'
      expect(apiKey.startsWith('dv_')).toBe(true);
      
      // Should have the format: prefix_timestamp_randompart
      const parts = apiKey.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe('dv');
      
      // Second part should be a timestamp in base36
      expect(parts[1]).toMatch(/^[0-9a-z]+$/);
      
      // Third part should be a random string
      expect(parts[2].length).toBeGreaterThan(0);
      expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate a unique API key with custom prefix', () => {
      const userId = '123456';
      const prefix = 'test';
      const apiKey = generateUniqueApiKey(userId, prefix);
      
      expect(apiKey.startsWith('test_')).toBe(true);
      
      const parts = apiKey.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe('test');
    });

    it('should generate different keys for the same user', () => {
      const userId = '123456';
      const key1 = generateUniqueApiKey(userId);
      const key2 = generateUniqueApiKey(userId);
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key consistently', () => {
      const apiKey = 'dv_test_key';
      const hash = hashApiKey(apiKey);
      
      // SHA-256 hash is 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
      
      // Should be consistent for the same input
      const hash2 = hashApiKey(apiKey);
      expect(hash).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('maskApiKey', () => {
    it('should mask an API key with default visible characters', () => {
      const apiKey = 'dv_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = maskApiKey(apiKey);
      
      // Default is to show last 8 characters
      expect(masked.slice(-8)).toBe('stuvwxyz');
      expect(masked.slice(0, -8)).toBe('*'.repeat(apiKey.length - 8));
      expect(masked).toHaveLength(apiKey.length);
    });

    it('should mask an API key with custom visible characters', () => {
      const apiKey = 'dv_1234567890abcdefghijklmnopqrstuvwxyz';
      const visibleChars = 4;
      const masked = maskApiKey(apiKey, visibleChars);
      
      // Check that the last 4 characters are visible and the rest are masked
      expect(masked.slice(-4)).toBe('wxyz');
      expect(masked.slice(0, -4)).toBe('*'.repeat(apiKey.length - 4));
      expect(masked).toHaveLength(apiKey.length);
    });

    it('should handle short API keys', () => {
      const apiKey = 'short';
      const masked = maskApiKey(apiKey, 8);
      
      // If key is shorter than visible chars, all asterisks
      expect(masked).toBe('*****');
      expect(masked).toHaveLength(apiKey.length);
    });
  });

  describe('isValidApiKeyFormat', () => {
    it('should validate correctly formatted API keys', () => {
      const validKeys = [
        'dv_1234abcd_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh',
        'test_timestamp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh',
        'ab_1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn'
      ];
      
      validKeys.forEach(key => {
        expect(isValidApiKeyFormat(key)).toBe(true);
      });
    });

    it('should reject invalid API key formats', () => {
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
        const result = isValidApiKeyFormat(key);
        console.log(`Key: "${key}" - isValid: ${result}`);
        expect(result).toBe(false);
      });
    });
  });

  describe('generateMultipleApiKeys', () => {
    it('should generate the requested number of API keys', () => {
      const count = 5;
      const userId = '123456';
      const keys = generateMultipleApiKeys(count, userId);
      
      expect(keys).toHaveLength(count);
      
      // Each key should be valid
      keys.forEach(key => {
        expect(key.startsWith('dv_')).toBe(true);
        expect(isValidApiKeyFormat(key)).toBe(true);
      });
    });

    it('should generate unique keys', () => {
      const count = 10;
      const userId = '123456';
      const keys = generateMultipleApiKeys(count, userId);
      
      // Check that all keys are unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(count);
    });

    it('should handle zero count', () => {
      const keys = generateMultipleApiKeys(0, '123456');
      expect(keys).toHaveLength(0);
    });
  });
});