import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

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

// TODO: This module-level in-memory notifications array is unsafe for production.
// It suffers from per-worker copies, unbounded growth, and data loss on restart.
// Before deployment, replace this with a persistent store (e.g., PostgreSQL, Redis).
// Implement a bounded retention strategy (e.g., max size, TTL) and pagination/limit support.
// Refactor the code to use an async persistence layer (abstracted repository/service)
// instead of directly accessing this mutable module-level state, ensuring clustered
// workers share data and memory usage is controlled.
const notifications: Notification[] = [];

const defaultNotificationStore: NotificationStore = {
  push: (notification) => notifications.push(notification),
  getAll: () => notifications,
  clear: () => { notifications.length = 0; }
};

interface NotificationsRoutesOptions extends FastifyPluginOptions {
  notificationStore?: NotificationStore;
}

async function notificationsRoutes(fastify: FastifyInstance, options: NotificationsRoutesOptions) {
  const store = options.notificationStore || defaultNotificationStore;

  // GET /notifications - fetch all notifications with pagination
  fastify.get('/notifications', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, default: 10 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit, offset } = request.query as { limit: number; offset: number };

    const allNotifications = store.getAll();
    const paginatedNotifications = allNotifications.slice(offset, offset + limit);

    return {
      notifications: paginatedNotifications,
      totalCount: allNotifications.length,
      limit,
      offset,
    };
  });

  // POST /notifications - create a new notification
  fastify.post('/notifications', async (request, reply) => {
    const { user, message } = request.body as { user?: string; message?: string };

    if (!user || !message) {
      reply.status(400);
      return { error: 'User and message are required.' };
    }

    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      user,
      message,
      createdAt: new Date(),
    };
    store.push(newNotification);
    reply.status(201);
    return newNotification;
  });
}

export default notificationsRoutes;
