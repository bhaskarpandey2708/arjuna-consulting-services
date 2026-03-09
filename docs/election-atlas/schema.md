# Election Atlas Schema

This Arjuna section is currently powered by a seeded Bihar prototype, but the schema is shaped to absorb real state, district, constituency, and later booth data without changing the UI contract.

## Current storage shape

- `data/election-atlas/bihar.seed.js`
  Seed dataset for the embedded Election Atlas prototype.
- `data/raw/indiavotes/`
  Timestamped raw captures from IndiaVotes helper and discovery surfaces.
- `data/raw/lokdhaba/`
  Timestamped raw captures from LokDhaba inventory and probe attempts.
- `data/staging/election-atlas/bihar-bootstrap.json`
  Normalized Bihar discovery bootstrap used to surface pipeline status in the embedded UI.
- `data/staging/election-atlas/state-catalog.json`
  Normalized all-states catalog used to understand national source coverage and geography-version inventory.
- `src/election-atlas-store.js`
  Query layer for filtering, normalization, and API responses.
- `src/election-atlas.js`
  Page builder that consumes the store and renders the route shell.

## Core dimensions

### `dim_state`

- `slug`
- `name`
- `description`
- `default_house`
- `default_year_by_house`

### `dim_geography_version`

- `id`
- `state`
- `label`
- `short_label`
- `valid_from_year`
- `valid_to_year`
- `notes`

Purpose:
Keep pre-split and post-split state interpretations explicit from day one. Bihar before and after the Jharkhand separation is the first proof case.

### Future dimensions not yet materialized as separate files

- `dim_district`
- `dim_constituency`
- `dim_party`
- `dim_candidate`
- `dim_election`

These will be split out once live ingestion begins.

## Current facts

### `fact_state_election_summary`

Grain:
`state + house + year + geography_version`

Fields:

- `totalSeats`
- `turnoutPct`
- `winnerParty`
- `winnerSeats`
- `winnerSeatShare`
- `winnerVoteShare`
- `closeContests`
- `meanMarginPct`
- `medianMarginPct`
- `swingPoints`
- `fragmentationIndex`

### `fact_party_state_trend`

Grain:
`state + house + year + party`

Fields:

- `seats`
- `seatShare`
- `voteShare`

Purpose:
Drive seat-share and vote-share historical charts without recomputing grouped views in the browser.

### `fact_constituency_summary`

Grain:
`state + house + year + constituency`

Fields:

- `district`
- `winner`
- `winnerParty`
- `runnerUp`
- `runnerUpParty`
- `marginVotes`
- `marginPct`
- `turnoutPct`
- `winnerVoteShare`

Purpose:
Provide the first drilldown layer for the state page while keeping district attribution available for later aggregation.

## Planned next tables

### `fact_district_election_summary`

Grain:
`state + district + house + year + geography_version`

Use:
District concentration, leaderboard, spread, and close-contest summaries.

### `fact_candidate_result`

Grain:
`state + constituency + house + year + candidate`

Use:
Full candidate tables, vote totals, margins, and alias reconciliation.

### `fact_booth_result`

Deferred:
Prepared later once AC-to-booth linkage and validation rules are defined.

## Mapping layers required for live ingestion

- `party_alias_map`
- `candidate_alias_map`
- `constituency_name_map`
- `state_split_map`
- `source_crosswalk`

Current note:
`source_crosswalk` is now materialized in `config/election-atlas/source-crosswalk.json`.
The remaining mapping layers are still pending and become mandatory before constituency-level marts are treated as stable.

## Discovery bootstrap schema

The first normalized staging artifact is `data/staging/election-atlas/bihar-bootstrap.json`.

Purpose:

- record the latest raw capture directories
- normalize Bihar geography-version crosswalks
- normalize discovered IndiaVotes Assembly year ids
- normalize Bihar district lookup rows
- preserve LokDhaba probe state for adapter follow-through

Top-level fields:

- `state`
- `normalizedAt`
- `crosswalkVersion`
- `indiavotes`
- `lokdhaba`
- `pipeline`

## National catalog schema

The all-states catalog artifact is `data/staging/election-atlas/state-catalog.json`.

Purpose:

- inventory all discovered state versions exposed by IndiaVotes
- normalize current versus historic entities
- record Assembly year coverage by state version
- record latest usable district inventory by state version

Top-level fields:

- `generatedAt`
- `source`
- `sourceCaptureDirectory`
- `sourceCapturedAt`
- `normalizationVersion`
- `stats`
- `globalElectionYears`
- `canonicalStates`
- `stateVersions`
