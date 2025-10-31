import { test, expect, vi, beforeEach, describe } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyWalletSignature, extractBearerToken, isValidApiKeyFormat } from '../../src/middleware/auth.js';
import { ApiError, HttpStatusCode } from '../../src/utils/errorHandler.js';

let capturedError: ApiError | undefined;
let capturedRequest: FastifyRequest | undefined;
let capturedReply: FastifyReply | undefined;

// Mock the handleError function to capture the arguments it's called with
vi.mock('../../src/utils/errorHandler.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/errorHandler.js')>();
  return {
    ...actual,
    handleError: vi.fn((error, request, reply) => {
      capturedError = error as ApiError;
      capturedRequest = request;
      capturedReply = reply;
      // Simulate the behavior of handleError by sending the error response
      const apiError = error instanceof actual.ApiError ? error : actual.ApiError.internal();
      reply.status(apiError.statusCode).send(apiError.toResponse());
    }),
  };
});

import { handleError } from '../../src/utils/errorHandler.js';
import * as verifySignatureModule from '../../src/utils/verifySignature.js';
import * as validationModule from '../../src/utils/validation.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Spy on the actual functions and mock their default successful behavior
  vi.spyOn(verifySignatureModule, 'verifySignatureWithTimestamp').mockReturnValue({
    isValid: true,
    error: undefined,
  });
  vi.spyOn(validationModule, 'validateWalletAuthInput').mockReturnValue({
    isValid: true,
  });
});

test('should return unauthorized JSON response for invalid wallet signature', async () => {
  // Override mock for this specific test case
  vi.spyOn(verifySignatureModule, 'verifySignatureWithTimestamp').mockReturnValue({
    isValid: false,
    error: 'Invalid signature',
  });

  const request = {
    body: {
      walletAddress: '0x123...', 
      message: 'some message',
      signature: 'invalid_signature',
    },
    log: { error: vi.fn() }, // Mock log object
  } as FastifyRequest;

  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;

  await verifyWalletSignature(request, reply); // Call the preHandler

  expect(handleError).toHaveBeenCalledOnce();
  expect(capturedError).toBeInstanceOf(ApiError);
  expect(capturedRequest).toBe(request);
  expect(capturedReply).toBe(reply);

  // Assert the status code and JSON body
  expect(reply.status).toHaveBeenCalledWith(HttpStatusCode.UNAUTHORIZED);
  expect(reply.send).toHaveBeenCalledWith(
    expect.objectContaining({
      statusCode: HttpStatusCode.UNAUTHORIZED,
      message: 'Invalid or expired wallet signature',
      code: 'INVALID_SIGNATURE',
      details: { reason: 'Invalid signature' },
    })
  );

test('should return bad request JSON response for missing request body', async () => {
  const request = {
    body: undefined,
    log: { error: vi.fn() }, // Mock log object
  } as FastifyRequest;

  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;

  try {
    await verifyWalletSignature(request, reply);
  } catch (error) {
    handleError(error as ApiError, request, reply);
  }

  expect(handleError).toHaveBeenCalledOnce();
  expect(reply.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
  expect(reply.send).toHaveBeenCalledWith(
    expect.objectContaining({
      status: HttpStatusCode.BAD_REQUEST,
      message: 'Missing or invalid request body',
      code: 'INVALID_AUTH_INPUT',
    })
  );
});

test('should return bad request JSON response for invalid input structure', async () => {
  // Override mock for this specific test case
  vi.spyOn(validationModule, 'validateWalletAuthInput').mockReturnValue({
    isValid: false,
    error: 'Invalid format',
  });

  const request = {
    body: {
      walletAddress: '0x123...', 
      message: 123, // Invalid type
      signature: 'some_signature',
    },
    log: { error: vi.fn() }, // Mock log object
  } as FastifyRequest;

  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;

  try {
    await verifyWalletSignature(request, reply);
  } catch (error) {
    handleError(error as ApiError, request, reply);
  }

  expect(handleError).toHaveBeenCalledOnce();
  expect(reply.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
  expect(reply.send).toHaveBeenCalledWith(
    expect.objectContaining({
      status: HttpStatusCode.BAD_REQUEST,
      message: 'Invalid format',
      code: 'INVALID_AUTH_INPUT',
    })
  );
});

  describe('API Key Helper Functions', () => {
  describe('extractBearerToken', () => {
    test('should extract token from a valid Bearer header', () => {
      const header = 'Bearer some_valid_token_string';
      expect(extractBearerToken(header)).toBe('some_valid_token_string');
    });

    test('should return null for a malformed header (missing Bearer)', () => {
      const header = 'Token some_token';
      expect(extractBearerToken(header)).toBeNull();
    });

    test('should return null for a malformed header (incorrect spacing)', () => {
      const header = 'Bearer  some_token';
      expect(extractBearerToken(header)).toBeNull();
    });

    test('should return null for an empty header', () => {
      const header = '';
      expect(extractBearerToken(header)).toBeNull();
    });

    test('should return null if header is just Bearer', () => {
      const header = 'Bearer';
      expect(extractBearerToken(header)).toBeNull();
    });
  });

  describe('isValidApiKeyFormat', () => {
    test('should return true for a valid API key format', () => {
      // This format should match the regex /^[a-zA-Z0-9\-_.]+$/ and length > 30
      const validKey = 'valid-api-key-with-some-more-characters-12345';
      expect(isValidApiKeyFormat(validKey)).toBe(true);
    });

    test('should return false for an API key that is too short', () => {
      const shortKey = 'short-key';
      expect(isValidApiKeyFormat(shortKey)).toBe(false);
    });

    test('should return false for an API key with invalid characters', () => {
      const invalidCharKey = 'validkey!@#';
      expect(isValidApiKeyFormat(invalidCharKey)).toBe(false);
    });

    test('should return false for an empty string', () => {
      const emptyKey = '';
      expect(isValidApiKeyFormat(emptyKey)).toBe(false);
    });

    test('should return false for a key with spaces', () => {
      const keyWithSpaces = 'key with spaces';
      expect(isValidApiKeyFormat(keyWithSpaces)).toBe(false);
    });
  });
});