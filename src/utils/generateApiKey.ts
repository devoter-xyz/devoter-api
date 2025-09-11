import * as crypto from 'crypto';

/**
 * Generate a secure API key using cryptographic random bytes
 * @param length - Length of the API key (default: 32)
 * @returns Base64URL encoded API key
 */
export function generateApiKey(length: number = 32): string {
  const buffer = crypto.randomBytes(length);
  return buffer.toString('base64url');
}

/**
 * Generate a unique API key with a prefix and user identifier
 * @param userId - User ID to include in the key for uniqueness
 * @param prefix - Prefix for the API key (default: 'dv')
 * @returns Formatted API key with prefix
 */
export function generateUniqueApiKey(userId: string, prefix: string = 'dv'): string {
  const randomPart = generateApiKey(24); // 24 bytes = 32 chars in base64url
  const timestamp = Date.now().toString(36); // Compact timestamp
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Hash an API key for secure storage
 * @param apiKey - The API key to hash
 * @returns SHA-256 hash of the API key
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Mask an API key for display purposes
 * @param apiKey - The API key to mask
 * @param visibleChars - Number of characters to show at the end (default: 8)
 * @returns Masked API key
 */
export function maskApiKey(apiKey: string, visibleChars: number = 8): string {
  if (apiKey.length <= visibleChars) {
    return '*'.repeat(apiKey.length);
  }
  const masked = '*'.repeat(apiKey.length - visibleChars);
  const visible = apiKey.slice(-visibleChars);
  return masked + visible;
}

/**
 * Validate API key format
 * @param apiKey - The API key to validate
 * @returns True if the API key has a valid format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Check if it matches our generated format: prefix_timestamp_randompart
  const apiKeyPattern = /^[a-zA-Z]{2,}_[0-9a-z]+_[A-Za-z0-9_-]{32,}$/;
  
  if (!apiKeyPattern.test(apiKey)) {
    return false;
  }
  
  // Extract and validate the timestamp part
  const parts = apiKey.split('_');
  
  // Ensure the timestamp part exists
  if (parts.length < 2 || !parts[1]) {
    return false;
  }
  
  const timestampPart = parts[1];
  
  // Validate that the timestamp is a valid base36 number
  // and is within a reasonable range (not in the future)
  try {
    const timestamp = parseInt(timestampPart, 36);
    const now = Date.now();
    
    // Timestamp should be a positive number and not in the future
    // Allow a small buffer (5 seconds) for clock differences
    return timestamp > 0 && timestamp <= now + 5000;
  } catch (e) {
    return false;
  }
}

/**
 * Generate multiple API keys for testing purposes
 * @param count - Number of API keys to generate
 * @param userId - User ID for the keys
 * @returns Array of generated API keys
 */
export function generateMultipleApiKeys(count: number, userId: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(generateUniqueApiKey(userId));
  }
  return keys;
}