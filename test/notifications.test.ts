import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import notificationsRoutes from '~/routes/notifications.js';

interface Notification {
  id: string;
  user: string;
  message: string;
  createdAt: Date;
}

interface NotificationStore {
  push: (notification: Notification) => void;
  getAll: () => Notification[];
  clear: () => void;
}

describe('Notifications Route', () => {
  let app: Fastify.FastifyInstance;
  let mockNotifications: Notification[];
  let mockNotificationStore: NotificationStore;

  beforeEach(async () => {
    app = Fastify();
    mockNotifications = [];
    mockNotificationStore = {
      push: (notification) => mockNotifications.push(notification),
      getAll: () => mockNotifications,
      clear: () => { mockNotifications.length = 0; },
    };

    await app.register(notificationsRoutes, { notificationStore: mockNotificationStore });

    // Populate some dummy notifications for testing
    for (let i = 0; i < 25; i++) {
      mockNotificationStore.push({
        id: `notif-${i}`,
        user: `user-${i % 3}`,
        message: `Message ${i}`,
        createdAt: new Date(),
      });
    }

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications with default limit and offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.notifications).toHaveLength(10);
      expect(body.totalCount).toBe(25);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);
      expect(body.notifications[0].id).toBe('notif-0');
      expect(body.notifications[9].id).toBe('notif-9');
    });

    it('should return paginated notifications with custom limit and offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=5&offset=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.notifications).toHaveLength(5);
      expect(body.totalCount).toBe(25);
      expect(body.limit).toBe(5);
      expect(body.offset).toBe(10);
      expect(body.notifications[0].id).toBe('notif-10');
      expect(body.notifications[4].id).toBe('notif-14');
    });

    it('should return fewer notifications if limit exceeds available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=20&offset=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.notifications).toHaveLength(15); // 25 total - 10 offset = 15 remaining
      expect(body.totalCount).toBe(25);
      expect(body.limit).toBe(20);
      expect(body.offset).toBe(10);
      expect(body.notifications[0].id).toBe('notif-10');
      expect(body.notifications[14].id).toBe('notif-24');
    });

    it('should return empty array if offset is beyond total count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=10&offset=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.notifications).toHaveLength(0);
      expect(body.totalCount).toBe(25);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(30);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=abc&offset=0',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).message).toContain('querystring/limit must be integer');
    });

    it('should return 400 for invalid offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=5&offset=xyz',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).message).toContain('querystring/offset must be integer');
    });

    it('should return 400 for negative limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=-5&offset=0',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).message).toContain('querystring/limit must be >= 1');
    });

    it('should return 400 for negative offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/notifications?limit=5&offset=-10',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).message).toContain('querystring/offset must be >= 0');
    });
  });

  describe('POST /notifications', () => {
    it('should prevent replay attacks by rejecting duplicate signatures', async () => {
      const { verifySignatureWithTimestamp } = await import('~/utils/verifySignature.js');
      const verifySignatureSpy = vi.spyOn(verifySignatureWithTimestamp, 'verifySignatureWithTimestamp');
      verifySignatureSpy.mockReturnValue({ isValid: true, error: null });

      const user = '0x1234567890abcdef';
      const message = 'Hello World';
      const signedMessage = 'test_message';
      const signature = '0xabcdef1234567890';

      // First request should succeed
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/notifications',
        payload: {
          user,
          message,
          signedMessage,
          signature,
        },
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstPayload = JSON.parse(firstResponse.payload);
      expect(firstPayload).toMatchObject({
        user,
        message,
      });
      expect(firstPayload).toHaveProperty('id');
      expect(firstPayload).toHaveProperty('createdAt');

      // Second request with the same payload should be rejected
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/notifications',
        payload: {
          user,
          message: 'Hello World Again', // Message can be different, signature is the key
          signedMessage,
          signature,
        },
      });

      expect(secondResponse.statusCode).toBe(401);
      expect(JSON.parse(secondResponse.payload).error).toBe('Unauthorized: Message has already been processed.');

      verifySignatureSpy.mockRestore(); // Clean up the spy
    });
  });
});
