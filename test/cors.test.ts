import { test, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { build } from '../src/server.js';
import { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let request: supertest.SuperTest<supertest.Test>;

beforeAll(async () => {
  process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.com,https://api.allowed.com,/^http:\/\/regex\.example\.com$/';
  process.env.CORS_ALLOWED_METHODS = 'GET,POST';
  process.env.CORS_ALLOWED_HEADERS = 'Content-Type,Authorization';
  process.env.CORS_CREDENTIALS = 'true';

  server = await build();
  request = supertest(server.server);

  await server.ready();
});

afterAll(async () => {
  await server.close();
  // Clean up environment variables
  delete process.env.CORS_ALLOWED_ORIGINS;
  delete process.env.CORS_ALLOWED_METHODS;
  delete process.env.CORS_ALLOWED_HEADERS;
  delete process.env.CORS_CREDENTIALS;
});

test('should allow requests from an explicitly allowed origin', async () => {
  const response = await request.get('/health').set('Origin', 'http://allowed.com');
  expect(response.headers['access-control-allow-origin']).toBe('http://allowed.com');
  expect(response.headers['access-control-allow-credentials']).toBe('true');
  expect(response.statusCode).toBe(200);
});

test('should allow requests from a regex-matched origin', async () => {
  const response = await request.get('/health').set('Origin', 'http://regex.example.com');
  expect(response.headers['access-control-allow-origin']).toBe('http://regex.example.com');
  expect(response.headers['access-control-allow-credentials']).toBe('true');
  expect(response.statusCode).toBe(200);
});

test('should disallow requests from an unallowed origin', async () => {
  const response = await request.get('/health').set('Origin', 'http://unallowed.com');
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe('Forbidden: Not allowed by CORS');
});

test('should handle preflight requests for allowed origin', async () => {
  const response = await request.options('/health')
    .set('Origin', 'http://allowed.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

  expect(response.statusCode).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe('http://allowed.com');
  expect(response.headers['access-control-allow-methods']).toBe('GET,POST');
  expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
  expect(response.headers['access-control-allow-credentials']).toBe('true');
});

test('should handle preflight requests for unallowed origin', async () => {
  const response = await request.options('/health')
    .set('Origin', 'http://unallowed.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'Content-Type');

  expect(response.statusCode).toBe(403);
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
});

test('should allow requests with no origin header (same-origin or direct access)', async () => {
  const response = await request.get('/health');
  expect(response.headers['access-control-allow-origin']).toBeUndefined(); // No CORS headers for same-origin
  expect(response.statusCode).toBe(200);
});

test('should allow requests from an allowed subdomain', async () => {
  const response = await request.get('/health').set('Origin', 'https://api.allowed.com');
  expect(response.headers['access-control-allow-origin']).toBe('https://api.allowed.com');
  expect(response.statusCode).toBe(200);
});

test('should handle CORS_ALLOWED_ORIGINS with a single wildcard', async () => {
  delete process.env.CORS_ALLOWED_ORIGINS;
  process.env.CORS_ALLOWED_ORIGINS = '*';
  const wildcardServer = await build();
  const wildcardRequest = supertest(wildcardServer.server);
  await wildcardServer.ready();

  const response = await wildcardRequest.get('/health').set('Origin', 'http://anydomain.com');
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(response.statusCode).toBe(200);

  await wildcardServer.close();
});

test('should disallow requests from any origin when CORS_ALLOWED_ORIGINS is not set', async () => {
  delete process.env.CORS_ALLOWED_ORIGINS;
  const defaultServer = await build();
  const defaultRequest = supertest(defaultServer.server);
  await defaultServer.ready();

  const response = await defaultRequest.get('/health').set('Origin', 'http://anotherdomain.com');
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe('Forbidden: Not allowed by CORS');

  await defaultServer.close();
});
