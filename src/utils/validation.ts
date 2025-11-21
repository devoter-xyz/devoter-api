import { sanitizeObject } from './sanitization';
import { getAddress, isAddress } from 'ethers';
import { validationConfig } from '../config/validation';

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
  sanitizedInput?: any;
}

export interface CommentInput {
  user: string;
  comment: string;
}

/**
 * Helper to check if a value is a non-empty string within a given length range.
 */
export function isStringAndNotEmpty(value: any, minLength: number = 1, maxLength: number = Infinity): boolean {
  return typeof value === "string" && value.trim().length >= minLength && value.trim().length <= maxLength;
}

/**
 * Validates an Ethereum address against the EIP-55 checksum standard.
 *
 * @param address The Ethereum address string to validate.
 * @param strict If true, only strictly checksummed addresses pass. If false,
 *               all-lowercase or all-uppercase addresses are also considered valid
 *               (though they will be normalized to checksummed format).
 * @returns True if the address is valid according to EIP-55 (or relaxed rules), false otherwise.
 */
export function validateEIP55Checksum(address: string, strict: boolean = validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED): boolean {
  if (!isStringAndNotEmpty(address)) {
    return false;
  }

  // ethers.isAddress handles the basic format check (0x prefix, 40 hex chars)
  // and also performs checksum validation.
  // It returns the checksummed address if valid, or throws an error if invalid.
  try {
    const checksummedAddress = getAddress(address); // This will throw if the address is malformed or has an invalid checksum
    if (strict) {
      // In strict mode, the original address must exactly match the checksummed version
      return address === checksummedAddress;
    }
    // In non-strict mode, as long as it's a valid address that *could* be checksummed, it passes.
    // ethers.isAddress implicitly handles this by returning the checksummed version or throwing.
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validates an Ethereum address, including format and optional EIP-55 checksum.
 * This function replaces the previous isValidEthereumAddressFormat and incorporates checksum validation.
 *
 * @param address The Ethereum address string to validate.
 * @param strictChecksum If true, enforces strict EIP-55 checksum validation.
 *                       If false, allows all-lowercase or all-uppercase addresses.
 * @returns True if the address is valid, false otherwise.
 */
export function isValidEthereumAddress(address: string, strictChecksum: boolean = validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED): boolean {
  // Directly use validateEIP55Checksum which internally handles format and checksum validation
  return validateEIP55Checksum(address, strictChecksum);
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
  const sanitizedInput = sanitizeObject(input);

  if (!sanitizedInput || typeof sanitizedInput !== "object" || Array.isArray(sanitizedInput)) {
    return { isValid: false, error: "Request body must be a valid JSON object" };
  }

  const { user, comment } = sanitizedInput;

  if (!isStringAndNotEmpty(user, 3, 50)) {
    return { isValid: false, error: "User is required and must be a string between 3 and 50 characters" };
  }

  if (!isStringAndNotEmpty(comment, 1, 500)) {
    return { isValid: false, error: "Comment is required and must be a string between 1 and 500 characters" };
  }

  return { isValid: true, sanitizedInput };
}

/**
 * Internal helper to validate the common structure and format of wallet-related payloads.
 * @param payload - The input object containing 'walletAddress', 'message', and 'signature' fields.
 * @returns A ValidationResult object indicating if the input is valid and an error message if not.
 */
function _validateWalletPayload(payload: any): ValidationResult {
  const sanitizedPayload = sanitizeObject(payload);

  if (!sanitizedPayload || typeof sanitizedPayload !== "object" || Array.isArray(sanitizedPayload)) {
    return { isValid: false, error: "Request body must be a valid JSON object" };
  }

  const { walletAddress, message, signature } = sanitizedPayload;

  // Check for presence of all required fields
  if (!Object.prototype.hasOwnProperty.call(payload, "walletAddress") ||
      !Object.prototype.hasOwnProperty.call(payload, "message") ||
      !Object.prototype.hasOwnProperty.call(payload, "signature")) {
    return { isValid: false, error: "Missing required fields: walletAddress, message, signature" };
  }

  // Validate types and non-emptiness
  if (!isStringAndNotEmpty(walletAddress)) {
    return { isValid: false, error: "walletAddress must be a non-empty string" };
  }
  if (!isStringAndNotEmpty(message, 1, 1000)) {
    return { isValid: false, error: "message must be a string between 1 and 1000 characters" };
  }
  if (!isStringAndNotEmpty(signature)) {
    return { isValid: false, error: "signature must be a non-empty string" };
  }

  // Validate formats
  if (!isValidEthereumAddress(walletAddress)) {
    return { isValid: false, error: "Invalid Ethereum wallet address format. Please ensure it is a valid 0x-prefixed 40-character hexadecimal address." };
  }
  if (validationConfig.EIP55_CHECKSUM_VALIDATION_ENABLED && !validateEIP55Checksum(walletAddress, true)) {
    return { isValid: false, error: "Invalid Ethereum wallet address. Please ensure it is a valid 0x-prefixed 40-character hexadecimal address, and if strict checksum validation is enabled, that it is EIP-55 checksummed." };
  }
  if (!isValidEthereumSignatureFormat(signature)) {
    return { isValid: false, error: "Invalid signature format. Must be a valid Ethereum signature (0x + 130 hex chars)" };
  }

  // Normalize walletAddress to checksummed format before returning
  const normalizedWalletAddress = getAddress(walletAddress);

  return { isValid: true, sanitizedInput: { ...sanitizedPayload, walletAddress: normalizedWalletAddress } };
}

/**
 * Validates the structure and format of wallet authentication input.
 * @param input - The wallet authentication input object containing 'walletAddress', 'message', and 'signature' fields.
 * @returns A ValidationResult object indicating if the input is valid and an error message if not.
 */
export function validateWalletAuthInput(input: any): ValidationResult {
  return _validateWalletPayload(input);
}

/**
 * Validates the payload for the register endpoint.
 * Ensures that walletAddress, message, and signature are present and correctly formatted.
 *
 * @param payload The request body received by the register endpoint.
 * @returns A ValidationResult object indicating if the payload is valid and an error message if not.
 *
 * @example
 * // Valid payload
 * const validPayload = {
 *   walletAddress: "0x1234567890123456789012345678901234567890",
 *   message: "Sign this message to register",
 *   signature: "0x" + "a".repeat(130),
 * };
 * const result1 = validateRegisterPayload(validPayload);
 * console.log(result1); // { isValid: true }
 *
 * @example
 * // Invalid walletAddress format
 * const invalidWalletAddressPayload = {
 *   walletAddress: "0x123",
 *   message: "Sign this message to register",
 *   signature: "0x" + "a".repeat(130),
 * };
 * const result2 = validateRegisterPayload(invalidWalletAddressPayload);
 * console.log(result2); // { isValid: false, error: "Invalid Ethereum wallet address format" }
 *
 * @example
 * // Missing message
 * const missingMessagePayload = {
 *   walletAddress: "0x1234567890123456789012345678901234567890",
 *   signature: "0x" + "a".repeat(130),
 * };
 * const result3 = validateRegisterPayload(missingMessagePayload);
 * console.log(result3); // { isValid: false, error: "Missing required fields: walletAddress, message, signature" }
 */
export function validateRegisterPayload(payload: any): ValidationResult {
  return _validateWalletPayload(payload);
}

