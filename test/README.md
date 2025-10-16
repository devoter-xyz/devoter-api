# Testing in devoter-api

This directory contains tests for the devoter-api service

## Structure

The tests are organized to mirror the structure of the source code:

```
test/
├── utils/         # Tests for utility functions
│   ├── ethereumAddress.test.ts
│   ├── generateApiKey.test.ts
│   ├── messageFormat.test.ts
│   ├── validation.test.ts
│   └── verifySignature.test.ts
├── middleware/    # Tests for middleware (coming soon)
├── routes/        # Tests for API routes (coming soon)
└── integration/   # Integration tests (coming soon)
```

## Running Tests

To run all tests, use the following command:

```bash
npm test
```

To run tests in watch mode (re-runs on file changes):

```bash
npm run test:watch
```

To run tests and generate a coverage report:

```bash
npm run test:coverage
```

To run a specific test file, you can pass the file path to `vitest`:

```bash
npx vitest run test/utils/validation.test.ts
```

## Troubleshooting

*   **Tests not running:** Ensure all dependencies are installed by running `npm install`.
*   **Coverage not generating:** Make sure `vitest` is correctly configured in `vitest.config.mts` and all dependencies are installed.
*   **"Cannot find module" errors:** Check your `tsconfig.json` and ensure paths are correctly configured.

## Test Coverage

We aim for comprehensive test coverage of the codebase, focusing on:

1.  Core utility functions
2.  Authentication middleware
3.  API endpoint logic
4.  Edge cases and error handling

## Current Progress

-   ✅ Basic signature verification
    -   Valid signatures from known wallet addresses
    -   Invalid signatures (wrong message, wrong address)

## Next Steps

-   Complete remaining signature verification tests
-   Add tests for API key generation utilities
-   Add integration tests for API endpoints