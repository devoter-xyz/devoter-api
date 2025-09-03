# Testing in devoter-api

This directory contains tests for the devoter-api service.

## Structure

The tests are organized to mirror the structure of the source code:

```
test/
├── utils/         # Tests for utility functions
│   ├── verifySignature.test.ts
│   └── generateApiKey.test.ts (coming soon)
├── middleware/    # Tests for middleware (coming soon)
├── routes/        # Tests for API routes (coming soon)
└── integration/   # Integration tests (coming soon)
```

## Running Tests

To run the tests, use the following command:

```bash
npm test
```

## Test Coverage

We aim for comprehensive test coverage of the codebase, focusing on:

1. Core utility functions
2. Authentication middleware
3. API endpoint logic
4. Edge cases and error handling

## Current Progress

- ✅ Basic signature verification
  - Valid signatures from known wallet addresses
  - Invalid signatures (wrong message, wrong address)

## Next Steps

- Complete remaining signature verification tests
- Add tests for API key generation utilities
- Add integration tests for API endpoints
