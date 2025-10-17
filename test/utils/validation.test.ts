import { describe, it, expect } from 'vitest';
import { validateWalletAuthInput, validateSignatureFormat, validateAddressFormat, validateCommentInput } from '../../src/utils/validation';

describe('Input Validation', () => {
  describe('validateWalletAuthInput', () => {
  it('should return valid for correct wallet authentication input', () => {
      const validInput = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'Test message',
        signature: '0x' + '1'.repeat(130)
      };
      const result = validateWalletAuthInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

  it('should reject non-object or primitive input (null, undefined, number, string, array, boolean)', () => {
      const inputs = [null, undefined, 42, 'string', [], true];
      inputs.forEach(input => {
        const result = validateWalletAuthInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Request body must be a valid JSON object');
      });
    });

  it('should reject input missing one or more required fields', () => {
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

  it('should reject input where walletAddress, message, or signature are not strings', () => {
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

  it('should reject input with invalid wallet address format', () => {
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

  it('should reject input with invalid signature format', () => {
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

  it('should reject input with empty or whitespace-only message', () => {
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

  it('should reject input with message exceeding 1000 characters', () => {
      const input = {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        message: 'a'.repeat(1001),
        signature: '0x' + '1'.repeat(130)
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message too long (max 1000 characters)');
    });
    
  it('should allow input with extra unexpected fields (ignored)', () => {
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

  it('should reject input where fields are null', () => {
      const input = {
        walletAddress: null,
        message: null,
        signature: null,
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

  it('should reject input where fields are nested objects', () => {
      const input = {
        walletAddress: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
        message: { text: 'test' },
        signature: { sig: '0x' + '1'.repeat(130) },
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

  it('should reject input where fields are arrays', () => {
      const input = {
        walletAddress: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
        message: ['test'],
        signature: ['0x' + '1'.repeat(130)],
      };
      const result = validateWalletAuthInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('walletAddress, message, and signature must be strings');
    });

  it('should allow deeply nested input object as long as required fields are valid', () => {
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

  describe('validateCommentInput', () => {
    it('should return valid for correct comment input', () => {
      const validInput = {
        user: 'testUser',
        comment: 'This is a test comment.',
      };
      const result = validateCommentInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject input missing user', () => {
      const invalidInput = {
        comment: 'This is a test comment.',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User is required and must be a non-empty string');
    });

    it('should reject input missing comment', () => {
      const invalidInput = {
        user: 'testUser',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Comment is required and must be a non-empty string');
    });

    it('should reject input with empty user string', () => {
      const invalidInput = {
        user: '',
        comment: 'This is a test comment.',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User is required and must be a non-empty string');
    });

    it('should reject input with whitespace-only user string', () => {
      const invalidInput = {
        user: '   ',
        comment: 'This is a test comment.',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User is required and must be a non-empty string');
    });

    it('should reject input with empty comment string', () => {
      const invalidInput = {
        user: 'testUser',
        comment: '',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Comment is required and must be a non-empty string');
    });

    it('should reject input with whitespace-only comment string', () => {
      const invalidInput = {
        user: 'testUser',
        comment: '   ',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Comment is required and must be a non-empty string');
    });

    it('should reject non-object or primitive input (null, undefined, number, string, array, boolean)', () => {
      const inputs = [null, undefined, 42, 'string', [], true];
      inputs.forEach(input => {
        const result = validateCommentInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Request body must be a valid JSON object');
      });
    });

    it('should reject input where user is not a string', () => {
      const invalidInput = {
        user: 123,
        comment: 'This is a test comment.',
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User is required and must be a non-empty string');
    });

    it('should reject input where comment is not a string', () => {
      const invalidInput = {
        user: 'testUser',
        comment: 123,
      };
      const result = validateCommentInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Comment is required and must be a non-empty string');
    });
  });

  describe('validateSignatureFormat', () => {
  it('should return true for valid Ethereum signature format', () => {
      const validSignature = '0x' + '1'.repeat(130);
      expect(validateSignatureFormat(validSignature)).toBe(true);
    });

  it('should return false for invalid Ethereum signature formats', () => {
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
  it('should return true for valid Ethereum address format', () => {
      const validAddresses = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Mixed case
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Lowercase
        '0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266' // Uppercase
      ];
      
      validAddresses.forEach(address => {
        expect(validateAddressFormat(address)).toBe(true);
      });
    });

  it('should return false for invalid Ethereum address formats', () => {
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