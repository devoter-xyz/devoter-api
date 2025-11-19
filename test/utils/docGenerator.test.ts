import { test, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../src/server';
import { FastifyInstance } from 'fastify';

let server: FastifyInstance;

beforeAll(async () => {
  server = await build();
  await server.listen({ port: 0 }); // Listen on a random available port
});

afterAll(async () => {
  await server.close();
});

test('GET /docs/openapi.json should return a valid OpenAPI specification', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/docs/openapi.json',
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('application/json');

  const openApiSpec = JSON.parse(response.payload);

  expect(openApiSpec).toBeDefined();
  expect(openApiSpec.openapi).toBe('3.0.3');
  expect(openApiSpec.info.title).toBe('Devoter API');
  expect(openApiSpec.info.version).toBe('1.0.0');
  expect(openApiSpec.paths).toBeDefined();

  // Verify a specific route from apiKeys.ts
  expect(openApiSpec.paths['/api/v1/api-keys']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys'].post).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys'].post.summary).toBe('Create a new API key');
  expect(openApiSpec.paths['/api/v1/api-keys'].post.tags).toContain('API Keys');
  expect(openApiSpec.paths['/api/v1/api-keys'].post.security).toEqual([
    {
      signature: [],
    },
  ]);

  // Verify a specific response schema for POST /api/v1/api-keys
  const postApiKey201Response = openApiSpec.paths['/api/v1/api-keys'].post.responses['201'].content['application/json'].schema;
  expect(postApiKey201Response).toBeDefined();
  expect(postApiKey201Response.properties.apiKey).toBeDefined();
  expect(postApiKey201Response.properties.apiKey.description).toBe('The newly generated API key. This is the only time it will be displayed.');

  // Verify error responses
  const postApiKey400Response = openApiSpec.paths['/api/v1/api-keys'].post.responses['400'].content['application/json'].schema;
  expect(postApiKey400Response).toBeDefined();
  expect(postApiKey400Response.properties.code).toBeDefined();
  expect(postApiKey400Response.properties.code.examples).toContain('MAX_API_KEYS_REACHED');

  // Verify GET /api/v1/api-keys
  expect(openApiSpec.paths['/api/v1/api-keys'].get).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys'].get.summary).toBe('Get all API keys for a wallet');
  expect(openApiSpec.paths['/api/v1/api-keys'].get.security).toEqual([
    {
      signature: [],
    },
  ]);

  // Verify GET /api/v1/api-keys/metadata
  expect(openApiSpec.paths['/api/v1/api-keys/metadata']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/metadata'].get).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/metadata'].get.summary).toBe('Get API key metadata for a wallet');

  // Verify POST /api/v1/api-keys/{id}/rotate
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/rotate']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/rotate'].post).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/rotate'].post.summary).toBe('Rotate an API key');

  // Verify DELETE /api/v1/api-keys/{id}
  expect(openApiSpec.paths['/api/v1/api-keys/{id}']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}'].delete).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}'].delete.summary).toBe('Revoke an API key');

  // Verify GET /api/v1/api-keys/{id}/usage
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage'].get).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage'].get.summary).toBe('Get API key usage statistics');

  // Verify GET /api/v1/api-keys/{id}/usage/export
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage/export']).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage/export'].get).toBeDefined();
  expect(openApiSpec.paths['/api/v1/api-keys/{id}/usage/export'].get.summary).toBe('Export API key usage data');
});

test('GET /docs should return the Swagger UI HTML page', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/docs',
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
  expect(response.payload).toContain('<div id="swagger-ui"></div>');
});
