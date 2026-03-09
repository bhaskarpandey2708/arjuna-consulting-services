# Election Atlas Roadmap

This roadmap reflects the current live baseline inside the Arjuna shell, not the earlier Bihar-only prototype.

## Live baseline as of March 9, 2026

- 84 staged IndiaVotes result slices across 35 selection-ready states
- 817 normalized LokDhaba slices across 38 states/entities
- 363 Assembly district mart slices across 34 states/entities
- 5,196 constituency rows with vote share and 5,192 with runner-up parity
- overlap reporting now distinguishes source coverage gaps, electorate-base turnout variance, and total-vote denominator variance
- the staged hard-conflict queue is now cleared through explicit seat adjudications, with remaining overlap noise confined to source variance and coverage-gap reporting
- local-only constituency and district detail routes are already live
- canonical overview ordering is already live
- LokDhaba is primary wherever staged, with IndiaVotes only filling gaps
- `LS` district intelligence is intentionally out of scope for v1, and the `LS` overview hides that section entirely

## Completed tranches

### 1. Discovery and all-states inventory

Status:
Complete

Delivered:

- Bihar bootstrap capture and normalization
- IndiaVotes all-states catalog and canonical state inventory
- staged route and source contracts for the embedded atlas

### 2. Live extraction and local drilldown

Status:
Complete

Delivered:

- current-state IndiaVotes constituency-result extraction
- local constituency detail capture and local-only detail routes
- internal atlas routes for overview, constituency, and district pages
- same-tab navigation with shareable URLs and browser-back support

### 3. LokDhaba normalization and district marts

Status:
Complete

Delivered:

- normalized LokDhaba slice inventory across 38 states/entities
- Assembly district marts across 34 states/entities
- LokDhaba-first source precedence with IndiaVotes backfill only where needed

### 4. Mart-backed summary and trend layer

Status:
Complete

Delivered:

- `state-summary-marts.json`
- `party-trend-marts.json`
- `constituency-detail-index.json`
- store preference for staged marts on covered slices

### 5. Canonical normalization and discrepancy layer

Status:
Complete

Delivered:

- `party-alias-map.json`
- `constituency-name-map.json`
- `candidate-alias-map.json`
- `discrepancy-report.json`
- internal discrepancy API

## Active roadmap

### 6. Historical completeness and alliance coverage

Status:
In progress

Scope:

- extend IndiaVotes detail enrichment beyond the latest/current tranche
- widen alliance extraction where the source exposes usable coalition blocks
- keep unavailable alliance layers explicitly unavailable rather than inferred

Exit criteria:

- broader historical slices have local candidate detail parity
- coalition layers are sourced or explicitly labeled as unavailable

### 7. Production hardening

Status:
Next

Scope:

- finalize freshness metadata across atlas responses
- tighten portal-safe failure states and release behavior
- document repeatable refresh flow and release checklist

Exit criteria:

- refresh process is repeatable without manual debugging
- environment-aware behavior is documented
- release checklist exists for the portal launch path

## Immediate next sequence

1. widen historical candidate-detail coverage beyond the current/latest tranche
2. expand alliance coverage only where source blocks exist
3. finish portal hardening and release checklist
4. keep adding explicit adjudications only when a true source conflict survives normalization
