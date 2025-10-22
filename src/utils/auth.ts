/**
 * Extracts a Bearer token from the Authorization header.
 * @param header The Authorization header string.
 * @returns The extracted token string, or null if not found or malformed.
 */
export function extractBearerToken(header: string): string | null {
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1] as string;
  }
  return null;
}
