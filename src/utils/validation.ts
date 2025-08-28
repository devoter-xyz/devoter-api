/**
 * Validation utilities for request input
 */

export interface WalletAuthInput {
  walletAddress: string;
  message: string;
  signature: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates the structure and format of wallet authentication input
 */
export function validateWalletAuthInput(input: any): ValidationResult {
  // Check if input exists and is an object
  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      error: "Request body must be a valid JSON object",
    };
  }

  const { walletAddress, message, signature } = input;

  // Check required fields
  if (!walletAddress || !message || !signature) {
    return {
      isValid: false,
      error: "Missing required fields: walletAddress, message, signature",
    };
  }

  // Validate field types
  if (
    typeof walletAddress !== "string" ||
    typeof message !== "string" ||
    typeof signature !== "string"
  ) {
    return {
      isValid: false,
      error: "walletAddress, message, and signature must be strings",
    };
  }

  // Validate wallet address format (Ethereum address)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(walletAddress)) {
    return {
      isValid: false,
      error: "Invalid Ethereum wallet address format",
    };
  }

  // Validate signature format (Ethereum signature)
  const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
  if (!signatureRegex.test(signature)) {
    return {
      isValid: false,
      error:
        "Invalid signature format. Must be a valid Ethereum signature (0x + 130 hex chars)",
    };
  }

  // Validate message is not empty
  if (message.trim().length === 0) {
    return {
      isValid: false,
      error: "Message cannot be empty",
    };
  }

  // Validate message length (reasonable limits)
  if (message.length > 1000) {
    return {
      isValid: false,
      error: "Message too long (max 1000 characters)",
    };
  }

  return { isValid: true };
}

/**
 * Validates Ethereum signature format
 */
export function validateSignatureFormat(signature: string): boolean {
  const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
  return signatureRegex.test(signature);
}

/**
 * Validates Ethereum address format
 */
export function validateAddressFormat(address: string): boolean {
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}
