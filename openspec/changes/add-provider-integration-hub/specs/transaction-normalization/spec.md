# Transaction Normalization

## ADDED Requirements

### Requirement: Canonical Transaction Model

The system SHALL define a single canonical `Transaction` shape used by persistence, internal API, and tests. Provider-specific field names, units, and enum values MUST NOT leak past the adapter boundary.

The canonical fields are:

- `id`: internal UUID
- `externalId`: provider-side identifier used for deduplication
- `provider`: provider discriminator (e.g., `pluggy`, `belvo`)
- `accountId`: account identifier within the provider
- `amountCents`: signed integer in cents of the transaction currency
- `currency`: ISO 4217 code (e.g., `BRL`, `USD`)
- `type`: enum `"CREDIT" | "DEBIT"`
- `status`: enum `"PENDING" | "POSTED" | "FAILED"`
- `occurredAt`: ISO-8601 timestamp of when the transaction occurred
- `receivedAt`: ISO-8601 timestamp of when the hub persisted it
- `rawPayload`: the original provider payload preserved verbatim as JSON string

#### Scenario: Canonical shape is stable across providers

- **GIVEN** a webhook from `pluggy` and a webhook from `belvo` for equivalent economic events
- **WHEN** both are normalized and persisted
- **THEN** the resulting rows have identical field names, types, and enum values
- **AND** the only differing field is `provider` and the values that legitimately differ (ids, amounts)

### Requirement: Provider Adapter Interface

The system SHALL expose a `ProviderAdapter` interface with a single method `normalize(raw: unknown): CanonicalTransaction`. One adapter SHALL exist per registered provider.

#### Scenario: Adapter is selected by provider discriminator

- **GIVEN** an event tagged with provider `belvo`
- **WHEN** the worker looks up the adapter
- **THEN** it receives the `BelvoAdapter` instance
- **AND** no other adapter is invoked

### Requirement: Pluggy Payload Mapping

The system SHALL translate Pluggy-style payloads according to the following rules:

- `eventId` → `externalId`
- `accountId` → `accountId`
- `amount` (string with decimal point) → `amountCents` (integer multiplied by 100, rounded to nearest cent)
- `currency` → `currency`
- `type` (`"CREDIT"` or `"DEBIT"`) → `type` (passthrough)
- `status` (`"PENDING" | "POSTED" | "FAILED"`) → `status` (passthrough)
- `occurredAt` (ISO-8601 string) → `occurredAt` (parsed)

#### Scenario: Decimal string amount is converted to cents

- **GIVEN** a Pluggy payload with `amount: "123.45"`
- **WHEN** the adapter normalizes it
- **THEN** the canonical `amountCents` is `12345`

#### Scenario: Fractional sub-cent amounts round to nearest cent

- **GIVEN** a Pluggy payload with `amount: "10.005"`
- **WHEN** the adapter normalizes it
- **THEN** the canonical `amountCents` is `1001` (banker's rounding or nearest-cent, documented in adapter)

### Requirement: Belvo Payload Mapping

The system SHALL translate Belvo-style payloads according to the following rules:

- `notification_id` → `externalId`
- `account_id` → `accountId`
- `amount_cents` (integer) → `amountCents` (passthrough)
- `currency_code` → `currency`
- `transaction_type` (numeric: `1` → `CREDIT`, `2` → `DEBIT`) → `type`
- `status_code` (numeric: `0` → `PENDING`, `1` → `POSTED`, `2` → `FAILED`) → `status`
- `occurred_at_epoch` (Unix epoch seconds) → `occurredAt` (ISO-8601)

#### Scenario: Numeric transaction type maps to canonical string

- **GIVEN** a Belvo payload with `transaction_type: 1`
- **WHEN** the adapter normalizes it
- **THEN** the canonical `type` is `"CREDIT"`

#### Scenario: Epoch timestamp is converted to ISO-8601

- **GIVEN** a Belvo payload with `occurred_at_epoch: 1713787200`
- **WHEN** the adapter normalizes it
- **THEN** the canonical `occurredAt` equals `"2024-04-22T12:00:00Z"`

#### Scenario: Unknown status code surfaces as an explicit error

- **GIVEN** a Belvo payload with `status_code: 99`
- **WHEN** the adapter attempts normalization
- **THEN** normalization fails with a `NormalizationError` naming the unmapped code
- **AND** the original payload is preserved for later manual reprocessing

### Requirement: Raw Payload Retention

The system SHALL persist the complete original provider payload alongside the canonical row, so that future schema changes can be reprocessed without re-fetching from the provider.

#### Scenario: rawPayload is stored verbatim

- **GIVEN** a normalized transaction about to be persisted
- **WHEN** the persistence service writes the row
- **THEN** the `rawPayload` column contains the original JSON exactly as received

### Requirement: Async Normalization Worker

The system SHALL process accepted webhooks asynchronously via an in-memory queue and a single consumer. Accepted webhooks that fail to normalize SHALL NOT leave orphan idempotency keys.

#### Scenario: Failed normalization releases the idempotency key

- **GIVEN** a webhook was accepted and `(pluggy, evt-42)` was reserved in the idempotency ledger
- **WHEN** the adapter throws `NormalizationError` during worker processing
- **THEN** the idempotency key for `(pluggy, evt-42)` is released
- **AND** a subsequent valid retry with the same event id can be processed
- **AND** an error log is emitted with the provider, event id, and error class
