# Change: add-provider-integration-hub

## Why

The HIVEPlace business is defined by consuming events from heterogeneous external systems (banks, tribunals, fintechs, fraud partners) whose contracts differ in field names, units, status codes, and delivery semantics. Downstream consumers need a single, predictable contract — they should not care that provider A uses snake_case integer cents while provider B uses camelCase strings.

Without a normalization layer, every downstream consumer has to re-learn every provider's quirks, and every provider outage leaks directly into our own availability. This change introduces a dedicated integration hub that isolates external contracts from internal consumers, enforces idempotency on noisy webhook deliveries, and survives provider-side instability without data loss.

## What Changes

- **NEW** `webhook-ingestion` capability: HMAC-authenticated webhook endpoints per provider, with DB-backed idempotency and fast-path 202 acknowledgement.
- **NEW** `transaction-normalization` capability: adapter-per-provider architecture that translates divergent external payloads into a single canonical `Transaction` model.
- **NEW** `provider-sync` capability: on-demand pull endpoint to reconcile an account against a provider, with bounded retry + timeout + circuit breaker per provider client.
- **NEW** `transaction-query` capability: paginated, filterable internal API for downstream consumers to read the canonical store.
- **NEW** observability surface: `/health` (with DB probe), `/metrics` (Prometheus), `/docs` (Swagger), structured logs with header redaction.

## Impact

- **Affected code**: entirely new — no existing production specs to modify. This is a greenfield challenge delivery.
- **Data**: new canonical `Transaction` table and `IdempotencyKey` ledger in SQLite (swappable to Postgres via `DATABASE_URL`).
- **APIs**: introduces `/webhooks/:provider`, `/transactions`, `/transactions/:id`, `/sync/:accountId`, `/health`, `/metrics`, `/docs`.
- **Secrets**: introduces `PLUGGY_WEBHOOK_SECRET`, `BELVO_WEBHOOK_SECRET`, `API_KEY` as required env vars.
- **Operational**: one long-lived Node process plus two mock provider containers for local runs; a Prometheus scraper can attach to `/metrics` with no extra configuration.
