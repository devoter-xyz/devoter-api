
// Import test utilities from Vitest
import { describe, it, expect } from "vitest";

// Import address validation utilities
import { isValidEthereumAddressFormat } from "../../src/utils/validation";
import { isValidEthereumAddress } from "../../src/utils/verifySignature";

// Test suite for Ethereum address validation utilities
describe("Ethereum Address Validation", () => {
  // Tests for the validateAddressFormat function (simple regex check)
  describe("isValidEthereumAddressFormat", () => {
  // Should validate correct Ethereum address formats (regex only)
  it("should return true for valid Ethereum address format (regex only)", () => {
      const validAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Mixed case
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Lowercase
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // Uppercase
        "0x0000000000000000000000000000000000000000", // Zero address
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // Max address
      ];

      validAddresses.forEach((address) => {
        expect(isValidEthereumAddressFormat(address)).toBe(true);
      });
    });

  // Should reject invalid Ethereum address formats (regex only)
  it("should return false for invalid Ethereum address formats (regex only)", () => {
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
        "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // No prefix
        null, // null
        undefined, // undefined
      ];

      invalidAddresses.forEach((address) => {
        // @ts-ignore - Testing invalid types
        expect(isValidEthereumAddressFormat(address)).toBe(false);
      });
    });
  });

  // Tests for the isValidEthereumAddress function (checksum and format)
  describe("isValidEthereumAddress", () => {
  // Should validate correct Ethereum addresses, including checksummed, zero, and case-insensitive
  it("should return true for valid Ethereum addresses (checksum, zero, case-insensitive)", () => {
      const validAddresses = [
        // Valid checksummed addresses
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
        "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
        // Zero address
        "0x0000000000000000000000000000000000000000",
        // All uppercase (valid but not checksummed)
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266",
        // All lowercase (valid but not checksummed)
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      ];

      validAddresses.forEach((address) => {
        expect(isValidEthereumAddress(address)).toBe(true);
      });
    });

  // Should reject invalid Ethereum addresses (bad format, prefix, or type)
  it("should return false for invalid Ethereum addresses (bad format, prefix, or type)", () => {
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
        const result = isValidEthereumAddress(address);
        console.log(`Address: ${address}, Result: ${result}`);
        expect(result).toBe(false);
      });

      // Note: ethers.isAddress requires the '0x' prefix; addresses without it are invalid
      // This differs from validateAddressFormat's regex-only behavior; test explicitly:
      const addressWithoutPrefix = "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      expect(isValidEthereumAddress(addressWithoutPrefix)).toBe(false);
    });

  // Should handle edge cases (empty, null, undefined, non-string)
  it("should return false for edge cases (empty, null, undefined, non-string)", () => {
      // These should be invalid
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

  // Comparison tests between validateAddressFormat and isValidEthereumAddress
  describe("Comparison between validation functions", () => {
  // Should show differences between simple regex and ethers.js validation
  it("should compare simple regex and ethers.js validation for Ethereum addresses", () => {
      // Both functions should accept valid addresses
      const validAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      expect(isValidEthereumAddressFormat(validAddress)).toBe(true);
      expect(isValidEthereumAddress(validAddress)).toBe(true);

      // Both functions should reject clearly invalid addresses
      const invalidAddress = "0x123";
      expect(isValidEthereumAddressFormat(invalidAddress)).toBe(false);
      expect(isValidEthereumAddress(invalidAddress)).toBe(false);

      // The regex validation doesn't check for checksum validity
      // It only checks the format (0x  40 hex chars)
      const invalidChecksumAddress =
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266".replace("f", "F");
      // This would pass the simple regex check
      expect(isValidEthereumAddressFormat(invalidChecksumAddress)).toBe(true);
      // But ethers.isAddress would reject it if it had an invalid checksum
      // In a real implementation, we should use isValidEthereumAddress for complete validation
    });
  });
});
