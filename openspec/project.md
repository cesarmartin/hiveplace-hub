# HIVEPlace Integration Hub — Project Context

## Purpose

Receive heterogeneous webhook events from multiple Open Finance-style providers, normalize them into a canonical transaction model, persist them, and expose a unified internal API for downstream consumers.

This is a technical challenge submission oriented toward the "Integrations" profile: the focus is resilience, idempotency, observability, and clean separation between external provider contracts and the canonical model.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript 5.3
- **Framework**: NestJS 10
- **Persistence**: SQLite via Prisma 5 (swappable to PostgreSQL via `DATABASE_URL`)
- **Observability**: pino (structured logs), prom-client (Prometheus metrics), Swagger/OpenAPI
- **Resilience**: opossum (circuit breaker), custom retry with exponential backoff
- **Packaging**: Docker, docker-compose
- **Testing**: Jest + supertest

## Architecture Principles

- **Adapter pattern** per provider. Each provider gets its own module implementing a shared `ProviderAdapter` interface that converts provider-specific payloads into canonical `Transaction` records.
- **Canonical model** is the single source of truth inside the hub. External field names, units, and enums never leak past the adapter boundary.
- **Idempotency** is enforced at the webhook ingress using `(provider, external_id)` as the dedupe key, backed by a DB UNIQUE constraint.
- **Async processing**: webhooks ack with 202 fast-path; normalization and persistence happen off the request hot path in an in-memory queue worker (trade-off — see `DECISIONS.md`).
- **Resilience per external call**: every outbound call to a provider goes through a circuit breaker + timeout + bounded retry with jitter.
- **Observability is first-class**, not an afterthought. Structured logs with header redaction, Prometheus counters on every domain event, health check with DB probe.

## Project Conventions

- Secrets are loaded from environment variables; no secrets in code or logs.
- Sensitive headers (`authorization`, `x-api-key`, `x-signature`) are redacted by pino at the transport level.
- HTTP handlers are thin — they delegate to services. No business logic in controllers.
- Provider-specific code lives under `src/providers/<name>/` and is the only place that knows provider-native field names.
- The canonical `Transaction` type is defined once and reused across persistence, API, and tests.
- DTOs are validated with `class-validator`; invalid payloads are rejected with 400 (except webhooks, which still ack 202 to avoid retry storms, and log for investigation).

## Scope Boundaries

- **In scope**: 2 providers (pluggy, belvo) with deliberately divergent contracts; webhook push + sync pull; canonical API; resilience; observability.
- **Out of scope** (documented in `DECISIONS.md`): frontend UI, multi-tenant, OAuth2/mTLS, distributed tracing, persistent queue (RabbitMQ/BullMQ).

## Related Documents

- `README.md` — quick start and architecture diagram
- `DECISIONS.md` — trade-offs, what was cut, what I'd do with more time
