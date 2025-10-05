import { test, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance, FastifyPluginOptions } from 'fastify';
import notificationsRoutes from '../../src/routes/notifications';

let fastify: FastifyInstance;

beforeEach(async () => {
  fastify = Fastify();
  await fastify.register(notificationsRoutes);
});

test('GET /notifications returns an empty array initially', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/notifications',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([]);
});

test('POST /notifications creates a new notification', async () => {
  const newNotification = {
    user: 'testUser',
    message: 'This is a test notification',
  };

  const response = await fastify.inject({
    method: 'POST',
    url: '/notifications',
    payload: newNotification,
  });

  expect(response.statusCode).toBe(201);
  const responseBody = response.json();
  expect(responseBody).toHaveProperty('id');
  expect(responseBody.user).toBe(newNotification.user);
  expect(responseBody.message).toBe(newNotification.message);
  expect(responseBody).toHaveProperty('createdAt');

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/notifications',
  });
  expect(getResponse.statusCode).toBe(200);
  expect(getResponse.json()).toEqual([responseBody]);
});

test('POST /notifications returns 400 if user is missing', async () => {
  const newNotification = {
    message: 'This is a test notification',
  };

  const response = await fastify.inject({
    method: 'POST',
    url: '/notifications',
    payload: newNotification,
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: 'User and message are required.' });
});

test('POST /notifications returns 400 if message is missing', async () => {
  const newNotification = {
    user: 'testUser',
  };

  const response = await fastify.inject({
    method: 'POST',
    url: '/notifications',
    payload: newNotification,
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: 'User and message are required.' });
});
