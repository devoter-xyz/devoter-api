import { describe, it, expect } from 'vitest';
import { validateWalletAuthInput } from '../../src/utils/validation';

describe('Message Format Validation', () => {
  const validWalletAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const validSignature = '0x' + '1'.repeat(130);

  describe('Basic message validation', () => {
  it('should return valid for plain text messages', () => {
      const validMessages = [
        'Simple message',
        'Message with numbers 123',
        'Message with special characters !@#$%^&*()',
        'Message with unicode characters: 你好, こんにちは, 안녕하세요',
        'A'.repeat(1000) // Max length message
      ];

      validMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

  it('should return valid for messages with control characters (current implementation)', () => {
      const messagesWithControlChars = [
        'Message with newline\n',
        'Message with tab\t',
        'Message with carriage return\r',
        'Message with null character\0',
        'Message with vertical tab\v',
        'Message with form feed\f',
        'Message with backspace\b'
      ];

      // The current implementation doesn't check for control characters
      // so these messages should pass validation
      messagesWithControlChars.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

    });
  });

  describe('Message content validation', () => {
  it('should return valid for messages with JSON content', () => {
      const jsonMessages = [
        JSON.stringify({ action: 'login', timestamp: Date.now() }),
        JSON.stringify({ data: { userId: 123, role: 'admin' } }),
        JSON.stringify([1, 2, 3, 4, 5])
      ];

      jsonMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

  it('should return valid for messages with URL content', () => {
      const urlMessages = [
        'https://example.com',
        'http://localhost:3000/api/auth?token=123',
        'https://api.example.org/v1/resources/123#section'
      ];

      urlMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

  it('should return valid for messages with timestamp content', () => {
      const timestampMessages = [
        `Login request at ${Date.now()}`,
        `Verify my account: ${new Date().toISOString()}`,
        `Auth: ${Math.floor(Date.now() / 1000)}` // Unix timestamp
      ];

      timestampMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Message security validation', () => {
  it('should return valid for messages with potential XSS content (current implementation)', () => {
      const xssMessages = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')" />',
        '" onmouseover="alert(\'XSS\')"'
      ];

      // The current implementation doesn't check for XSS content
      // so these messages should pass validation
      xssMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

    });

  it('should return valid for messages with potential SQL injection content (current implementation)', () => {
      const sqlInjectionMessages = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "\" OR \"1\"=\"1",
        "1; SELECT * FROM users"
      ];

      // The current implementation doesn't check for SQL injection content
      // so these messages should pass validation
      sqlInjectionMessages.forEach(message => {
        const input = {
          walletAddress: validWalletAddress,
          message,
          signature: validSignature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

    });
  });
});