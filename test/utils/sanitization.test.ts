import { describe, it, expect } from 'vitest';
import { sanitizeString, validateCharacterSet, sanitizeObject } from '../../src/utils/sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags and prevent XSS', () => {
      const input = '<script>alert("xss")</script>Hello<b>World</b><img src="x" onerror="alert(\"xss\")">';
      const expected = 'HelloWorld';
      expect(sanitizeString(input)).toBe(expected);
    });

    it('should handle various XSS attack vectors', () => {
      expect(sanitizeString('<img src="x" onerror="alert(\"XSS\")">')).toBe('');
      expect(sanitizeString('<a href="javascript:alert(\"XSS\")">Click me</a>')).toBe('Click me');
      expect(sanitizeString('<iframe src="javascript:alert(\"XSS\")"></iframe>')).toBe('');
      expect(sanitizeString('<body onload="alert(\"XSS\")">')).toBe('');
      expect(sanitizeString('<div style="background-image: url(javascript:alert(\"XSS\"))"></div>')).toBe('');
      expect(sanitizeString('<svg/onload=alert(1)>')).toBe('');
    });

    it('should normalize Unicode characters', () => {
      const input = 'Crème brûlée'; // e with acute accent
      const expected = 'Crème brûlée';
      expect(sanitizeString(input)).toBe(expected);

      const input2 = '你好世界'; // Chinese characters
      const expected2 = '你好世界';
      expect(sanitizeString(input2)).toBe(expected2);
    });

    it('should trim whitespace', () => {
      const input = '  Hello World   ';
      const expected = 'Hello World';
      expect(sanitizeString(input)).toBe(expected);
    });

    it('should preserve SQL injection patterns as they are handled at the DB layer', () => {
      const input = "SELECT * FROM users; --";
      const expected = "SELECT * FROM users; --";
      expect(sanitizeString(input)).toBe(expected);

      const input2 = "' OR '1'='1";
      const expected2 = "' OR '1'='1";
      expect(sanitizeString(input2)).toBe(expected2);

      const input3 = "DROP TABLE users;";
      const expected3 = "DROP TABLE users;";
      expect(sanitizeString(input3)).toBe(expected3);
    });

    it('should return an empty string for non-string inputs', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString({} as any)).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('validateCharacterSet', () => {
    it('should return true for valid characters', () => {
      const alphanumeric = /^[a-zA-Z0-9]*$/;
      expect(validateCharacterSet('HelloWorld123', alphanumeric)).toBe(true);
    });

    it('should return false for invalid characters', () => {
      const alphanumeric = /^[a-zA-Z0-9]*$/;
      expect(validateCharacterSet('Hello World!', alphanumeric)).toBe(false);
    });

    it('should handle different regex patterns', () => {
      const usernameRegex = /^[a-zA-Z0-9_.-]*$/;
      expect(validateCharacterSet('user_name-123', usernameRegex)).toBe(true);
      expect(validateCharacterSet('user name', usernameRegex)).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      const alphanumeric = /^[a-zA-Z0-9]*$/;
      expect(validateCharacterSet(null as any, alphanumeric)).toBe(false);
      expect(validateCharacterSet(undefined as any, alphanumeric)).toBe(false);
      expect(validateCharacterSet(123 as any, alphanumeric)).toBe(false);
      expect(validateCharacterSet({} as any, alphanumeric)).toBe(false);
    });

    it('should return true for empty string if regex allows it', () => {
      const alphanumeric = /^[a-zA-Z0-9]*$/;
      expect(validateCharacterSet('', alphanumeric)).toBe(true);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string properties in a flat object', () => {
      const input = {
        name: '  <script>alert("xss")</script>John Doe  ',
        email: 'test@example.com',
        age: 30,
      };
      const expected = {
        name: 'John Doe',
        email: 'test@example.com',
        age: 30,
      };
      expect(sanitizeObject(input)).toEqual(expected);
    });

    it('should sanitize string properties in nested objects', () => {
      const input = {
        user: {
          name: '  <script>alert("xss")</script>Jane Doe  ',
          address: {
            street: '123 Main St <img src="x" onerror="alert(\"xss\")">',
            city: 'Anytown',
          },
        },
        id: 123,
      };
      const expected = {
        user: {
          name: 'Jane Doe',
          address: {
            street: '123 Main St',
            city: 'Anytown',
          },
        },
        id: 123,
      };
      expect(sanitizeObject(input)).toEqual(expected);
    });

    it('should sanitize string properties in arrays within objects', () => {
      const input = {
        tags: ['  tag1  ', '<script>alert("xss")</script>tag2'],
        data: 'some data',
      };
      const expected = {
        tags: ['tag1', 'tag2'],
        data: 'some data',
      };
      expect(sanitizeObject(input)).toEqual(expected);
    });

    it('should sanitize string properties in arrays of objects', () => {
      const input = [
        {
          name: '  User1  ',
          comment: '<script>alert("xss")</script>Good comment',
        },
        {
          name: 'User2',
          comment: 'Another comment <img src="x" onerror="alert(\"xss\")">',
        },
      ];
      const expected = [
        {
          name: 'User1',
          comment: 'Good comment',
        },
        {
          name: 'User2',
          comment: 'Another comment',
        },
      ];
      expect(sanitizeObject(input)).toEqual(expected);
    });

    it('should return the same non-object input', () => {
      expect(sanitizeObject(null)).toBeNull();
      expect(sanitizeObject(123)).toBe(123);
      expect(sanitizeObject('test')).toBe('test');
    });

    it('should handle empty objects and arrays', () => {
      expect(sanitizeObject({})).toEqual({});
      expect(sanitizeObject([])).toEqual([]);
    });
  });
});
