import { describe, it, expect } from "vitest";

// Import address validation utilities
import { isValidEthereumAddress, validateEIP55Checksum } from "../../src/utils/validation";
import { validationConfig } from "../../src/config/validation";

// Test suite for Ethereum address validation utilities
describe("Ethereum Address Validation", () => {
  // Tests for the isValidEthereumAddress function (format and optional checksum)
  describe("isValidEthereumAddress", () => {
    it("should return true for valid Ethereum address format (non-strict checksum)", () => {
      const validAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Mixed case (checksummed)
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Lowercase
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // Uppercase
        "0x0000000000000000000000000000000000000000", // Zero address
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // Max address
      ];

      validAddresses.forEach((address) => {
        expect(isValidEthereumAddress(address, false)).toBe(true); // Non-strict checksum
      });
    });

    it("should return true for valid EIP-55 checksummed addresses (strict checksum)", () => {
      const validChecksummedAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
        "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
        "0x0000000000000000000000000000000000000000", // Zero address is always valid
      ];

      validChecksummedAddresses.forEach((address) => {
        expect(isValidEthereumAddress(address, true)).toBe(true); // Strict checksum
      });
    });

    it("should return false for non-checksummed addresses when strict checksum is enabled", () => {
      const nonChecksummedAddresses = [
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Lowercase
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // Uppercase
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92265", // Invalid checksum (one char off)
      ];

      nonChecksummedAddresses.forEach((address) => {
        expect(isValidEthereumAddress(address, true)).toBe(false); // Strict checksum
      });
    });

    it("should return false for invalid Ethereum address formats", () => {
      const invalidAddresses = [
        "0x123", // Too short
        "not-an-address", // Not hex
        "0xgggggggggggggggggggggggggggggggggggggggg", // Invalid hex
        "", // Empty string
        "0x", // Just prefix
        "0x1234", // Too short hex
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226", // 39 chars after 0x
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266a", // 41 chars after 0x
        "1xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Wrong prefix
        null, // null
        undefined, // undefined
      ];

      invalidAddresses.forEach((address) => {
        // @ts-ignore - Testing invalid types
        expect(isValidEthereumAddress(address)).toBe(false);
      });
    });

    it("should handle edge cases (empty, null, undefined, non-string)", () => {
      expect(isValidEthereumAddress("")).toBe(false);
      expect(isValidEthereumAddress("0x")).toBe(false);
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

  // Tests for the validateEIP55Checksum function
  describe("validateEIP55Checksum", () => {
    it("should return true for valid EIP-55 checksummed addresses (strict mode)", () => {
      const validChecksummedAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
        "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
        "0x0000000000000000000000000000000000000000",
      ];

      validChecksummedAddresses.forEach((address) => {
        expect(validateEIP55Checksum(address, true)).toBe(true);
      });
    });

    it("should return false for non-checksummed addresses when strict mode is enabled", () => {
      const nonChecksummedAddresses = [
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Lowercase
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // Uppercase
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92265", // Invalid checksum (one char off)
      ];

      nonChecksummedAddresses.forEach((address) => {
        expect(validateEIP55Checksum(address, true)).toBe(false);
      });
    });

    it("should return true for all-lowercase or all-uppercase addresses when strict mode is disabled", () => {
      const relaxedAddresses = [
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Lowercase
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // Uppercase
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Checksummed
      ];

      relaxedAddresses.forEach((address) => {
        expect(validateEIP55Checksum(address, false)).toBe(true);
      });
    });

    it("should return false for invalid address formats (strict or non-strict)", () => {
      const invalidFormats = [
        "0x123",
        "not-an-address",
        "0xgggggggggggggggggggggggggggggggggggggggg",
        "",
        null,
        undefined,
      ];

      invalidFormats.forEach((address) => {
        // @ts-ignore
        expect(validateEIP55Checksum(address, true)).toBe(false);
        // @ts-ignore
        expect(validateEIP55Checksum(address, false)).toBe(false);
      });
    });
  });

  // Test for default configuration behavior
  describe("Default Checksum Validation Behavior", () => {
    it("should use the default EIP55_CHECKSUM_VALIDATION_ENABLED setting", () => {
      // Assuming validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED is true by default
      const validChecksummed = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const lowercaseAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

      // When no strictChecksum is provided, it should use the default config
      if (validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED) {
        expect(isValidEthereumAddress(validChecksummed)).toBe(true);
        expect(isValidEthereumAddress(lowercaseAddress)).toBe(false);
        expect(validateEIP55Checksum(validChecksummed)).toBe(true);
        expect(validateEIP55Checksum(lowercaseAddress)).toBe(false);
      } else {
        expect(isValidEthereumAddress(validChecksummed)).toBe(true);
        expect(isValidEthereumAddress(lowercaseAddress)).toBe(true);
        expect(validateEIP55Checksum(validChecksummed)).toBe(true);
        expect(validateEIP55Checksum(lowercaseAddress)).toBe(true);
      }
    });
  });
});