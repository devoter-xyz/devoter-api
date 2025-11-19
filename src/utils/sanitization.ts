import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes a string by removing HTML tags, preventing XSS, and normalizing Unicode.
 * @param input The string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input; // Initialize sanitized with the input string

  // Normalize Unicode to a standard form (NFC is generally recommended for most texts)
  sanitized = sanitized.normalize('NFC');

  // Use DOMPurify to remove HTML and prevent XSS attacks
  // Configure DOMPurify to allow only plain text, effectively stripping all HTML
  sanitized = DOMPurify.sanitize(sanitized, { USE_PROFILES: { html: false } });

  // XSS attacks are handled by DOMPurify. SQL injection must be prevented at the DB layer
  // with parameterized queries/prepared statements, not by mutating user input.

  // Trim whitespace at the very end, after all other sanitization
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates if a string contains only allowed characters.
 * This function can be customized based on the specific requirements for different inputs.
 * For example, a username might allow alphanumeric and underscores, while a comment might allow more.
 * @param input The string to validate.
 * @param allowedCharsRegex A regular expression defining the allowed characters.
 * @returns True if the string contains only allowed characters, false otherwise.
 */
export function validateCharacterSet(input: string, allowedCharsRegex: RegExp): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  return allowedCharsRegex.test(input);
}

/**
 * Sanitizes an object by applying sanitizeString to all its string properties recursively.
 * This is useful for sanitizing entire request bodies.
 * @param obj The object to sanitize.
 * @returns A new object with all string properties sanitized.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T; // Sanitize strings directly
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }

  const sanitizedObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      sanitizedObj[key] = sanitizeObject(value); // Recursively sanitize all values
    }
  }
  return sanitizedObj as T;
}
