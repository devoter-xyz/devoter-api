import { ethers } from "ethers";
import * as crypto from 'crypto';

/**
 * Verifies that a message was signed by the specified wallet address
 * @param message - The original message that was signed
 * @param signature - The signature from the wallet
 * @param walletAddress - The expected wallet address
 * @returns boolean - True if signature is valid, false otherwise
 */
/**
 * Verifies that a message was signed by the specified wallet address.
 * This function trims whitespace from the message and signature for robustness.
 *
 * @param message - The original message that was signed.
 * @param signature - The signature from the wallet.
 * @param walletAddress - The expected wallet address.
 * @returns An object indicating if the signature is valid and an error message if not.
 *
 * @example
 * // Example usage:
 * // const message = "Hello, World!";
 * // const signature = "0x..."; // A valid signature for the message
 * // const walletAddress = "0x..."; // The address that signed the message
 * // const { isValid, error } = verifySignature(message, signature, walletAddress);
 * // if (isValid) {
 * //   console.log("Signature is valid!");
 * // } else {
 * //   console.error("Signature verification failed:", error);
 * // }
 */
export function verifySignature(
  message: string,
  signature: string,
  walletAddress: string
): { isValid: boolean; error?: string } {
  const trimmedMessage = message.trim();
  const trimmedSignature = signature.trim();
  const trimmedWalletAddress = walletAddress.trim();

  if (!trimmedMessage) {
    return { isValid: false, error: "Message cannot be empty or just whitespace" };
  }
  if (!trimmedSignature) {
    return { isValid: false, error: "Signature cannot be empty or just whitespace" };
  }
  if (!trimmedWalletAddress) {
    return { isValid: false, error: "Wallet address cannot be empty or just whitespace" };
  }

  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(trimmedMessage, trimmedSignature);

    // Convert addresses to buffers for timing-safe comparison
    const recoveredBuffer = Buffer.from(recoveredAddress.toLowerCase());
    const walletBuffer = Buffer.from(trimmedWalletAddress.toLowerCase());

    // Ensure buffers are of the same length to prevent timing leaks
    // Pad with a non-matching character if lengths differ to maintain timing safety
    const maxLength = Math.max(recoveredBuffer.length, walletBuffer.length);
    const paddedRecovered = Buffer.alloc(maxLength, 0);
    const paddedWallet = Buffer.alloc(maxLength, 0);

    recoveredBuffer.copy(paddedRecovered);
    walletBuffer.copy(paddedWallet);

    // Compare addresses using timing-safe comparison
    if (crypto.timingSafeEqual(paddedRecovered, paddedWallet)) {
      return { isValid: true };
    } else {
      return { isValid: false, error: "Signature does not match the provided wallet address" };
    }
  } catch (error: any) {
    // ethers.verifyMessage can throw if signature is malformed or invalid
    return { isValid: false, error: `Signature verification failed: ${error.message || "Unknown error"}. Please check the signature format and content.` };
  }
}

/**
 * Verifies a signature with timestamp validation to prevent replay attacks.
 * The message is expected to contain a timestamp in the format: "Sign this message to <purpose>: [<13-digit-ms-timestamp>]".
 *
 * @param message - The original message containing the timestamp that was signed.
 * @param signature - The signature from the wallet.
 * @param walletAddress - The expected wallet address.
 * @param maxAgeMinutes - Optional. Maximum age of the message in minutes (default: 5).
 * @returns An object indicating if the signature and timestamp are valid, and an error message if not.
 *
 * @example
 * // Example usage:
 * // const purpose = "login";
 * // const message = generateSignMessage(purpose); // e.g., "Sign this message to login: [1678886400000]"
 * // const signature = "0x..."; // A valid signature for the message
 * // const walletAddress = "0x..."; // The address that signed the message
 * // const { isValid, error } = verifySignatureWithTimestamp(message, signature, walletAddress, 10); // 10 minutes max age
 * // if (isValid) {
 * //   console.log("Signature and timestamp are valid!");
 * // } else {
 * //   console.error("Timestamped signature verification failed:", error);
 * // }
 */

/**
 * Verifies signature with timestamp validation to prevent replay attacks
 * @param message - The message containing timestamp
 * @param signature - The signature from the wallet
 * @param walletAddress - The expected wallet address
 * @param maxAgeMinutes - Maximum age of the message in minutes (default: 5)
 * @returns object with verification result and details
 */
export function verifySignatureWithTimestamp(
  message: string,
  signature: string,
  walletAddress: string,
  maxAgeMinutes: number = 5
): { isValid: boolean; error?: string } {
  try {
    // First verify the signature
    const { isValid: isSignatureValid, error: signatureError } = verifySignature(message, signature, walletAddress);

    if (!isSignatureValid) {
      return { isValid: false, error: signatureError || "Invalid signature" };
    }

    // Extract timestamp from message (anchored to expected format)
    // Expected format: "Sign this message to <purpose>: [<13-digit-ms-timestamp>]"
    const timestampMatch = message.match(/^Sign this message to .+:\s*\[(\d{13})\]$/);

    if (!timestampMatch) {
      return { isValid: false, error: "No timestamp found in message" };
    }

    const timestamp = Number(timestampMatch[1]!);
    if (!Number.isSafeInteger(timestamp)) {
      return { isValid: false, error: "Invalid timestamp" };
    }
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000; // Convert to milliseconds

    const age = now - timestamp;
    if (age < 0) {
      return { isValid: false, error: "Message timestamp is in the future" };
    }
    if (age > maxAgeMs) {
      return { isValid: false, error: "Message has expired" };
    }

    return { isValid: true };
  } catch (error) {
    console.error("Error verifying signature with timestamp:", error);
    return { isValid: false, error: "Verification failed" };
  }
}

/**
 * Generates a message for signing with timestamp
 * @param purpose - The purpose of the message (e.g., "register", "create-api-key")
 * @returns string - Message to be signed
 */
export function generateSignMessage(purpose: string): string {
  const timestamp = Date.now();
  return `Sign this message to ${purpose}: [${timestamp}]`;
}

/**
 * Validates Ethereum address format
 * @param address - The address to validate
 * @returns boolean - True if valid address format
 */
export function isValidEthereumAddress(address: string): boolean {
  try {
    // Explicitly check for '0x' prefix first
    if (typeof address !== 'string' || !address.startsWith('0x')) {
      return false;
    }
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}
