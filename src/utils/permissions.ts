export const ALL_SCOPES = ['polls:read', 'polls:write', 'comments:read', 'comments:write', 'notifications:read', 'notifications:write', 'apiKeys:read', 'apiKeys:write'];

export function isValidScope(scope: string): boolean {
  return ALL_SCOPES.includes(scope);
}

export function hasPermission(requiredScopes: string[], userScopes: string[]): boolean {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true; // No specific scopes required, access granted
  }
  if (!userScopes || userScopes.length === 0) {
    return false; // Scopes required, but user has none
  }
  return requiredScopes.every(requiredScope => userScopes.includes(requiredScope));
}

export function validateScopes(scopes: string[]): string[] {
  const invalidScopes = scopes.filter(scope => !isValidScope(scope));
  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes provided: ${invalidScopes.join(', ')}`);
  }
  return scopes;
}
