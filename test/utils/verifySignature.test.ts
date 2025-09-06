import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  verifySignature,
  verifySignatureWithTimestamp,
  generateSignMessage,
  isValidEthereumAddress,
} from "../../src/utils/verifySignature";

describe("Basic Signature Verification", () => {
  // Test valid signatures from known wallet addresses
  it("should return true for a valid signature from a known wallet", async () => {
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
    expect(result).toBe(true);
  });

  // Test invalid signatures (wrong message, wrong address)
  it("should return false for invalid signatures with wrong message or address", async () => {
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
    expect(wrongMessageResult).toBe(false);

    // Test with wrong wallet address
    const wrongAddressResult = verifySignature(
      message,
      signature,
      differentWallet.address
    );
    expect(wrongAddressResult).toBe(false);
  });

  // Test case sensitivity in wallet addresses
  it("should handle case sensitivity correctly in wallet addresses", async () => {
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
    expect(originalAddressResult).toBe(true);

    // Test with lowercase address
    const lowercaseAddressResult = verifySignature(
      message,
      signature,
      wallet.address.toLowerCase()
    );
    expect(lowercaseAddressResult).toBe(true);

    // Test with uppercase address
    const uppercaseAddressResult = verifySignature(
      message,
      signature,
      wallet.address.toUpperCase()
    );
    expect(uppercaseAddressResult).toBe(true);

    // Test with mixed case variations
    const mixedCaseAddress1 = wallet.address.toLowerCase().replace(/^0x/, "0X");
    const mixedCaseResult1 = verifySignature(
      message,
      signature,
      mixedCaseAddress1
    );
    expect(mixedCaseResult1).toBe(true);

    // Test with checksum address (EIP-55)
    const checksumAddress = ethers.getAddress(wallet.address);
    const checksumResult = verifySignature(message, signature, checksumAddress);
    expect(checksumResult).toBe(true);
  });

  // Test with real Ethereum wallet examples
  it("should work with real Ethereum wallet address formats", async () => {
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
      expect(result).toBe(true);
    }
  });

  // Verify handling of signature recovery edge cases
  it("should handle signature recovery edge cases", async () => {
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
    expect(invalidResult).toBe(false);

    // Test with empty signature
    const emptyResult = verifySignature(message, "", wallet.address);
    expect(emptyResult).toBe(false);

    // Test with signature that's too short
    const shortSignature = "0x1234";
    const shortResult = verifySignature(
      message,
      shortSignature,
      wallet.address
    );
    expect(shortResult).toBe(false);
  });
});

describe("Timestamp Signature Verification", () => {
  // Test case sensitivity with timestamp verification
  it("should handle case sensitivity in wallet addresses with timestamp verification", async () => {
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

  // Test timestamp validation with recent signatures
  it("should validate recent timestamped signatures", async () => {
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

  // Test expired timestamp handling
  it("should reject expired timestamped signatures", async () => {
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

  // Test future timestamp handling
  it("should reject future timestamped signatures", async () => {
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

describe("Address Validation", () => {
  // Test Ethereum address validation
  it("should validate Ethereum address formats correctly", () => {
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
