// Import test utilities from Vitest
import { describe, it, expect, vi } from 'vitest';
// Import the custom error handler utility and ApiError class
import { handleError, ApiError, HttpStatusCode } from '../../src/utils/errorHandler';
// Import Fastify types for mocking
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock randomUUID to ensure consistent correlation IDs in tests
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-correlation-id'),
}));

describe('Error Handling', () => {
  describe('handleError', () => {
    it('should return a consistent JSON shape for ApiError instances with correlationId', () => {
      const mockRequest = {
        log: { error: vi.fn() },
        id: 'request-id-123',
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const error = ApiError.badRequest('Invalid input', 'VALIDATION_FAILED', undefined, 'custom-correlation-id');
      handleError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: HttpStatusCode.BAD_REQUEST,
        message: 'Invalid input',
        code: 'VALIDATION_FAILED',
        correlationId: 'custom-correlation-id',
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith({ error, correlationId: 'custom-correlation-id' }, error.message);
    });

    it('should return a consistent JSON shape for generic errors with generated correlationId', () => {
      const mockRequest = {
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const genericError = new Error('Something went wrong');
      handleError(genericError, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatusCode.INTERNAL_SERVER_ERROR);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        correlationId: 'mock-correlation-id',
      });
      const sentPayload = mockReply.send.mock.calls[0][0];
      expect(sentPayload).not.toHaveProperty('stack');
      expect(sentPayload.message).not.toEqual(genericError.message);
      expect(mockRequest.log.error).toHaveBeenCalledWith({ error: genericError, correlationId: 'mock-correlation-id' }, genericError.message);
    });

    it('should handle Fastify validation errors with correlationId', () => {
      const mockRequest = {
        log: { error: vi.fn() },
        id: 'validation-request-id',
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const fastifyValidationError = {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        message: 'Validation failed',
        validation: [{ keyword: 'required', dataPath: '.body.name', message: 'should have required property \'name\'' }],
      } as unknown as Error;

      handleError(fastifyValidationError, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: HttpStatusCode.BAD_REQUEST,
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: { errors: fastifyValidationError.validation },
        correlationId: 'validation-request-id',
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith({ error: fastifyValidationError, correlationId: 'validation-request-id' }, fastifyValidationError.message);
    });

    it('should handle Prisma unique constraint errors with correlationId', () => {
      const mockRequest = {
        log: { error: vi.fn() },
        id: 'prisma-request-id',
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const prismaUniqueError = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { target: ['email'] },
        message: 'Unique constraint failed on the fields: (\'email\')',
      } as unknown as Error;

      handleError(prismaUniqueError, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatusCode.CONFLICT);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: HttpStatusCode.CONFLICT,
        message: 'A resource with this identifier already exists',
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        details: { fields: ['email'] },
        correlationId: 'prisma-request-id',
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith({ error: prismaUniqueError, correlationId: 'prisma-request-id' }, prismaUniqueError.message);
    });

    it('should use request.id as correlationId if available and no existing correlationId on error', () => {
      const mockRequest = {
        log: { error: vi.fn() },
        id: 'test-request-id',
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const genericError = new Error('Another error');
      handleError(genericError, mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        correlationId: 'test-request-id',
      }));
      expect(mockRequest.log.error).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'test-request-id' }), genericError.message);
    });

    it('should generate a new correlationId if no request.id and no existing correlationId on error', () => {
      const mockRequest = {
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const genericError = new Error('Yet another error');
      handleError(genericError, mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        correlationId: 'mock-correlation-id',
      }));
      expect(mockRequest.log.error).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'mock-correlation-id' }), genericError.message);
    });
  });
});