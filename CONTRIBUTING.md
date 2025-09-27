# Contributing to Devoter API

Thank you for your interest in contributing to Devoter API! This guide explains how to set up your environment, make changes, and submit pull requests in a consistent and high‑quality manner.

Please also review our community guidelines:

- Code of Conduct: see `CODE_OF_CONDUCT.md` in this repository.

---

## Ways to Contribute

- Report bugs and propose enhancements
- Improve documentation (including files under `docs/`)
- Add tests to increase coverage and guard against regressions
- Implement new features and fix issues

For larger changes, open an issue to discuss the approach before starting.

---

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- A database compatible with the Prisma schema (commonly PostgreSQL)

### 1) Fork and clone the repo

```bash
# Replace <your-user> with your GitHub username
git clone https://github.com/<your-user>/devoter-api.git
cd devoter-api
```

### 2) Install dependencies

```bash
pnpm install
# or: npm install / yarn install
```

### 3) Environment variables

Create a local `.env` file with the variables required by the app. Typical keys include:

- `PORT` (default: 3000)
- `HOST` (default: localhost)
- `CORS_ORIGIN` (default: http://localhost:3000)
- `DATABASE_URL` (Prisma connection string)
- optional: `NODE_ENV` (development | production)

### 4) Prisma database setup

Generate Prisma Client and apply pending migrations to your dev database:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate dev
```

You can inspect data with Prisma Studio:

```bash
pnpm exec prisma studio
```

### 5) Run the app in development

```bash
pnpm dev
```

The server will start on `http://localhost:3000` by default.

### 6) Build for production

```bash
pnpm build
```

### 7) Tests

This project uses Vitest.

```bash
# Run the test suite
pnpm test

# Run with coverage
pnpm test:coverage
```

---

## Project Conventions

- Language: TypeScript (strict)
- Framework: Fastify 5
- Validation: `@sinclair/typebox`
- Rate limiting: see `src/middleware/rateLimit.ts`
- Error handling: see `src/plugins/errorPlugin.ts` and `src/utils/errorHandler.ts`
- Auth / signature verification: see `src/middleware/auth.ts` and `src/utils/verifySignature.ts`

General guidelines:

- Favor small, focused modules and Fastify plugins
- Use async/await and handle errors with the provided helpers
- Define schemas for request/response on routes
- Keep functions small and add tests

Documentation:

- Update `docs/` when behavior, error handling, or rate limits change
- Keep `README.md` in sync for notable developer‑facing changes

---

## Git and Branching

We follow a lightweight GitHub Flow.

- Branch from `main`
- Use descriptive branch names: `<type>/<short-description>`
  - Examples: `feat/register-endpoint`, `fix/invalid-port`, `docs/update-rate-limits`
- Use clear commit messages (Conventional Commits recommended):
  - `feat: add registration route with wallet signature verification`
  - `fix: validate PORT env var and fail fast`
  - `docs: document error handling strategy`

---

## Pull Requests

Before opening a PR, please ensure:

- The code compiles and type‑checks: `pnpm build`
- Tests are added/updated and passing: `pnpm test`
- Relevant docs are updated if behavior or APIs changed
- Prisma migrations are included if the schema changed
- The PR description explains the problem, solution, and any trade‑offs

PR checklist:

- [ ] Build succeeds (no TypeScript errors)
- [ ] Tests passing (and new tests added if applicable)
- [ ] Documentation updated (if applicable)
- [ ] Small, focused changes (no unrelated diffs)

Maintainers will review your PR and may request changes. Please be responsive to feedback.

---

## Reporting Issues

When filing an issue, include:

- Expected vs. actual behavior
- Steps to reproduce (ideally minimal and deterministic)
- Logs/error messages (redact secrets)
- Environment details (OS, Node.js version, database)
- Any relevant configs or payloads

---

## Security

If you discover a security vulnerability, do not open a public issue. Please report it privately (e.g., via GitHub Security Advisories) so we can coordinate a fix and disclosure.

---

## License

By contributing, you agree that your contributions will be licensed under the same license specified in `package.json`.

Thanks for helping improve Devoter API!
