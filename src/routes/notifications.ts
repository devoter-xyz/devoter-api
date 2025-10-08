import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

// TODO: This module-level in-memory notifications array is unsafe for production.
// It suffers from per-worker copies, unbounded growth, and data loss on restart.
// Before deployment, replace this with a persistent store (e.g., PostgreSQL, Redis).
// Implement a bounded retention strategy (e.g., max size, TTL) and pagination/limit support.
// Refactor the code to use an async persistence layer (abstracted repository/service)
// instead of directly accessing this mutable module-level state, ensuring clustered
// workers share data and memory usage is controlled.
const notifications: Array<{
  id: string;
  user: string;
  message: string;
  createdAt: Date;
}> = [];


async function notificationsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // GET /notifications - fetch all notifications
  fastify.get('/notifications', async (request, reply) => {
    // Return all notifications
    return notifications;
  });

  // POST /notifications - create a new notification
  fastify.post('/notifications', async (request, reply) => {
    const { user, message } = request.body as { user?: string; message?: string };
    if (!user || !message) {
      reply.status(400);
      return { error: 'User and message are required.' };
    }
    const newNotification = {
      id: Math.random().toString(36).substr(2, 9),
      user,
      message,
      createdAt: new Date(),
    };
    notifications.push(newNotification);
    reply.status(201);
    return newNotification;
  });
}

export default notificationsRoutes;
