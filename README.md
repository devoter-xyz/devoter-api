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
