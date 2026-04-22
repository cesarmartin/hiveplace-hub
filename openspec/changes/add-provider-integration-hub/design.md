# Design: add-provider-integration-hub

## Context

The challenge is time-boxed (approximately 8 working hours). The brief calls for two or more heterogeneous external sources, normalization to a canonical model, persistence, a unified internal API, resilience (retry / timeout / circuit breaker / fallback), idempotency, observability, and documented trade-offs.

The domain chosen is Open Finance-style transaction events, aligned with HIVEPlace's core business of interoperability between heterogeneous financial systems. Two mock providers (`pluggy`, `belvo`) are implemented in-repo with deliberately divergent payload contracts to exercise the normalization layer.

## Goals

- Deliver a demonstrably working ingestion → normalization → persistence → query pipeline.
- Make the resilience and idempotency properties observable at runtime (logs + metrics).
- Keep the code organized so adding a third provider is a localized change.
- Finish on time with room for a README + DECISIONS document and a short demo recording.

## Non-Goals

- Multi-instance deployment. A single process is sufficient for the submission.
- Auth beyond a documented API key. No OAuth2, no mTLS, no role-based access.
- A frontend. Swagger is the operator UI.
- Dead-letter queues, replay windows, tenant isolation. These are mentioned in DECISIONS as "what I'd do with more time."

## Decisions

### 1. Canonical model normalizes to integer cents and ISO-8601

Amounts are stored as `amountCents: Int`. Timestamps are stored as `DateTime` (ISO-8601). This avoids floating-point drift and the ambiguity of "is this a string or a number" that keeps coming back across providers. The adapter is responsible for converting:

| Provider | Raw amount          | Raw timestamp               | Adapter converts to |
| -------- | ------------------- | --------------------------- | ------------------- |
| Pluggy   | `"123.45"` (string) | `"2026-04-22T12:00:00Z"`    | cents, ISO          |
| Belvo    | `12345` (int cents) | `1713787200` (epoch seconds)| cents, ISO          |

### 2. Idempotency backed by a DB UNIQUE key, not Redis

For the scope of a single-instance challenge submission, a DB row with a unique `(provider, external_id)` key is the simplest source of truth that survives restarts. The contract is: the first `reserve()` wins; subsequent calls return `false` and the webhook is acknowledged but not reprocessed.

Trade-off: in a multi-instance deployment, this works but concentrates lock contention on the DB. Production version would move to Redis `SET NX EX` with a TTL ledger. Documented in DECISIONS.

### 3. Async processing via an in-memory queue

Webhook handlers must ack quickly (202) so providers don't retry aggressively. Heavy work (adapter + persistence) is enqueued into an in-process FIFO queue with a single worker. The queue is a plain Node array + Promise-based consumer loop — deliberately not RabbitMQ/BullMQ — because adding queue infra eats into the delivery budget.

Trade-off: if the process dies while events are enqueued, those events are lost. Mitigation: the idempotency ledger is only written *after* successful persistence, so a provider retry will re-deliver and succeed. The raw payload is also stored on the canonical row for audit/reprocessing.

### 4. Resilience wrappers are per-provider, not global

Each provider client (used by the sync pull endpoint) is wrapped in its own `opossum` circuit breaker with its own config: timeout, volume threshold, error rate, sleep window. This isolates failure: if Belvo is down, Pluggy calls still succeed. A global breaker would couple them.

Retries use exponential backoff with jitter, capped at 3 attempts. Retry budget is bounded to avoid amplifying provider outages.

### 5. HMAC-SHA256 over raw body

Webhook authenticity is verified by HMAC-SHA256 over the raw request bytes. This requires capturing `req.rawBody` before JSON parsing (done in `main.ts` via the `express.json({ verify })` hook). Timing-safe comparison via `crypto.timingSafeEqual`.

Secrets are per-provider env vars. The guard resolves the secret based on the `:provider` route param, which means adding a new provider requires adding a new env var entry — an intentional friction that forces secret management through config, not code.

### 6. Observability is mandatory, not optional

- **Logs**: pino with `redact` on `authorization`, `x-api-key`, `x-signature` headers. Structured JSON in production, pretty in dev.
- **Metrics**: prom-client default metrics plus domain counters (`webhooks_received_total{provider,outcome}`, `transactions_persisted_total{provider}`, `circuit_breaker_state{provider}`).
- **Health**: shallow DB probe. Separating liveness from readiness would be a follow-up.
- **API docs**: Swagger mounted at `/docs` automatically from NestJS decorators.

## Risks / Trade-offs

- **SQLite for prod-like demos**: the volume binding in docker-compose persists the DB, but SQLite is not the right choice for concurrent writers. `DATABASE_URL` is designed to be swappable to Postgres without code changes.
- **In-memory queue loses in-flight work on crash**: mitigated by provider retries + idempotency, but not equivalent to a persistent queue. Documented.
- **No request-level auth on query endpoints yet**: an API key is accepted via Swagger but not enforced as a global guard in this bloc. Enforcement would be a one-line guard registration — deferred only to preserve velocity for the core integration work.
- **Adapter coupling to Prisma types**: adapters return plain canonical objects, then a persistence service writes them via Prisma. This keeps adapters testable in isolation but adds one indirection.

## Migration Plan

Not applicable — this is a first delivery. Future changes would add new providers as additive `ADDED Requirements` deltas under the `transaction-normalization` capability.

## Open Questions

- Policy for conflicting state from the same `external_id` (e.g., provider resends with a different `status`): current behavior is last-write-wins on `receivedAt`. Should be an explicit product decision.
- Clock skew tolerance for HMAC: currently no timestamp check on the webhook. A replay window would harden this.
