import { test, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import notificationsRoutes from '../../src/routes/notifications';

let fastify: FastifyInstance;

interface Notification {
  id: string;
  user: string;
  message: string;
  createdAt: Date;
}

const mockNotifications: Notification[] = [];
const mockNotificationStore = {
  push: (notification: Notification) => mockNotifications.push(notification),
  getAll: () => mockNotifications.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })),
  clear: () => { mockNotifications.length = 0; },
};

beforeEach(async () => {
  mockNotificationStore.clear(); // Clear the mock store before each test
  fastify = Fastify();
  await fastify.register(notificationsRoutes, { notificationStore: mockNotificationStore });
});

test('GET /notifications returns an empty array initially', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/notifications',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    notifications: [],
    totalCount: 0,
    limit: 10,
    offset: 0,
  });
  expect(mockNotificationStore.getAll()).toEqual([]);
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

  // Assert against the mock store directly
  expect(mockNotificationStore.getAll()).toEqual([responseBody]);

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/notifications',
  });
  expect(getResponse.statusCode).toBe(200);
  expect(getResponse.json()).toEqual({
    notifications: [responseBody],
    totalCount: 1,
    limit: 10,
    offset: 0,
  });
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
  expect(mockNotificationStore.getAll()).toEqual([]);
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
  expect(mockNotificationStore.getAll()).toEqual([]);
});
