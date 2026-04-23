# Design: mvp-security-and-tests

## API Key Guard

### Implementation

The `ApiKeyGuard` will:
1. Extract the `x-api-key` header from the incoming request
2. Compare it against the `API_KEY` environment variable using timing-safe comparison
3. Throw `UnauthorizedException` if the key is missing or invalid
4. Allow the request through if the key is valid

### Location
- Create `src/common/guards/api-key.guard.ts`

### Code Structure

```typescript
// Pseudo-code for ApiKeyGuard
- Inject ConfigService to get API_KEY
- Extract header: req.headers['x-api-key']
- Use crypto.timingSafeEqual for comparison
- Return true/false via canActivate()
```

### Applied To

- `TransactionsController` - Add `@UseGuards(ApiKeyGuard)` at controller level
- `SyncController` - Add `@UseGuards(ApiKeyGuard)` at controller level

### Not Applied To

- `WebhooksController` - Webhooks are authenticated via HMAC, not API key
- `HealthController` - Health checks should remain open
- `MetricsController` - Metrics should remain open for Prometheus scraping

## Circuit Breaker Integration Tests

### Test Scope

The tests will verify the `CircuitBreakerWrapper` class from `src/sync/circuit-breaker.ts` correctly transitions through all states.

### Test Cases

1. **Initial state is CLOSED**
   - Verify gauge starts at 0
   - Verify `currentState` returns 'CLOSED'

2. **Circuit opens after threshold failures**
   - Configure breaker with low error threshold (e.g., 50%)
   - Fire failing functions until threshold is exceeded
   - Verify state is 'OPEN'
   - Verify gauge is set to 1

3. **Circuit transitions to HALF_OPEN after reset timeout**
   - After opening, wait for `resetTimeout` (30s default)
   - Fire a failing call - should be rejected immediately when open
   - Verify state is 'HALF_OPEN' after reset timeout
   - Verify gauge is set to 2

4. **Circuit closes after successful call in HALF_OPEN**
   - From HALF_OPEN state, fire a successful function
   - Verify state returns to 'CLOSED'
   - Verify gauge returns to 0

### Testing Approach

- Use a mock/fake provider client that can be configured to succeed or fail
- Control timing via Jest fake timers (`jest.useFakeTimers()`)
- Check both `currentState` property and the Prometheus gauge value

### File Location
- Create `test/circuit-breaker.integration.spec.ts`