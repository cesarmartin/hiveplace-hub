# Provider Sync

## ADDED Requirements

### Requirement: On-Demand Account Sync

The system SHALL expose `POST /sync/:accountId?provider=<p>` to pull transactions for an account from a specific provider and merge them into the canonical store.

#### Scenario: Successful sync persists missing transactions

- **GIVEN** account `acc-123` has 3 transactions upstream at Pluggy and 1 already persisted locally
- **WHEN** `POST /sync/acc-123?provider=pluggy` is called
- **THEN** the 2 missing transactions are persisted
- **AND** the existing 1 is not duplicated
- **AND** the response summarizes `{fetched: 3, inserted: 2, duplicates: 1}`

### Requirement: Sync Reuses the Webhook Idempotency Path

The system SHALL deduplicate pulled transactions using the same `(provider, externalId)` key path as webhook ingestion, so that push and pull deliveries cannot produce duplicates regardless of interleaving.

#### Scenario: Webhook arrives after sync for the same event

- **GIVEN** `(belvo, evt-99)` was just persisted via `POST /sync/...`
- **WHEN** a webhook for `(belvo, evt-99)` arrives afterward
- **THEN** the webhook is acknowledged as duplicate
- **AND** no second row is created

### Requirement: Per-Provider HTTP Client with Timeout and Retry

The system SHALL make each outbound call to a provider with a bounded timeout (default 5s) and up to 3 retry attempts using exponential backoff with jitter.

#### Scenario: Transient failure is retried

- **GIVEN** the Pluggy mock returns `503` on the first attempt and `200` on the second
- **WHEN** the hub calls the Pluggy endpoint
- **THEN** the second attempt succeeds
- **AND** a log entry records the retried status code

#### Scenario: Retry budget is bounded

- **GIVEN** the provider returns `500` on every attempt
- **WHEN** the hub attempts the call
- **THEN** after 3 attempts the error is surfaced to the caller
- **AND** no additional attempts are made

### Requirement: Per-Provider Circuit Breaker

The system SHALL wrap each provider client in an independent circuit breaker (`opossum`) configured per provider. Circuit state for one provider SHALL NOT influence another provider.

#### Scenario: Breaker opens after error threshold

- **GIVEN** the configured error threshold is `50%` over a rolling window of `10s`
- **WHEN** the Pluggy client records 5 consecutive failures within the window
- **THEN** the breaker for Pluggy transitions from `closed` to `open`
- **AND** subsequent calls to Pluggy fail fast without hitting the network
- **AND** a log entry records the state transition

#### Scenario: Breaker isolates per-provider failure

- **GIVEN** Pluggy's breaker is `open`
- **WHEN** a sync is requested for Belvo
- **THEN** the Belvo call proceeds normally
- **AND** Belvo's breaker state is unaffected

#### Scenario: Breaker recovers via half-open probe

- **GIVEN** the Pluggy breaker has been `open` for longer than the sleep window
- **WHEN** the next call arrives
- **THEN** the breaker transitions to `half-open` and allows a single probe request
- **AND** on probe success the breaker returns to `closed`
- **AND** on probe failure the breaker returns to `open`

### Requirement: Sync Observability

The system SHALL emit a gauge or counter reflecting circuit breaker state per provider, and SHALL emit structured logs on every state transition with fields `{provider, from, to, reason}`.

#### Scenario: State transitions appear in logs

- **WHEN** any breaker changes state
- **THEN** a single log line at `warn` level is emitted with the provider, previous state, new state, and cause
