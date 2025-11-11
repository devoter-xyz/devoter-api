import * as crypto from 'crypto';

export type ApiKeyFormat = 'hex' | 'base64url';

export interface ApiKeyData {
  key: string;
  createdAt: number;
  algorithm: ApiKeyFormat;
}

/**
 * Generate a secure API key using cryptographic random bytes with configurable format and metadata.
 * @param length - Length of the API key in bytes (default: 32)
 * @param format - Encoding format for the key ('hex' or 'base64url', default: 'base64url')
 * @param seed - Optional seed for deterministic key generation (for testing)
 * @returns An object containing the API key, creation timestamp, and algorithm used.
 */
export function generateApiKey(
  length: number = 32,
  format: ApiKeyFormat = 'base64url',
  seed?: string
): { key: string; algorithm: ApiKeyFormat } { // Changed return type
  let buffer: Buffer;
  if (seed) {
    // Use a seeded hash for deterministic output in testing
    // Ensure the seed is used to generate a consistent buffer
    const hash = crypto.createHash('sha256').update(seed).digest();
    buffer = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = hash[i % hash.length]; // Repeat hash bytes if length > 32
    }
  } else {
    buffer = crypto.randomBytes(length);
  }

  const key = buffer.toString(format);

  return {
    key,
    algorithm: format,
  };
}

/**
 * Generate a unique API key with a prefix and user identifier
 * @param userId - User ID to include in the key for uniqueness
 * @param prefix - Prefix for the API key (default: 'dv')
 * @returns Formatted API key with prefix
 */
export function generateUniqueApiKey(userId: string, prefix: string = 'dv', createdAt?: number): ApiKeyData {
  const effectiveCreatedAt = createdAt || Date.now();
  const { key: randomPart, algorithm } = generateApiKey(24); // 24 bytes = 32 chars in base64url
  const timestamp = effectiveCreatedAt.toString(36); // Compact timestamp
  const formattedKey = `${prefix}.${timestamp}.${randomPart}`;
  return { key: formattedKey, createdAt: effectiveCreatedAt, algorithm };
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
  const newFormatPattern = /^[a-zA-Z]{2,}\.[0-9a-z]+\.[A-Za-z0-9_-]{32,}$/;

  // If strictDotDelimiter is true, or if the key already matches the new format,
  // then no legacy normalization is needed.
  if (strictDotDelimiter || newFormatPattern.test(apiKey)) {
    normalizedKey = apiKey;
  } else if (apiKey.includes('_')) {
    // Attempt to normalize legacy underscore-delimited keys
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      // Replace only the first two underscores with dots, keep subsequent underscores in the random part
      normalizedKey = `${parts[0]}.${parts[1]}.${parts.slice(2).join('_')}`;
    } else {
      // If less than 3 parts, replace all underscores with dots (older legacy format)s
      normalizedKey = apiKey.replace(/_/g, '.');
    }
    console.log('Legacy API key format detected and normalized.');
  }

  // Check if it matches our generated format: prefix.timestamp.randompart (now always with dots)
  // Use the newFormatPattern directly
  if (!newFormatPattern.test(normalizedKey)) {
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
export function generateMultipleApiKeys(count: number, userId: string): ApiKeyData[] {
  const keys: ApiKeyData[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(generateUniqueApiKey(userId));
  }
  return keys;
}