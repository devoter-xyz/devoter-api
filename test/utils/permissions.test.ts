import { describe, it, expect } from 'vitest';
import { ALL_SCOPES, isValidScope, hasPermission, validateScopes } from '../../src/utils/permissions';

describe('permissions utilities', () => {
  describe('ALL_SCOPES', () => {
    it('should contain a predefined list of scopes', () => {
      expect(ALL_SCOPES).toBeInstanceOf(Array);
      expect(ALL_SCOPES.length).toBeGreaterThan(0);
      expect(ALL_SCOPES).toContain('polls:read');
      expect(ALL_SCOPES).toContain('apiKeys:write');
    });

    it('should contain unique scopes', () => {
      const uniqueScopes = new Set(ALL_SCOPES);
      expect(uniqueScopes.size).toBe(ALL_SCOPES.length);
    });
  });

  describe('isValidScope', () => {
    it('should return true for a valid scope', () => {
      expect(isValidScope('polls:read')).toBe(true);
      expect(isValidScope('apiKeys:write')).toBe(true);
    });

    it('should return false for an invalid scope', () => {
      expect(isValidScope('invalid:scope')).toBe(false);
      expect(isValidScope('users:delete')).toBe(false);
      expect(isValidScope('')).toBe(false);
      expect(isValidScope('polls:read:all')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isValidScope('Polls:read')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true if no required scopes are provided', () => {
      expect(hasPermission([], ['polls:read'])).toBe(true);
      expect(hasPermission([], [])).toBe(true);
      expect(hasPermission(undefined as any, ['polls:read'])).toBe(true);
      expect(hasPermission(null as any, ['polls:read'])).toBe(true);
    });

    it('should return false if required scopes are provided but user has none', () => {
      expect(hasPermission(['polls:read'], [])).toBe(false);
      expect(hasPermission(['polls:read'], undefined as any)).toBe(false);
      expect(hasPermission(['polls:read'], null as any)).toBe(false);
    });

    it('should return true if user has all required scopes', () => {
      const userScopes = ['polls:read', 'comments:write', 'apiKeys:read'];
      expect(hasPermission(['polls:read'], userScopes)).toBe(true);
      expect(hasPermission(['polls:read', 'comments:write'], userScopes)).toBe(true);
      expect(hasPermission(['apiKeys:read', 'comments:write', 'polls:read'], userScopes)).toBe(true);
    });

    it('should return false if user is missing any required scope', () => {
      const userScopes = ['polls:read', 'comments:write'];
      expect(hasPermission(['polls:read', 'apiKeys:write'], userScopes)).toBe(false);
      expect(hasPermission(['notifications:read'], userScopes)).toBe(false);
    });

    it('should handle empty user scopes correctly when required scopes exist', () => {
      expect(hasPermission(['polls:read'], [])).toBe(false);
    });

    it('should handle empty required scopes correctly', () => {
      expect(hasPermission([], ['polls:read'])).toBe(true);
    });
  });

  describe('validateScopes', () => {
    it('should return the same array for valid scopes', () => {
      const scopes = ['polls:read', 'comments:write'];
      expect(validateScopes(scopes)).toEqual(scopes);
    });

    it('should throw an error for invalid scopes', () => {
      const scopes = ['polls:read', 'invalid:scope', 'comments:write'];
      expect(() => validateScopes(scopes)).toThrow('Invalid scopes provided: invalid:scope');
    });

    it('should throw an error for multiple invalid scopes', () => {
      const scopes = ['polls:read', 'invalid:scope1', 'comments:write', 'invalid:scope2'];
      expect(() => validateScopes(scopes)).toThrow('Invalid scopes provided: invalid:scope1, invalid:scope2');
    });

    it('should return an empty array if no scopes are provided', () => {
      expect(validateScopes([])).toEqual([]);
    });
  });
});
