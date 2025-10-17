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
import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  verifySignature,
  verifySignatureWithTimestamp,
  generateSignMessage,
  isValidEthereumAddress,
} from "../../src/utils/verifySignature";

// --- Basic Signature Verification ---
// These tests check the core signature verification logic for Ethereum wallets.
describe("Basic Signature Verification", () => {
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
  it("should be case-insensitive for wallet addresses (mixed, lower, upper, checksum)", async () => {
    // Create a wallet for signing
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Test message for case sensitivity";

    // Sign the message
    const signature = await wallet.signMessage(message);

    // Test with original address (mixed case)
    const originalAddressResult = verifySignature(
      message,
      signature,
      wallet.address
    );
    expect(originalAddressResult.isValid).toBe(true);
    expect(originalAddressResult.error).toBeUndefined();

    // Test with lowercase address
    const lowercaseAddressResult = verifySignature(
      message,
      signature,
      wallet.address.toLowerCase()
    );
    expect(lowercaseAddressResult.isValid).toBe(true);
    expect(lowercaseAddressResult.error).toBeUndefined();

    // Test with uppercase address
    const uppercaseAddressResult = verifySignature(
      message,
      signature,
      wallet.address.toUpperCase()
    );
    expect(uppercaseAddressResult.isValid).toBe(true);
    expect(uppercaseAddressResult.error).toBeUndefined();

    // Test with mixed case variations
    const mixedCaseAddress1 = wallet.address.toLowerCase().replace(/^0x/, "0X");
    const mixedCaseResult1 = verifySignature(
      message,
      signature,
      mixedCaseAddress1
    );
    expect(mixedCaseResult1.isValid).toBe(true);
    expect(mixedCaseResult1.error).toBeUndefined();

    // Test with checksum address (EIP-55)
    const checksumAddress = ethers.getAddress(wallet.address);
    const checksumResult = verifySignature(message, signature, checksumAddress);
    expect(checksumResult.isValid).toBe(true);
    expect(checksumResult.error).toBeUndefined();
  });

  /**
   * Test signature verification with real-world Ethereum address formats.
   * Ensures compatibility with various address representations.
   */
  it("should work with various real-world Ethereum wallet address formats", async () => {
    // Test with a well-known Ethereum address (Vitalik's public address)
    const realWallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Real wallet test message";
    const signature = await realWallet.signMessage(message);

    // Test various real-world address formats
    const addressFormats = [
      realWallet.address, // Original format
      realWallet.address.toLowerCase(), // All lowercase
      realWallet.address.toUpperCase(), // All uppercase
      ethers.getAddress(realWallet.address), // EIP-55 checksum
    ];

    for (const addressFormat of addressFormats) {
      const result = verifySignature(message, signature, addressFormat);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
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
    expect(emptyResult.error).toBe("Signature cannot be empty");

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
    expect(result.error).toBe("Message cannot be empty");
  });

  it("should return false and an error for empty wallet address", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = "Test message";
    const signature = await wallet.signMessage(message);
    const result = verifySignature(message, signature, "");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Wallet address cannot be empty");
  });
});

// --- Timestamp Signature Verification ---
// These tests verify signatures that include a timestamp in the message, ensuring time-based validity.
describe("Timestamp Signature Verification", () => {
  /**
   * Test that timestamped signature verification is case-insensitive for wallet addresses.
   * This ensures robust handling of address formats in time-based checks.
   */
  it("should be case-insensitive for wallet addresses in timestamped signature verification", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );

    // Generate a fresh timestamped message
    const message = generateSignMessage("test-case-sensitivity");
    const signature = await wallet.signMessage(message);

    // Test with different case variations
    const addressVariations = [
      wallet.address, // Original mixed case
      wallet.address.toLowerCase(), // All lowercase
      wallet.address.toUpperCase(), // All uppercase
      ethers.getAddress(wallet.address), // EIP-55 checksum
    ];

    for (const addressVariation of addressVariations) {
      const { isValid, error } = verifySignatureWithTimestamp(
        message,
        signature,
        addressVariation,
        5 // 5 minutes max age
      );
      expect(isValid).toBe(true);
      expect(error).toBeUndefined();
    }
  });

  /**
   * Test that recent (non-expired) timestamped signatures are accepted.
   * Ensures the function allows valid, timely signatures.
   */
  it("should return valid for recent (non-expired) timestamped signatures", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );

    const message = generateSignMessage("test-recent");
    const signature = await wallet.signMessage(message);

    const { isValid, error } = verifySignatureWithTimestamp(
      message,
      signature,
      wallet.address,
      5 // 5 minutes max age
    );

    expect(isValid).toBe(true);
    expect(error).toBeUndefined();
  });

  /**
   * Test that expired timestamped signatures are rejected.
   * Ensures the function enforces expiration windows.
   */
  it("should return false for expired timestamped signatures", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );

    // Create a message with an old timestamp (10 minutes ago)
    const oldTimestamp = Date.now() - 10 * 60 * 1000;
    const expiredMessage = `Sign this message to test-expired: [${oldTimestamp}]`;
    const signature = await wallet.signMessage(expiredMessage);

    const { isValid, error } = verifySignatureWithTimestamp(
      expiredMessage,
      signature,
      wallet.address,
      5 // 5 minutes max age - should reject the 10-minute old signature
    );

    expect(isValid).toBe(false);
    expect(error).toBe("Message has expired");
  });

  /**
   * Test that signatures with a future timestamp are rejected.
   * Prevents accepting signatures that are not yet valid.
   */
  it("should return false for future timestamped signatures", async () => {
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );

    // Create a message with a future timestamp (10 minutes from now)
    const futureTimestamp = Date.now() + 10 * 60 * 1000;
    const futureMessage = `Sign this message to test-future: [${futureTimestamp}]`;
    const signature = await wallet.signMessage(futureMessage);

    const { isValid, error } = verifySignatureWithTimestamp(
      futureMessage,
      signature,
      wallet.address,
      5 // 5 minutes max age
    );

    expect(isValid).toBe(false);
    expect(error).toBe("Message timestamp is in the future");
  });
});

// --- Address Validation ---
// These tests check the Ethereum address validation utility for correct and incorrect formats.
describe("Address Validation", () => {
  /**
   * Test that valid Ethereum addresses (checksummed and lowercase) are accepted,
   * and invalid addresses (wrong length, non-hex, bad checksum, etc.) are rejected.
   */
  it("should return true for valid Ethereum address formats and false for invalid ones", () => {
    // Valid addresses (ethers.js is strict about EIP-55 checksum)
    const validAddresses = [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Mixed case (EIP-55 checksum)
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // All lowercase (valid)
    ];

    for (const address of validAddresses) {
      expect(isValidEthereumAddress(address)).toBe(true);
    }

    // Invalid addresses
    const invalidAddresses = [
      "0x123", // Too short
      "not-an-address", // Not hex
      "0xgggggggggggggggggggggggggggggggggggggggg", // Invalid hex characters
      "", // Empty string
      "0x", // Just prefix
      "0XF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266", // All uppercase (invalid EIP-55)
    ];

    for (const address of invalidAddresses) {
      expect(isValidEthereumAddress(address)).toBe(false);
    }
  });
});
