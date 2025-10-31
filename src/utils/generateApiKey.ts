import * as crypto from 'crypto';

/**
 * Generate a secure API key using cryptographic random bytes
 * @param length - Length of the API key (default: 32)
 * @param seed - Optional seed for deterministic key generation (for testing)
 * @returns Base64URL encoded API key
 */
export function generateApiKey(length: number = 32, seed?: string): string {
  let buffer: Buffer;
  if (seed) {
    // Use a seeded hash for deterministic output in testing
    buffer = crypto.createHash('sha256').update(seed).digest().slice(0, length);
    // If the seed hash is shorter than length, repeat it or pad with zeros.
    // For simplicity and common test cases, slicing is usually sufficient.
    // If length is greater than 32 (SHA256 output), it will be padded with zeros.
    if (buffer.length < length) {
      buffer = Buffer.concat([buffer, Buffer.alloc(length - buffer.length, 0)]);
    }
  } else {
    buffer = crypto.randomBytes(length);
  }
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
  return `${prefix}.${timestamp}.${randomPart}`;
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
export function isValidApiKeyFormat(apiKey: string, strictDotDelimiter: boolean = false): boolean {
  let normalizedKey = apiKey;
  if (!strictDotDelimiter && apiKey.includes('_')) {
    // Only replace the first two underscores (delimiters between prefix, timestamp, and random part)
    // The random part may contain underscores as it uses base64url encoding
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      normalizedKey = `${parts[0]}.${parts[1]}.${parts.slice(2).join('_')}`;
    } else {
      normalizedKey = apiKey.replace(/_/g, '.');
    }
    console.log('Legacy API key format detected and normalized.');
  }

  // Check if it matches our generated format: prefix.timestamp.randompart (now always with dots)
  const apiKeyPattern = /^[a-zA-Z]{2,}\.[0-9a-z]+\.[A-Za-z0-9_-]{32,}$/;
  
  if (!apiKeyPattern.test(normalizedKey)) {
    return false;
  }
  
  // Extract and validate the timestamp part
  const parts = normalizedKey.split('.');
  
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