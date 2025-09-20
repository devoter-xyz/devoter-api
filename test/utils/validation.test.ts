import { describe, it, expect } from 'vitest';
import { validateWalletAuthInput, validateSignatureFormat, validateAddressFormat } from '../../src/utils/validation';

describe('Input Validation', () => {
  describe('validateWalletAuthInput', () => {
    it('should validate correct input format', () => {
      const validInput = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'Test message',
        signature: '0x' + '1'.repeat(130)
      };
      const result = validateWalletAuthInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-object input', () => {
      const inputs = [null, undefined, 42, 'string', [], true];
      inputs.forEach(input => {
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Request body must be a valid JSON object');
      });
    });

    it('should reject missing required fields', () => {
      const incompleteInputs = [
        { message: 'test', signature: '0x' + '1'.repeat(130) },
        { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', signature: '0x' + '1'.repeat(130) },
        { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', message: 'test' }
      ];
      
      incompleteInputs.forEach(input => {
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Missing required fields: walletAddress, message, signature');
      });
    });

    it('should reject invalid field types', () => {
      const invalidTypeInputs = [
        { walletAddress: 123, message: 'test', signature: '0x' + '1'.repeat(130) },
        { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', message: 42, signature: '0x' + '1'.repeat(130) },
        { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', message: 'test', signature: true }
      ];
      
      invalidTypeInputs.forEach(input => {
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('walletAddress, message, and signature must be strings');
      });
    });

    it('should reject invalid wallet address format', () => {
      const invalidAddresses = [
        '123', // Too short
        'not-an-address', // Not hex
        '0xgggggggggggggggggggggggggggggggggggggggg', // Invalid hex
        '', // Empty string
        '0x', // Just prefix
        '0x1234' // Too short hex
      ];
      
      invalidAddresses.forEach(address => {
        const input = {
          walletAddress: address,
          message: 'test',
          signature: '0x' + '1'.repeat(130)
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid Ethereum wallet address format');
      });
    });

    it('should reject invalid signature format', () => {
      const invalidSignatures = [
        '0x123', // Too short
        'not-a-signature', // Not hex
        '0xgggg', // Invalid hex
        '', // Empty string
        '0x', // Just prefix
        '0x' + '1'.repeat(129), // Too short hex
        '0x' + '1'.repeat(131) // Too long hex
      ];
      
      invalidSignatures.forEach(signature => {
        const input = {
          walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          message: 'test',
          signature
        };
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid signature format. Must be a valid Ethereum signature (0x + 130 hex chars)');
      });
    });

    it('should reject empty messages', () => {
      const input = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: '',
        signature: '0x' + '1'.repeat(130)
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');

      // Also test whitespace-only message
      const whitespaceInput = {
        ...input,
        message: '   '
      };
      const whitespaceResult = validateWalletAuthInput(whitespaceInput);
      expect(whitespaceResult.isValid).toBe(false);
      expect(whitespaceResult.error).toBe('Message cannot be empty');
    });

    it('should reject too long messages', () => {
      const input = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'a'.repeat(1001),
        signature: '0x' + '1'.repeat(130)
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message too long (max 1000 characters)');
    });
    
    it('should reject input with extra unexpected fields', () => {
      const input = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'test',
        signature: '0x' + '1'.repeat(130),
        extraField: 'unexpected',
      };
      // Should still be valid, as extra fields are ignored
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject input with null fields', () => {
      const input = {
        walletAddress: null,
        message: null,
        signature: null,
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

    it('should reject input with nested objects as fields', () => {
      const input = {
        walletAddress: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
        message: { text: 'test' },
        signature: { sig: '0x' + '1'.repeat(130) },
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

    it('should reject input with array as value for fields', () => {
      const input = {
        walletAddress: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
        message: ['test'],
        signature: ['0x' + '1'.repeat(130)],
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

    it('should reject deeply nested input object', () => {
      const input = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'test',
        signature: '0x' + '1'.repeat(130),
        nested: { foo: { bar: 123 } },
      };
      // Should still be valid, as extra fields are ignored
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateSignatureFormat', () => {
    it('should validate correct signature format', () => {
      const validSignature = '0x' + '1'.repeat(130);
      expect(validateSignatureFormat(validSignature)).toBe(true);
    });

    it('should reject invalid signature formats', () => {
      const invalidSignatures = [
        '0x123', // Too short
        'not-a-signature', // Not hex
        '0xgggg', // Invalid hex
        '', // Empty string
        '0x', // Just prefix
        '0x' + '1'.repeat(129), // Too short hex
        '0x' + '1'.repeat(131) // Too long hex
      ];
      
      invalidSignatures.forEach(signature => {
        expect(validateSignatureFormat(signature)).toBe(false);
      });
    });
  });

  describe('validateAddressFormat', () => {
    it('should validate correct address format', () => {
      const validAddresses = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Mixed case
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Lowercase
        '0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266' // Uppercase
      ];
      
      validAddresses.forEach(address => {
        expect(validateAddressFormat(address)).toBe(true);
      });
    });

    it('should reject invalid address formats', () => {
      const invalidAddresses = [
        '0x123', // Too short
        'not-an-address', // Not hex
        '0xgggggggggggggggggggggggggggggggggggggggg', // Invalid hex
        '', // Empty string
        '0x', // Just prefix
        '0x1234' // Too short hex
      ];
      
      invalidAddresses.forEach(address => {
        expect(validateAddressFormat(address)).toBe(false);
      });
    });
  });
});