# Tasks: add-provider-integration-hub

## 1. Scaffolding and infrastructure

- [x] 1.1 Initialize NestJS + TypeScript project with `package.json`, `tsconfig.json`, `nest-cli.json`
- [x] 1.2 Configure Prisma with SQLite, `DATABASE_URL` in env, initial migration for `Transaction` + `IdempotencyKey`
- [x] 1.3 Write multi-stage `Dockerfile` and `docker-compose.yml` with app + 2 mock services
- [x] 1.4 Wire `nestjs-pino` logger with header redaction (`authorization`, `x-api-key`, `x-signature`)
- [x] 1.5 Mount Swagger at `/docs` with API key security scheme
- [x] 1.6 Expose `/health` endpoint with shallow DB probe
- [x] 1.7 Expose `/metrics` endpoint via `prom-client` with default + domain counters

## 2. Mock providers (deliberately divergent contracts)

- [x] 2.1 `mocks/pluggy-mock.ts` — camelCase, string amounts, ISO timestamps, string enums
- [x] 2.2 `mocks/belvo-mock.ts` — snake_case, integer cents, epoch seconds, numeric enums
- [x] 2.3 `GET /accounts/:id/transactions` and `GET /accounts/:id/movements` for sync pulls
- [x] 2.4 `POST /__emit/:id` helper that signs and POSTs a webhook to the hub

## 3. Webhook ingestion

- [x] 3.1 `HmacGuard` verifying `sha256=<hex>` header against per-provider secret on raw body
- [x] 3.2 `IdempotencyService` backed by DB `UNIQUE` key on `(provider, external_id)`
- [x] 3.3 `WebhooksController` with `POST /webhooks/:provider` — HMAC guard + idempotency + 202 ack
- [x] 3.4 Metric `webhooks_received_total{provider,outcome}` with outcomes `queued | duplicate | missing_id | invalid_signature`

## 4. Adapter + normalization layer

- [ ] 4.1 `ProviderAdapter` interface: `normalize(raw: unknown): CanonicalTransaction`
- [ ] 4.2 `PluggyAdapter` mapping camelCase/string/ISO → canonical
- [ ] 4.3 `BelvoAdapter` mapping snake_case/cents/epoch → canonical
- [ ] 4.4 `AdapterRegistry` resolving provider name → adapter instance
- [ ] 4.5 Unit tests for each adapter covering happy path + malformed payload + status mapping edge cases

## 5. Async processing

- [ ] 5.1 `InMemoryQueue` with bounded size and single-worker consumer loop
- [ ] 5.2 Webhook controller enqueues `{provider, rawPayload}` after idempotency reserve
- [ ] 5.3 Worker consumes, picks adapter, persists canonical row, increments `transactions_persisted_total{provider}`
- [ ] 5.4 On adapter/persistence failure, release the idempotency key so a future retry can succeed (or log for DLQ)

## 6. Provider sync (pull)

- [ ] 6.1 `ProviderClient` per provider with axios + timeout + retry + jitter
- [ ] 6.2 Wrap each client in an `opossum` circuit breaker with per-provider config
- [ ] 6.3 `SyncController` exposing `POST /sync/:accountId?provider=<p>`
- [ ] 6.4 Sync is idempotent: uses the same `(provider, external_id)` dedupe path as webhooks
- [ ] 6.5 Metric `circuit_breaker_state{provider}` emitting on state transitions

## 7. Transaction query API

- [ ] 7.1 `GET /transactions` with filters (`provider`, `status`, `accountId`) and cursor pagination
- [ ] 7.2 `GET /transactions/:id` detail endpoint
- [ ] 7.3 DTO validation with `class-validator`; 400 on invalid query params

## 8. Tests

- [x] 8.1 Unit: HMAC sanity (producer signs, consumer verifies, timing-safe equality holds)
- [ ] 8.2 Unit: each adapter converts a sample payload to the canonical shape
- [ ] 8.3 Integration: duplicate webhook delivery → one `Transaction` row, second POST returns `{duplicate: true}`
- [ ] 8.4 Integration: sync with a stubbed provider that fails N times → circuit breaker opens; log shows `closed → open`
- [ ] 8.5 Integration: sync with a recovering provider → circuit breaker transitions `open → half-open → closed`

## 9. Documentation and demo

- [x] 9.1 `README.md` with ASCII architecture diagram, quick start, endpoint reference
- [x] 9.2 `DECISIONS.md` covering priorities, out-of-scope, risks, scaling plan, stack justifications
- [x] 9.3 OpenSpec change folder at `openspec/changes/add-provider-integration-hub/` with proposal, design, tasks, specs
- [ ] 9.4 Record a 3-minute Loom walking through: architecture, webhook flow, resilience demo, observability
- [ ] 9.5 Final push to git remote; verify fresh clone runs `docker compose up --build` successfully
