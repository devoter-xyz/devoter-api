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
): boolean {
  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // Compare addresses (case-insensitive)
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
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
    const isSignatureValid = verifySignature(message, signature, walletAddress);

    if (!isSignatureValid) {
      return { isValid: false, error: "Invalid signature" };
    }

    // Extract timestamp from message
    // Expected format: "Sign this message to authenticate: [timestamp]"
    const timestampMatch = message.match(/\[(\d+)\]/);

    if (!timestampMatch) {
      return { isValid: false, error: "No timestamp found in message" };
    }

    const timestamp = parseInt(timestampMatch[1]!);
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds

    if (now - timestamp > maxAge) {
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
