# Election Atlas Source Contracts

This document defines how the embedded Election Atlas section should approach live ingestion once the UI direction is approved.

## Source priority

### Tier 1: TCPD / LokDhaba

Use as the primary historical source for general election and assembly election structures.

Expected use:

- election metadata
- constituency result tables
- state-level historical coverage
- structured exports or discoverable API/network payloads

Rule:
Inspect network/API surfaces first. Do not begin with HTML scraping if a structured payload exists.

### Tier 2: IndiaVotes

Use as a fallback and comparison source for:

- summary views
- state pages
- election pages
- constituency pages
- legacy geography edge cases

Rule:
Treat this as a cross-check and gap-filler, not the first truth layer.

### Tier 3: Official validation

Use ECI statistical reports or equivalent official releases when Tier 1 and Tier 2 disagree.

Rule:
If the same seat-year-house combination differs between sources, the discrepancy must be logged before the mart is considered publishable.

## Ingestion order

1. Discover route patterns and payloads.
2. Save raw source payloads with timestamps and source metadata.
3. Parse into staging tables.
4. Normalize names and geography versions.
5. Materialize marts.
6. Expose marts through API.
7. Render UI from canonical marts only.

## Raw storage expectations

Future raw files should live under a source-oriented structure such as:

- `data/raw/lokdhaba/`
- `data/raw/indiavotes/`
- `data/raw/eci/`

Each raw capture should record:

- source name
- fetch timestamp
- source URL
- route type
- state
- house
- year
- parser version

## Normalization contracts

Before a row is admitted into a canonical mart, these mappings must exist or be explicitly waived:

- party alias mapping
- constituency name mapping
- state split mapping
- source crosswalk key

## QA gates for publishable marts

At minimum:

- winner seat counts sum to expected seat totals
- vote shares stay within valid numeric bounds
- no duplicate `state + house + year + constituency` rows
- missing district or geography-version assignments are flagged
- source disagreements are logged

## Current implementation state

The Arjuna site currently uses:

- seeded Bihar state summary facts
- seeded party trend facts
- seeded constituency sample facts
- raw source capture folders under `data/raw/`
- a normalized Bihar discovery bootstrap under `data/staging/election-atlas/`

That is still intentional. The visible election numbers remain seeded while the first live-source layer is brought in carefully under the same route and API surface.
