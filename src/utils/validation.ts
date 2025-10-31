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
 * Helper to check if a value is a non-empty string within a given length range.
 */
export function isStringAndNotEmpty(value: any, minLength: number = 1, maxLength: number = Infinity): boolean {
  return typeof value === "string" && value.trim().length >= minLength && value.trim().length <= maxLength;
}

/**
 * Validates Ethereum address format.
 * @param address - The Ethereum address string to validate.
 * @returns True if the address format is valid, false otherwise.
 */
export function isValidEthereumAddressFormat(address: string): boolean {
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}

/**
 * Validates Ethereum signature format.
 * @param signature - The Ethereum signature string to validate.
 * @returns True if the signature format is valid, false otherwise.
 */
export function isValidEthereumSignatureFormat(signature: string): boolean {
  const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
  return signatureRegex.test(signature);
}

/**
 * Validates the structure and format of comment input.
 * @param input - The comment input object containing 'user' and 'comment' fields.
 * @returns A ValidationResult object indicating if the input is valid and an error message if not.
 */
export function validateCommentInput(input: CommentInput): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, error: "Request body must be a valid JSON object" };
  }

  const { user, comment } = input;

  if (!isStringAndNotEmpty(user, 3, 50)) {
    return { isValid: false, error: "User is required and must be a string between 3 and 50 characters" };
  }

  if (!isStringAndNotEmpty(comment, 1, 500)) {
    return { isValid: false, error: "Comment is required and must be a string between 1 and 500 characters" };
  }

  return { isValid: true };
}

/**
 * Validates the structure and format of wallet authentication input.
 * @param input - The wallet authentication input object containing 'walletAddress', 'message', and 'signature' fields.
 * @returns A ValidationResult object indicating if the input is valid and an error message if not.
 */
export function validateWalletAuthInput(input: any): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, error: "Request body must be a valid JSON object" };
  }

  const { walletAddress, message, signature } = input;

  if (!Object.prototype.hasOwnProperty.call(input, "walletAddress") ||
      !Object.prototype.hasOwnProperty.call(input, "message") ||
      !Object.prototype.hasOwnProperty.call(input, "signature")) {
    return { isValid: false, error: "Missing required fields: walletAddress, message, signature" };
  }

  if (!isStringAndNotEmpty(walletAddress)) {
    return { isValid: false, error: "walletAddress must be a non-empty string" };
  }
  if (!isStringAndNotEmpty(message, 1, 1000)) {
    return { isValid: false, error: "message must be a string between 1 and 1000 characters" };
  }
  if (!isStringAndNotEmpty(signature)) {
    return { isValid: false, error: "signature must be a non-empty string" };
  }

  if (!isValidEthereumAddressFormat(walletAddress)) {
    return { isValid: false, error: "Invalid Ethereum wallet address format" };
  }

  if (!isValidEthereumSignatureFormat(signature)) {
    return { isValid: false, error: "Invalid signature format. Must be a valid Ethereum signature (0x + 130 hex chars)" };
  }

  return { isValid: true };
}
