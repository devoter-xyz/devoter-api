//
// Unit tests for Ethereum signature and address verification utilities.
//
// This file tests:
//   - Basic signature verification for Ethereum wallets
//   - Timestamped signature verification (with expiration and future checks)
//   - Ethereum address format validation
//
// Each test suite and test case is documented for clarity.
//
import { describe, it, expect, beforeEach } from "vitest";
import { ethers, Wallet } from "ethers";
import * as ValidationUtils from "../../src/utils/validation";
import {
  verifySignature,
  verifySignatureWithTimestamp,
  generateSignMessage,
} from "../../src/utils/verifySignature";

// --- Basic Signature Verification ---
// These tests check the core signature verification logic for Ethereum wallets.
    let wallet: Wallet;
    let message: string;
    let signature: string;

    beforeEach(async () => {
      wallet = Wallet.createRandom();
      message = "Hello, Vitest!";
      signature = await wallet.signMessage(message);
    });
  /**
   * Test that a valid signature from a known wallet address is accepted.
   * This ensures the verifySignature function works for correct inputs.
   */
  it("should return true for a valid signature from a known wallet address", async () => {
    // Create a wallet with a known private key for consistent testing
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Test message for verification";

    // Sign the message with the wallet
    const signature = await wallet.signMessage(message);

    // Verify the signature
    const result = verifySignature(message, signature, wallet.address);

    // The verification should succeed
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  /**
   * Test that invalid signatures (wrong message or wrong address) are rejected.
   * This checks that the function does not falsely validate incorrect signatures.
   */
  it("should return false for invalid signatures (wrong message or wrong address)", async () => {
    // Create a wallet for signing
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Original message";

    // Create a different wallet to test wrong address
    const differentWallet = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    );

    // Sign the original message
    const signature = await wallet.signMessage(message);

    // Test with wrong message
    const wrongMessageResult = verifySignature(
      "Different message",
      signature,
      wallet.address
    );
    expect(wrongMessageResult.isValid).toBe(false);
    expect(wrongMessageResult.error).toBeDefined();

    // Test with wrong wallet address
    const wrongAddressResult = verifySignature(
      message,
      signature,
      differentWallet.address
    );
    expect(wrongAddressResult.isValid).toBe(false);
    expect(wrongAddressResult.error).toBeDefined();
  });

  /**
   * Test that the function is case-insensitive with respect to wallet addresses.
   * Ethereum addresses can be checksummed, lowercase, uppercase, or mixed case.
   */
    it("should return true for valid checksummed addresses, and false for non-checksummed when strict", async () => {
      const validChecksummedAddress = wallet.address;
      const lowercaseAddress = wallet.address.toLowerCase();
      const uppercaseAddress = wallet.address.toUpperCase();

      // When validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED is true (default)
      // Valid checksummed address should pass
      const { isValid: validChecksummedIsValid } = verifySignature(message, signature, validChecksummedAddress);
      expect(validChecksummedIsValid).toBe(true);

      // Lowercase and uppercase addresses should fail if strict checksum is enabled
      const { isValid: lowercaseIsValid } = verifySignature(message, signature, lowercaseAddress);
      expect(lowercaseIsValid).toBe(false);

      const { isValid: uppercaseIsValid } = verifySignature(message, signature, uppercaseAddress);
      expect(uppercaseIsValid).toBe(false);
    });

  /**
   * Test signature verification with real-world Ethereum address formats.
   * Ensures compatibility with various address representations.
   */
      it("should return true for valid checksummed addresses in various real-world formats, and false for non-checksummed when strict", async () => {
        // Test with a well-known Ethereum address (Vitalik's public address)
        const realWallet = new ethers.Wallet(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        );
        const message = "Real wallet test message";
        const signature = await realWallet.signMessage(message);
  
        // Test various real-world address formats
        const addressFormats = [
          realWallet.address, // Original format (checksummed)
          ethers.getAddress(realWallet.address), // EIP-55 checksum
        ];
  
        for (const addressFormat of addressFormats) {
          const result = verifySignature(message, signature, addressFormat);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
        }
  
        // Non-checksummed addresses should fail if strict checksum is enabled
        const nonChecksummedFormats = [
          realWallet.address.toLowerCase(), // All lowercase
          realWallet.address.toUpperCase(), // All uppercase
        ];
  
        for (const addressFormat of nonChecksummedFormats) {
          const result = verifySignature(message, signature, addressFormat);
          expect(result.isValid).toBe(false);
          expect(result.error).toBe("Invalid Ethereum wallet address provided.");
        }
      });
  /**
   * Test edge cases for signature recovery, such as invalid, empty, or too-short signatures.
   * Ensures the function fails gracefully for malformed input.
   */
  it("should return false for signature recovery edge cases (invalid, empty, too short)", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Edge case test";
    const signature = await wallet.signMessage(message);

    // Test with completely invalid signature format
    const invalidSignature = "0xinvalidsignature";
    const invalidResult = verifySignature(
      message,
      invalidSignature,
      wallet.address
    );
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.error).toBeDefined();
    expect(invalidResult.error).toContain("Signature verification failed");

    // Test with empty signature
    const emptyResult = verifySignature(message, "", wallet.address);
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.error).toBe("Signature cannot be empty or just whitespace");

    // Test with signature that's too short
    const shortSignature = "0x1234";
    const shortResult = verifySignature(
      message,
      shortSignature,
      wallet.address
    );
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toBeDefined();
    expect(shortResult.error).toContain("Signature verification failed");
  });

  /**
   * Test edge cases for verifySignature with empty or malformed inputs.
   * Ensures the function handles these gracefully and returns appropriate errors.
   */
  it("should return false and an error for empty message", () => {
    const walletAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const signature = "0x...some-valid-signature..."; // Placeholder, actual value doesn't matter for this test
    const result = verifySignature("", signature, walletAddress);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Message cannot be empty or just whitespace");
  });

      it("should return false and an error for empty wallet address", async () => {
        const wallet = new ethers.Wallet(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        );
        const message = "Test message";
        const signature = await wallet.signMessage(message);
        const result = verifySignature(message, signature, "");
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Invalid Ethereum wallet address provided.");
      });

// --- Timestamp Signature Verification ---
// These tests verify signatures that include a timestamp in the message, ensuring time-based validity.
  describe("Timestamp Signature Verification", () => {
    let wallet: Wallet;
    let purpose: string;
    let message: string;
    let signature: string;
    const maxAgeMinutes = 5;

    beforeEach(async () => {
      wallet = Wallet.createRandom();
      purpose = "login";
      // Generate a message with a timestamp that is within the maxAgeMinutes
      const timestamp = Date.now();
      message = `Sign this message to ${purpose}: [${timestamp}]`;
      signature = await wallet.signMessage(message);
    });

    it("should return true for valid checksummed addresses in timestamped signature verification", async () => {
      const validChecksummedAddress = wallet.address;
      const { isValid, error } = verifySignatureWithTimestamp(
        message,
        signature,
        validChecksummedAddress,
        maxAgeMinutes
      );
      expect(isValid).toBe(true);
      expect(error).toBeUndefined();
    });

    it("should return false for non-checksummed addresses in timestamped signature verification when strict", () => {
      const lowercaseAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
      const { isValid, error } = verifySignatureWithTimestamp(
        message,
        signature,
        lowercaseAddress,
        maxAgeMinutes
      );
      expect(isValid).toBe(false);
      expect(error).toBe("Invalid Ethereum wallet address provided.");
    });

    it("should return valid for recent (non-expired) timestamped signatures", () => {
      const { isValid, error } = verifySignatureWithTimestamp(
        message,
        signature,
        wallet.address,
        maxAgeMinutes
      );
      expect(isValid).toBe(true);
      expect(error).toBeUndefined();
    });

    it("should return false for expired timestamped signatures", async () => {
      // Create a message with an old timestamp
      const oldTimestamp = Date.now() - (maxAgeMinutes + 1) * 60 * 1000; // 1 minute past expiry
      const oldMessage = `Sign this message to ${purpose}: [${oldTimestamp}]`;
      const oldSignature = await wallet.signMessage(oldMessage);

      const { isValid, error } = verifySignatureWithTimestamp(
        oldMessage,
        oldSignature,
        wallet.address,
        maxAgeMinutes
      );
      expect(isValid).toBe(false);
      expect(error).toBe("Message has expired");
    });

    it("should return false for future timestamped signatures", async () => {
      // Create a message with a future timestamp
      const futureTimestamp = Date.now() + 1 * 60 * 1000; // 1 minute in the future
      const futureMessage = `Sign this message to ${purpose}: [${futureTimestamp}]`;
      const futureSignature = await wallet.signMessage(futureMessage);

      const { isValid, error } = verifySignatureWithTimestamp(
        futureMessage,
        futureSignature,
        wallet.address,
        maxAgeMinutes
      );
      expect(isValid).toBe(false);
      expect(error).toBe("Message timestamp is in the future");
    });
  });

// --- Address Validation ---
// These tests check the Ethereum address validation utility for correct and incorrect formats.
  describe("Address Validation", () => {
    it("should return true for valid Ethereum address formats and false for invalid ones", () => {
      // Valid addresses (ethers.js is strict about EIP-55 checksum)
      const validAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Mixed case (EIP-55 checksum)
        "0x0000000000000000000000000000000000000000", // Zero address
      ];

      for (const address of validAddresses) {
        expect(ValidationUtils.isValidEthereumAddress(address, true)).toBe(true);
      }

      // Invalid addresses
      const invalidAddresses = [
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // All lowercase (invalid EIP-55 if strict)
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // All uppercase (invalid EIP-55 if strict)
        "0x123", // Too short
        "not-an-address", // Not hex
        "0xgggggggggggggggggggggggggggggggggggggggg", // Invalid hex characters
        "", // Empty string
        "0x", // Just prefix
        null, // null
        undefined, // undefined
      ];

      for (const address of invalidAddresses) {
        expect(ValidationUtils.isValidEthereumAddress(address, true)).toBe(false);
      }

      // Test with non-strict checksum validation
      const relaxedValidAddresses = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266",
        "0x0000000000000000000000000000000000000000",
      ];
      for (const address of relaxedValidAddresses) {
        expect(ValidationUtils.isValidEthereumAddress(address, false)).toBe(true);
      }
      const relaxedInvalidAddresses = [
        "0x123",
        "not-an-address",
        "0xgggggggggggggggggggggggggggggggggggggggg",
        "",
        null,
        undefined,
      ];
      for (const address of relaxedInvalidAddresses) {
        // @ts-ignore
        expect(ValidationUtils.isValidEthereumAddress(address, false)).toBe(false);
      }
    });
  });
