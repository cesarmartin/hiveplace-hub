# OpenCode Agent Guidance for HIVEPlace Integration Hub

## Core Architecture

- **Purpose**: Webhook integration hub normalizing transactions from multiple providers
- **Key Constraint**: Focused MVP prioritizing resilience and clear separation of concerns

## Critical Commands

### Setup
```bash
# Always generate Prisma types before testing
npm run prisma:generate

# Run tests
npm run test
```

### Development & Testing
```bash
# Boot entire system with mocks
docker compose up --build

# Quick test webhook emissions
curl http://localhost:4001/__emit/acc-123  # Pluggy mock
curl http://localhost:4002/__emit/acc-456  # Belvo mock
```

## Architectural Quirks

### Webhook Handling
- **Verification**: HMAC-SHA256 on raw body
- **Idempotency**: DB-backed deduplication
- **Response**: Fast 202 Accepted path

### Provider Adapters
- Deliberately divergent input contracts (camelCase vs snake_case)
- Normalize to canonical transaction model
- Expect provider-specific transformations

## Observability

- Metrics: Prometheus-compatible at `/metrics`
- Health: Readiness check at `/health`
- Logs: Structured pino logs with sensitive header redaction

## Testing Considerations

- Unit and integration test suites exist
- Mocks simulate different provider contracts
- Verify idempotency and HMAC verification in tests

## Environment & Deployment

- Runtime: Node.js 20 + TypeScript
- Framework: NestJS
- Persistence: SQLite (Prisma, swappable to Postgres)
- Packaging: Docker + docker-compose

## References

- `DECISIONS.md`: Trade-offs and future improvements
- Swagger UI: `http://localhost:3000/docs` for API exploration
