# Transaction Query

## ADDED Requirements

### Requirement: Paginated Transaction List

The system SHALL expose `GET /transactions` returning canonical transactions with cursor-based pagination and optional filters.

Supported filters:
- `provider` (string, optional)
- `status` (enum `PENDING | POSTED | FAILED`, optional)
- `accountId` (string, optional)
- `cursor` (opaque string, optional)
- `limit` (integer, default 50, max 200)

The response SHALL include `items` and a `nextCursor` field (null when there are no more pages).

#### Scenario: List without filters returns paginated results

- **GIVEN** 120 transactions exist in the canonical store
- **WHEN** `GET /transactions?limit=50` is called
- **THEN** the response has 50 items and a non-null `nextCursor`
- **AND** following the cursor returns the next 50 items

#### Scenario: Filter by status returns only matching rows

- **GIVEN** transactions exist with each status value
- **WHEN** `GET /transactions?status=POSTED` is called
- **THEN** every returned item has `status: "POSTED"`

#### Scenario: Invalid status value is rejected

- **WHEN** `GET /transactions?status=DONE` is called
- **THEN** the response status is `400 Bad Request`
- **AND** the response body names the invalid field and the allowed values

### Requirement: Transaction Detail Lookup

The system SHALL expose `GET /transactions/:id` returning the canonical row, including the preserved `rawPayload`.

#### Scenario: Known id returns the row

- **GIVEN** a transaction with id `uuid-abc` exists
- **WHEN** `GET /transactions/uuid-abc` is called
- **THEN** the response status is `200 OK`
- **AND** the body contains all canonical fields and `rawPayload`

#### Scenario: Unknown id returns 404

- **WHEN** `GET /transactions/uuid-does-not-exist` is called
- **THEN** the response status is `404 Not Found`

### Requirement: Stable Ordering

The system SHALL order list results by `occurredAt DESC, id DESC` so that pagination cursors remain stable across requests.

#### Scenario: Consistent order under repeated reads

- **GIVEN** no new writes occur between requests
- **WHEN** the same `GET /transactions` query is issued twice
- **THEN** the two responses return the same items in the same order

### Requirement: API Documentation

The system SHALL mount Swagger UI at `/docs` describing every query endpoint, including parameters, response shapes, example payloads, and the API key security scheme.

#### Scenario: Swagger lists query endpoints

- **WHEN** an operator opens `/docs`
- **THEN** the UI lists `GET /transactions`, `GET /transactions/:id`, and their parameter schemas

### Requirement: Observability for Queries

The system SHALL log every query request at `info` level with `{method, path, durationMs, resultCount}` and SHALL NOT include any row payload data at info level.

#### Scenario: Query logs do not leak PII

- **WHEN** `GET /transactions?accountId=acc-123` is called
- **THEN** the log entry records `accountId=acc-123` but does not record the returned amounts or external ids at info level
