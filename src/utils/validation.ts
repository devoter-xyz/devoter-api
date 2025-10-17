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

export interface CommentInput {
  user?: string;
  comment?: string;
}

/**
 * Validates the structure and format of comment input
 */
export function validateCommentInput(input: CommentInput): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, error: "Request body must be a valid JSON object" };
  }

  const { user, comment } = input;

  if (!Object.prototype.hasOwnProperty.call(input, "user") || !user || typeof user !== "string" || user.trim().length === 0) {
    return { isValid: false, error: "User is required and must be a non-empty string" };
  }

  if (!Object.prototype.hasOwnProperty.call(input, "comment") || !comment || typeof comment !== "string" || comment.trim().length === 0) {
    return { isValid: false, error: "Comment is required and must be a non-empty string" };
  }

  return { isValid: true };
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

  // Check if input is an object
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      isValid: false,
      error: "Request body must be a valid JSON object",
    };
  }

  // Check required fields
  if (
    !Object.prototype.hasOwnProperty.call(input, "walletAddress") ||
    !Object.prototype.hasOwnProperty.call(input, "message") ||
    !Object.prototype.hasOwnProperty.call(input, "signature")
  ) {
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

  // Validate message content
  if (message.trim().length === 0) {
    return {
      isValid: false,
      error: "Message cannot be empty",
    };
  }

  if (message.length > 1000) {
    return {
      isValid: false,
      error: "Message too long (max 1000 characters)",
    };
  }

  // Validate signature format
  const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
  if (!signatureRegex.test(signature)) {
    return {
      isValid: false,
      error:
        "Invalid signature format. Must be a valid Ethereum signature (0x + 130 hex chars)",
    };
  }

  // Validate wallet address format
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(walletAddress)) {
    return {
      isValid: false,
      error: "Invalid Ethereum wallet address format",
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
