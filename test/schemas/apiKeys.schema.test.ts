import { describe, it, expect } from 'vitest';
import { Static, Type } from '@sinclair/typebox';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schemas from src/routes/apiKeys.ts
const PostApiKeysBodySchema = Type.Object({
  walletAddress: Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
  message: Type.String({ minLength: 1, maxLength: 1000 }),
  signature: Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
});

const PostApiKeysResponse201Schema = Type.Object({
  success: Type.Literal(true),
  apiKey: Type.String(),
  keyId: Type.String(),
  message: Type.String(),
  createdAt: Type.Number(),
  algorithm: Type.String(),
});

const ErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: Type.String(),
});

const GetApiKeysHeadersSchema = Type.Object(
  {
    'x-wallet-address': Type.String({ pattern: '^0x[a-fA-F0-9]{40}$' }),
    'x-message': Type.String({ minLength: 1, maxLength: 1000 }),
    'x-signature': Type.String({ pattern: '^0x[a-fA-F0-9]{130}$' }),
  },
  { additionalProperties: true }
);

const GetApiKeysResponse200Schema = Type.Object({
  success: Type.Literal(true),
  apiKeys: Type.Array(
    Type.Object({
      id: Type.String(),
      key: Type.String(),
      createdAt: Type.String(),
      totalUsed: Type.Optional(Type.Number()),
      enabled: Type.Boolean(),
    })
  ),
});

const GetApiKeysMetadataResponse200Schema = Type.Object({
  success: Type.Literal(true),
  apiKeys: Type.Array(
    Type.Object({
      id: Type.String(),
      createdAt: Type.String(),
    })
  ),
});

const PostApiKeysRotateResponse200Schema = Type.Object({
  success: Type.Literal(true),
  apiKey: Type.String(),
  keyId: Type.String(),
  createdAt: Type.Number(),
  algorithm: Type.String(),
  message: Type.String(),
});

const DeleteApiKeysResponse200Schema = Type.Object({
  success: Type.Literal(true),
  message: Type.String(),
});

const ajv = new Ajv();
addFormats(ajv);

describe('API Keys Route Schemas', () => {
  describe('POST /api-keys (Create API Key)', () => {
    const validateBody = ajv.compile(PostApiKeysBodySchema);
    const validateResponse201 = ajv.compile(PostApiKeysResponse201Schema);
    const validateErrorResponse = ajv.compile(ErrorResponseSchema);

    it('should validate a valid request body', () => {
      const body = {
        walletAddress: '0x' + 'a'.repeat(40),
        message: 'test message',
        signature: '0x' + 'b'.repeat(130),
      };
      expect(validateBody(body)).toBe(true);
    });

    it('should invalidate body with missing walletAddress', () => {
      const body = {
        message: 'test message',
        signature: '0x' + 'b'.repeat(130),
      };
      expect(validateBody(body)).toBe(false);
      expect(validateBody.errors?.[0].message).toBe("must have required property 'walletAddress'");
    });

    it('should invalidate body with invalid walletAddress format', () => {
      const body = {
        walletAddress: '0x' + 'g'.repeat(40), // Invalid hex char
        message: 'test message',
        signature: '0x' + 'b'.repeat(130),
      };
      expect(validateBody(body)).toBe(false);
      expect(validateBody.errors?.[0].message).toBe("must match pattern \"^0x[a-fA-F0-9]{40}$\"");
    });

    it('should invalidate body with message too short', () => {
      const body = {
        walletAddress: '0x' + 'a'.repeat(40),
        message: '',
        signature: '0x' + 'b'.repeat(130),
      };
      expect(validateBody(body)).toBe(false);
      expect(validateBody.errors?.[0].message).toBe("must NOT have fewer than 1 characters");
    });

    it('should invalidate body with message too long', () => {
      const body = {
        walletAddress: '0x' + 'a'.repeat(40),
        message: 'a'.repeat(1001),
        signature: '0x' + 'b'.repeat(130),
      };
      expect(validateBody(body)).toBe(false);
      expect(validateBody.errors?.[0].message).toBe("must NOT have more than 1000 characters");
    });

    it('should invalidate body with invalid signature format', () => {
      const body = {
        walletAddress: '0x' + 'a'.repeat(40),
        message: 'test message',
        signature: '0x' + 'b'.repeat(129), // Too short
      };
      expect(validateBody(body)).toBe(false);
      expect(validateBody.errors?.[0].message).toBe("must match pattern \"^0x[a-fA-F0-9]{130}$\"");
    });

    it('should validate a valid 201 response', () => {
      const response = {
        success: true,
        apiKey: 'dv_testapikey',
        keyId: 'some-uuid',
        message: 'API key created successfully',
        createdAt: Date.now(),
        algorithm: 'sha256',
      };
      expect(validateResponse201(response)).toBe(true);
    });

    it('should invalidate 201 response with missing apiKey', () => {
      const response = {
        success: true,
        keyId: 'some-uuid',
        message: 'API key created successfully',
        createdAt: Date.now(),
        algorithm: 'sha256',
      };
      expect(validateResponse201(response)).toBe(false);
      expect(validateResponse201.errors?.[0].message).toBe("must have required property 'apiKey'");
    });

    it('should validate a valid error response', () => {
      const response = {
        success: false,
        error: 'User not found',
      };
      expect(validateErrorResponse(response)).toBe(true);
    });
  });

  describe('GET /api-keys (Get All API Keys)', () => {
    const validateHeaders = ajv.compile(GetApiKeysHeadersSchema);
    const validateResponse200 = ajv.compile(GetApiKeysResponse200Schema);
    const validateErrorResponse = ajv.compile(ErrorResponseSchema);

    it('should validate valid request headers', () => {
      const headers = {
        'x-wallet-address': '0x' + 'c'.repeat(40),
        'x-message': 'get keys',
        'x-signature': '0x' + 'd'.repeat(130),
      };
      expect(validateHeaders(headers)).toBe(true);
    });

    it('should invalidate headers with missing x-wallet-address', () => {
      const headers = {
        'x-message': 'get keys',
        'x-signature': '0x' + 'd'.repeat(130),
      };
      expect(validateHeaders(headers)).toBe(false);
      expect(validateHeaders.errors?.[0].message).toBe("must have required property 'x-wallet-address'");
    });

    it('should validate a valid 200 response', () => {
      const response = {
        success: true,
        apiKeys: [
          {
            id: 'key1',
            key: 'dv_maskedkey1',
            createdAt: new Date().toISOString(),
            totalUsed: 10,
            enabled: true,
          },
          {
            id: 'key2',
            key: 'dv_maskedkey2',
            createdAt: new Date().toISOString(),
            enabled: false,
          },
        ],
      };
      expect(validateResponse200(response)).toBe(true);
    });

    it('should invalidate 200 response with invalid apiKey format', () => {
      const response = {
        success: true,
        apiKeys: [
          {
            id: 'key1',
            key: 123, // Invalid type
            createdAt: new Date().toISOString(),
            enabled: true,
          },
        ],
      };
      expect(validateResponse200(response)).toBe(false);
      expect(validateResponse200.errors?.[0].message).toBe("must be string");
    });
  });

  describe('GET /api-keys/metadata (Get API Key Metadata)', () => {
    const validateHeaders = ajv.compile(GetApiKeysHeadersSchema); // Same headers as GET /api-keys
    const validateResponse200 = ajv.compile(GetApiKeysMetadataResponse200Schema);
    const validateErrorResponse = ajv.compile(ErrorResponseSchema);

    it('should validate valid request headers', () => {
      const headers = {
        'x-wallet-address': '0x' + 'e'.repeat(40),
        'x-message': 'get metadata',
        'x-signature': '0x' + 'f'.repeat(130),
      };
      expect(validateHeaders(headers)).toBe(true);
    });

    it('should validate a valid 200 response', () => {
      const response = {
        success: true,
        apiKeys: [
          {
            id: 'meta1',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'meta2',
            createdAt: new Date().toISOString(),
          },
        ],
      };
      expect(validateResponse200(response)).toBe(true);
    });

    it('should invalidate 200 response with missing createdAt', () => {
      const response = {
        success: true,
        apiKeys: [
          {
            id: 'meta1',
          },
        ],
      };
      expect(validateResponse200(response)).toBe(false);
      expect(validateResponse200.errors?.[0].message).toBe("must have required property 'createdAt'");
    });
  });

  describe('POST /api-keys/:id/rotate (Rotate API Key)', () => {
    const validateHeaders = ajv.compile(GetApiKeysHeadersSchema); // Same headers as GET /api-keys
    const validateResponse200 = ajv.compile(PostApiKeysRotateResponse200Schema);
    const validateErrorResponse = ajv.compile(ErrorResponseSchema);

    it('should validate valid request headers', () => {
      const headers = {
        'x-wallet-address': '0x' + '1'.repeat(40),
        'x-message': 'rotate key',
        'x-signature': '0x' + '2'.repeat(130),
      };
      expect(validateHeaders(headers)).toBe(true);
    });

    it('should validate a valid 200 response', () => {
      const response = {
        success: true,
        apiKey: 'dv_newrotatedkey',
        keyId: 'new-uuid',
        createdAt: Date.now(),
        algorithm: 'sha256',
        message: 'API key rotated successfully',
      };
      expect(validateResponse200(response)).toBe(true);
    });

    it('should invalidate 200 response with invalid createdAt type', () => {
      const response = {
        success: true,
        apiKey: 'dv_newrotatedkey',
        keyId: 'new-uuid',
        createdAt: 'not-a-number', // Invalid type
        algorithm: 'sha256',
        message: 'API key rotated successfully',
      };
      expect(validateResponse200(response)).toBe(false);
      expect(validateResponse200.errors?.[0].message).toBe("must be number");
    });
  });

  describe('DELETE /api-keys/:id (Revoke API Key)', () => {
    const validateHeaders = ajv.compile(GetApiKeysHeadersSchema); // Same headers as GET /api-keys
    const validateResponse200 = ajv.compile(DeleteApiKeysResponse200Schema);
    const validateErrorResponse = ajv.compile(ErrorResponseSchema);

    it('should validate valid request headers', () => {
      const headers = {
        'x-wallet-address': '0x' + '3'.repeat(40),
        'x-message': 'revoke key',
        'x-signature': '0x' + '4'.repeat(130),
      };
      expect(validateHeaders(headers)).toBe(true);
    });

    it('should validate a valid 200 response', () => {
      const response = {
        success: true,
        message: 'API key revoked successfully',
      };
      expect(validateResponse200(response)).toBe(true);
    });

    it('should invalidate 200 response with missing message', () => {
      const response = {
        success: true,
      };
      expect(validateResponse200(response)).toBe(false);
      expect(validateResponse200.errors?.[0].message).toBe("must have required property 'message'");
    });
  });
});
