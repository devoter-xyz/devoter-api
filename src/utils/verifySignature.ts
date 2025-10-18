import { ethers } from "ethers";

/**
 * Verifies that a message was signed by the specified wallet address
 * @param message - The original message that was signed
 * @param signature - The signature from the wallet
 * @param walletAddress - The expected wallet address
 * @returns boolean - True if signature is valid, false otherwise
 */
export function verifySignature(
  message: string,
  signature: string,
  walletAddress: string
): { isValid: boolean; error?: string } {
  if (!message) {
    return { isValid: false, error: "Message cannot be empty" };
  }
  if (!signature) {
    return { isValid: false, error: "Signature cannot be empty" };
  }
  if (!walletAddress) {
    return { isValid: false, error: "Wallet address cannot be empty" };
  }

  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // Compare addresses (case-insensitive)
    if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
      return { isValid: true };
    } else {
      return { isValid: false, error: "Signature does not match wallet address" };
    }
  } catch (error: any) {
    // ethers.verifyMessage can throw if signature is malformed
    return { isValid: false, error: `Signature verification failed: ${error.message || error}` };
  }
}

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
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}
