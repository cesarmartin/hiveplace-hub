# Change: mvp-security-and-tests

## Why

The MVP implementation has two gaps that need to be addressed:

1. **API key authentication not enforced**: The `API_KEY` environment variable is defined in `.env.example` and documented in the Swagger UI, but there is no `ApiKeyGuard` protecting the internal endpoints (`/transactions`, `/sync`). This means the internal API is currently open and accessible without authentication.

2. **Missing circuit breaker tests**: The circuit breaker wrapper (`src/sync/circuit-breaker.ts`) is implemented with opossum, includes metrics for state transitions, but has no integration tests verifying the state transitions work correctly (CLOSED → OPEN → HALF_OPEN → CLOSED).

## What Changes

- **NEW** `ApiKeyGuard` - A guard that validates the `x-api-key` header against the configured `API_KEY` environment variable.
- **UPDATED** `TransactionsController` - Apply `ApiKeyGuard` to protect `/transactions` and `/transactions/:id`.
- **UPDATED** `SyncController` - Apply `ApiKeyGuard` to protect `/sync/:accountId`.
- **NEW** Circuit breaker integration tests - Test that verify:
  - Circuit starts in CLOSED state
  - Opens after threshold failures
  - Transitions to HALF_OPEN after reset timeout
  - Closes after successful call in HALF_OPEN

## Impact

- **Security**: Internal endpoints will require valid API key authentication, preventing unauthorized access.
- **Test coverage**: Adds integration tests for circuit breaker state machine, improving confidence in resilience mechanisms.
- **No breaking changes**: Webhook endpoints (`/webhooks/:provider`) remain unauthenticated (as intended for external providers sending webhooks).