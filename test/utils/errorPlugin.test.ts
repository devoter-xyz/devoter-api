// Import test utilities from Vitest
import { describe, it, expect, vi } from 'vitest';
// Import the custom error handler utility and ApiError class
import { handleError, ApiError, HttpStatusCode } from '../../src/utils/errorHandler';
// Import Fastify types for mocking
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('Error Handling', () => {
  describe('handleError', () => {
    it('should return a consistent JSON shape for ApiError instances', () => {
      const mockRequest = {
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      const error = ApiError.badRequest('Invalid input', 'VALIDATION_FAILED');
      handleError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
      expect(mockReply.send).toHaveBeenCalledWith({
        statusCode: HttpStatusCode.BAD_REQUEST,
        message: 'Invalid input',
        code: 'VALIDATION_FAILED',
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith(error);
    });

    it('should return a consistent JSON shape for generic errors', () => {
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
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith(genericError);
    });

    it('should handle Fastify validation errors with a consistent JSON shape', () => {
      const mockRequest = {
        log: { error: vi.fn() },
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
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith(fastifyValidationError);
    });

    it('should handle Prisma unique constraint errors with a consistent JSON shape', () => {
      const mockRequest = {
        log: { error: vi.fn() },
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
      });
      expect(mockRequest.log.error).toHaveBeenCalledWith(prismaUniqueError);
    });
  });
});
