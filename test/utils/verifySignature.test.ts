import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { verifySignature } from "../../src/utils/verifySignature.js";

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
});
