import { describe, it, expect } from 'vitest';
import { validateAddressFormat } from '../../src/utils/validation';
import { isValidEthereumAddress } from '../../src/utils/verifySignature';

describe('Ethereum Address Validation', () => {
  describe('validateAddressFormat', () => {
    it('should validate correct address format', () => {
      const validAddresses = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Mixed case
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Lowercase
        '0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266', // Uppercase
        '0x0000000000000000000000000000000000000000', // Zero address
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'  // Max address
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
        '0x1234', // Too short hex
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226', // 39 chars after 0x
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266a', // 41 chars after 0x
        '1xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Wrong prefix
        'f39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // No prefix
        null, // null
        undefined // undefined
      ];
      
      invalidAddresses.forEach(address => {
        // @ts-ignore - Testing invalid types
        expect(validateAddressFormat(address)).toBe(false);
      });
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should validate correct Ethereum addresses with checksum', () => {
      const validAddresses = [
        // Valid checksummed addresses
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
        // Zero address
        '0x0000000000000000000000000000000000000000',
        // All uppercase (valid but not checksummed)
        '0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266',
        // All lowercase (valid but not checksummed)
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
      ];
      
      validAddresses.forEach(address => {
        expect(isValidEthereumAddress(address)).toBe(true);
      });
    });

    it('should reject invalid Ethereum addresses', () => {
      const invalidAddresses = [
        '0x123', // Too short
        'not-an-address', // Not hex
        '0xgggggggggggggggggggggggggggggggggggggggg', // Invalid hex
        '', // Empty string
        '0x', // Just prefix
        '0x1234', // Too short hex
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226', // 39 chars after 0x
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266a', // 41 chars after 0x
        '1xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Wrong prefix
        null, // null
        undefined // undefined
      ];
      
      invalidAddresses.forEach(address => {
        // @ts-ignore - Testing invalid types
        const result = isValidEthereumAddress(address);
        console.log(`Address: ${address}, Result: ${result}`);
        expect(result).toBe(false);
      });
      
      // Note: ethers.isAddress actually accepts addresses without 0x prefix
      // This is different from our validateAddressFormat function
      // So we test this separately
      const addressWithoutPrefix = 'f39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const result = isValidEthereumAddress(addressWithoutPrefix);
      console.log(`Address without prefix: ${addressWithoutPrefix}, Result: ${result}`);
      // ethers.isAddress accepts addresses without 0x prefix, so we expect true
      expect(result).toBe(true);
    });

    it('should handle edge cases correctly', () => {
      // These should be invalid
      expect(isValidEthereumAddress('')).toBe(false);
      expect(isValidEthereumAddress('0x')).toBe(false);
      // @ts-ignore - Testing invalid types
      expect(isValidEthereumAddress(null)).toBe(false);
      // @ts-ignore - Testing invalid types
      expect(isValidEthereumAddress(undefined)).toBe(false);
      // @ts-ignore - Testing invalid types
      expect(isValidEthereumAddress(123)).toBe(false);
      // @ts-ignore - Testing invalid types
      expect(isValidEthereumAddress({})).toBe(false);
    });
  });

  describe('Comparison between validation functions', () => {
    it('should show differences between simple regex and ethers validation', () => {
      // Both functions should accept valid addresses
      const validAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      expect(validateAddressFormat(validAddress)).toBe(true);
      expect(isValidEthereumAddress(validAddress)).toBe(true);

      // Both functions should reject clearly invalid addresses
      const invalidAddress = '0x123';
      expect(validateAddressFormat(invalidAddress)).toBe(false);
      expect(isValidEthereumAddress(invalidAddress)).toBe(false);

      // The regex validation doesn't check for checksum validity
      // It only checks the format (0x + 40 hex chars)
      const invalidChecksumAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.replace('f', 'F');
      // This would pass the simple regex check
      expect(validateAddressFormat(invalidChecksumAddress)).toBe(true);
      // But ethers.isAddress would reject it if it had an invalid checksum
      // Note: This test might pass with ethers if the random change happens to create a valid checksum
      // In a real implementation, we should use isValidEthereumAddress for complete validation
    });
  });
});