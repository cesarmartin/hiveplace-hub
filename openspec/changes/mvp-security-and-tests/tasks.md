# Tasks: mvp-security-and-tests

## 1. Create ApiKeyGuard

- [x] 1.1 Create `src/common/guards/api-key.guard.ts`
- [x] 1.2 Inject ConfigService to read `API_KEY` from environment
- [x] 1.3 Implement `canActivate()` to validate `x-api-key` header
- [x] 1.4 Use timing-safe comparison to prevent timing attacks
- [x] 1.5 Throw `UnauthorizedException` on invalid/missing key
- [x] 1.6 Add Swagger header decorator for API key

## 2. Apply guard to TransactionsController

- [x] 2.1 Import `ApiKeyGuard` in `transactions.controller.ts`
- [x] 2.2 Add `@UseGuards(ApiKeyGuard)` at controller level
- [x] 2.3 Verify both endpoints (`/transactions`, `/transactions/:id`) require auth

## 3. Apply guard to SyncController

- [x] 3.1 Import `ApiKeyGuard` in `sync.controller.ts`
- [x] 3.2 Add `@UseGuards(ApiKeyGuard)` at controller level
- [x] 3.3 Verify `/sync/:accountId` requires auth

## 4. Add circuit breaker integration tests

- [x] 4.1 Create `test/circuit-breaker.integration.spec.ts`
- [x] 4.2 Test: initial state is CLOSED
- [x] 4.3 Test: circuit opens after threshold failures
- [x] 4.4 Test: circuit transitions to HALF_OPEN after reset timeout
- [x] 4.5 Test: circuit closes after successful call in HALF_OPEN

## 5. Verify and run tests

- [x] 5.1 Generate Prisma types: `npm run prisma:generate`
- [x] 5.2 Run tests: `npm run test`
- [x] 5.3 Verify guards work via manual curl:
  - `curl http://localhost:3000/transactions` (should return 401)
  - `curl -H "x-api-key: dev-api-key-change-me" http://localhost:3000/transactions` (should return 200)