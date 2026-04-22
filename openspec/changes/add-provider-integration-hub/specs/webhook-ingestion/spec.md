# Webhook Ingestion

## ADDED Requirements

### Requirement: Per-Provider Webhook Endpoint

The system SHALL expose a webhook endpoint at `POST /webhooks/:provider` where `:provider` identifies the originating external system. Each registered provider has its own route parameter value and its own HMAC secret.

#### Scenario: Accepted provider routes to handler

- **GIVEN** a provider `pluggy` is registered with a known webhook secret
- **WHEN** a `POST /webhooks/pluggy` arrives with a valid signature
- **THEN** the request is handed to the webhook handler for `pluggy`
- **AND** the response status is `202 Accepted`

#### Scenario: Unknown provider is rejected

- **GIVEN** no provider named `acme` is registered
- **WHEN** a `POST /webhooks/acme` arrives
- **THEN** the response status is `401 Unauthorized`
- **AND** the response body does not disclose which providers exist

### Requirement: HMAC-SHA256 Authenticity Check

The system SHALL verify every webhook request by computing HMAC-SHA256 over the raw request body using the provider-specific secret, and comparing it in constant time to the `x-signature` header value (format `sha256=<hex>`).

#### Scenario: Valid signature is accepted

- **GIVEN** a webhook body `B` and the matching secret `S`
- **WHEN** the request arrives with `x-signature: sha256=<hmac-sha256(S, B)>`
- **THEN** the request passes the authenticity check
- **AND** processing continues to idempotency

#### Scenario: Missing signature is rejected

- **WHEN** a webhook arrives without an `x-signature` header
- **THEN** the response status is `401 Unauthorized`
- **AND** no work is enqueued

#### Scenario: Tampered body is rejected

- **GIVEN** a request whose body was modified after signing
- **WHEN** the signature no longer matches the body
- **THEN** the response status is `401 Unauthorized`

#### Scenario: Signature comparison is timing-safe

- **WHEN** the received signature and the expected signature are compared
- **THEN** the comparison uses a constant-time function to prevent timing oracle attacks

### Requirement: Idempotent Webhook Processing

The system SHALL process each `(provider, external_id)` pair at most once. Duplicate deliveries SHALL be acknowledged but not reprocessed.

#### Scenario: First delivery is processed

- **GIVEN** no record exists for `(pluggy, evt-42)`
- **WHEN** a valid webhook with event id `evt-42` arrives
- **THEN** the event is accepted and enqueued for normalization
- **AND** the response body contains `{"status":"accepted","eventId":"evt-42"}`

#### Scenario: Duplicate delivery is ignored

- **GIVEN** `(pluggy, evt-42)` was already processed
- **WHEN** a second valid webhook with event id `evt-42` arrives
- **THEN** the response status is `202 Accepted`
- **AND** the response body contains `{"duplicate": true}`
- **AND** no new `Transaction` row is created

#### Scenario: Missing event id still acknowledges

- **WHEN** a webhook body does not contain a recognizable event id field
- **THEN** the response status is `202 Accepted`
- **AND** a structured warning log is emitted with the provider name
- **AND** the `webhooks_received_total{provider,outcome="missing_id"}` counter is incremented

### Requirement: Fast-Path Acknowledgement

The system SHALL respond to webhook deliveries with `202 Accepted` within a target of 50 ms at the p99 for in-process work (HMAC + idempotency reserve), deferring heavier work to an asynchronous worker.

#### Scenario: Heavy work does not block the response

- **WHEN** a webhook is accepted and enqueued
- **THEN** the HTTP response is returned before adapter translation and DB persistence complete

### Requirement: Safe Logging of Webhook Traffic

The system SHALL redact sensitive headers (`authorization`, `x-api-key`, `x-signature`) from all log output. The system SHALL NOT log raw webhook bodies at the `info` level or below.

#### Scenario: Signature header never appears in logs

- **WHEN** any webhook request is logged
- **THEN** the `x-signature` header value is replaced with `[REDACTED]`

### Requirement: Webhook Observability

The system SHALL increment `webhooks_received_total{provider,outcome}` on every webhook request, with `outcome ∈ {queued, duplicate, missing_id, invalid_signature}`.

#### Scenario: Metrics reflect ingestion outcomes

- **WHEN** 10 webhooks arrive: 7 new, 2 duplicates, 1 with bad signature
- **THEN** the counters show `outcome="queued"` = 7, `outcome="duplicate"` = 2, `outcome="invalid_signature"` = 1
