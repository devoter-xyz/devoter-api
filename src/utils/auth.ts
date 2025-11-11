/**
 * Extracts a Bearer token from the Authorization header.
 *
 * @param header The Authorization header string. Expected format: "Bearer <token>".
 * @returns The extracted token string, or null if the header is missing, malformed, or not a Bearer token.
 */
export function extractBearerToken(header: string): string | null {
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1] as string;
  }
  return null;
}
