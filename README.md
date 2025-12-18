# Devoter API

The **Devoter API** is the backend service for the [Devoter App](https://github.com/devoter-xyz/devoter-app).
It provides a fast, secure, and scalable API built with [Fastify](https://fastify.dev/) to power voting, governance, and community engagement features.

---

## 🚀 Features

* ⚡ **High-performance API** powered by Fastify.
* 🔒 **Secure authentication & authorization** with JWT/session support.
* 🗳️ Endpoints for **polls, votes, results, and user management**.
* 🛠️ Built with **TypeScript** for type safety and maintainability.
* 📦 Simple to deploy with Docker & CI/CD pipelines.

---

## ⚠️ Breaking Changes & Migration Guide

### API Key Delimiter Change

**Effective immediately, the delimiter for newly generated API keys has changed from `_` (underscore) to `.` (dot).** This change improves consistency and aligns with common API key formatting standards.

**Impact:**

*   **Existing API Keys**: For backward compatibility, the API will continue to accept and normalize existing underscore-delimited keys during a grace period. However, it is **highly recommended** to migrate all active API keys to the new dot-delimited format.
*   **New API Key Generation**: All newly generated API keys will use the `.` delimiter.

**Migration Steps:**

1.  **Re-issue/Rotate API Keys**: During the grace period, administrators should re-issue or rotate all active API keys that use the `_` delimiter. A dedicated admin tool or script will be provided to assist with this process.
2.  **Update Client Integrations**: Any client applications, SDKs, or custom scripts that generate, validate, or parse API keys should be updated to expect and generate the new `.` delimited format.
3.  **Monitor Usage**: During the grace period, monitor API logs for warnings indicating the use of legacy underscore-delimited keys. This will help identify clients that still need to be updated.
4.  **Strict Mode Enforcement**: After the grace period, a configuration option will be available to enable strict validation, rejecting all API keys that do not use the `.` delimiter.

---

## 📂 Project Structure

```bash
devoter-api/
├── src/
│   ├── routes/       # API route definitions
│   ├── plugins/      # Fastify plugins (auth, db, etc.)
│   ├── services/     # Business logic
│   ├── schemas/      # JSON schemas for validation
│   └── index.ts      # App entrypoint
├── tests/            # Unit & integration tests
├── package.json
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) **v18+**
* [pnpm](https://pnpm.io/) (recommended) or npm/yarn
* [Docker](https://www.docker.com/) (optional, for containerized DB/dev)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/devoter-xyz/devoter-api.git
cd devoter-api
pnpm install
```

### Running in Development

Start the API in watch mode:

```bash
pnpm dev
```

The server will start at [http://localhost:3000](http://localhost:3000).

### Running in Production

Build and run:

```bash
pnpm build
pnpm start
```

### Linting

Fix linting issues automatically:

```bash
pnpm lint:fix
```

### Graceful Shutdown

The API implements a comprehensive graceful shutdown process to ensure minimal disruption and data integrity during restarts or deployments. Upon receiving a `SIGINT` or `SIGTERM` signal, the server initiates the following sequence:

1.  **Connection Draining**: The server stops accepting new incoming requests but continues to process existing, in-flight requests.
2.  **Readiness Probe**: The `/health/ready` endpoint will immediately begin returning a `503 Service Unavailable` status, signaling to load balancers or orchestrators (e.g., Kubernetes) that the instance is no longer ready to receive traffic.
3.  **Configurable Timeout**: A configurable timeout (defaulting to `SHUTDOWN_TIMEOUT_SECONDS` from environment variables, 30 seconds) is started. If existing connections or cleanup tasks do not complete within this period, the server will forcefully terminate.
4.  **Resource Cleanup**: Hooks are triggered to gracefully shut down and clean up various resources:
    *   **Prisma Connections**: The Prisma client disconnects from the database.
    *   **Rate Limit Cache**: The internal cleanup interval for the replay protection cache is stopped.
    *   **Rate Limit Analytics**: In-memory rate limit analytics are cleared.
    *   **Other Intervals/Timeouts**: Any other active `setInterval` or `setTimeout` operations should be cleared.
5.  **Process Exit**: Once all connections are drained and resources are cleaned up (or the timeout is reached), the process exits.

This ensures that ongoing operations have a chance to complete, and the server can be safely removed from a service mesh without dropping requests.

---

## ⚡ API Documentation

API routes and schemas are documented with [Fastify Swagger](https://github.com/fastify/fastify-swagger).
Once running, you can view docs at:

```
http://localhost:3000/docs
```

---

## 🧪 Testing

Run unit and integration tests:

```bash
pnpm test
```

---

## 🐳 Docker

You can run the API in a container:

```bash
docker build -t devoter-api .
docker run -p 3000:3000 devoter-api
```

---

## 📜 Environment Variables

Copy `.env.example` to `.env` and configure your environment:

```bash
cp .env.example .env
```

| Variable       | Description                        | Default |
| -------------- | ---------------------------------- | ------- |
| `PORT`         | Port to run the API on             | 3000    |
| `DATABASE_URL` | Connection string for the database | -       |
| `JWT_SECRET`   | Secret key for signing tokens      | -       |

---

## 🤝 Contributing

Contributions are welcome! Please check out our [Devoter App repo](https://github.com/devoter-xyz/devoter-app) for the broader ecosystem.
