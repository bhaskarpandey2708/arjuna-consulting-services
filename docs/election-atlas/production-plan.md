# Election Atlas Production Plan

This is the measured path from the embedded review surface to a production Election Atlas that can support all states, legacy geographies, and later district and booth layers.

## Live readiness clock

If work continues without a major source break, the realistic path is:

- Internal production-ready candidate: March 16, 2026
- Portal preview deployment candidate: March 19, 2026
- Public go-live candidate: March 23, 2026

These are real working dates, not aspirational placeholders. They assume:

- LokDhaba historical downloads remain usable
- IndiaVotes helper routes do not materially change
- no new scope is added beyond state + constituency + district intelligence for v1
- source attribution and production copy are finalized in the last hardening pass

If source instability or data disputes surface during backfill, the likely slip is 3 to 5 days, not multiple weeks.

Current state as of 2026-03-09:

- IndiaVotes all-states catalog is staged and normalized
- staged IndiaVotes constituency extracts now cover 36 selection-ready states and 562 live slices
- the latest IndiaVotes extraction manifest is 581 completed jobs, 132 skipped, 0 failed
- `results-index.json` drives the embedded atlas state inventory and live constituency drilldown
- LokDhaba historical normalization is staged for 38 states/entities and 817 slices
- Assembly district marts are staged for 34 states/entities and 363 slices
- state-summary marts, party-trend marts, constituency-detail index, and discrepancy reporting are now staged artifacts
- visible launch-status strips now expose source priority, mart backing, freshness, and fallback or coverage caveats on overview and deep routes
- overlap reporting now separates source coverage gaps and denominator-driven variance from true hard conflicts
- the staged hard-conflict queue is now cleared through explicit seat adjudications, leaving only softer source variance and coverage-gap reporting in the overlap layer
- `LS` district rollups are intentionally out of scope for v1 rather than deferred work
- the remaining work is historical completeness, alliance coverage expansion, and portal hardening

## Remaining execution sequence

### March 9 to March 11, 2026

Goal:
Freeze the trust layer so the atlas stops behaving like a prototype behind the polished UI.

Deliverables:

- canonical alias artifacts for party, constituency, and candidate labels
- discrepancy reporting across overlapping LokDhaba and IndiaVotes slices
- staged state-summary and party-trend marts
- staged constituency-detail index for local-only drilldown lookup

Exit gate:

- live covered slices render summary and trend surfaces from marts, not seed
- discrepancy report exists as a staged artifact, not console-only output

### March 12 to March 14, 2026

Goal:
Close the biggest remaining completeness gaps before portal hardening starts.

Deliverables:

- historical candidate-detail enrichment where IndiaVotes is still shallow
- runner-up and vote-share completion outside the current/latest tranche
- tighter review of the noisiest discrepancy slices
- alliance extraction coverage expansion only where sources expose usable blocks

Exit gate:

- priority state slices pass atlas QA end to end
- the atlas has no visible dependency on seed data where live source coverage exists

### March 15 to March 16, 2026

Goal:
Freeze the atlas as a production candidate inside the Arjuna shell.

Deliverables:

- portal-safe empty states and error handling
- source freshness metadata in atlas responses
- final review of copy, labels, exports, and coverage notes
- repeatable refresh commands documented in one runbook

Exit gate:

- internal production-ready build
- no blocker bug in `/election-atlas`
- no critical mismatch between visible metrics and staged source data

### March 17 to March 19, 2026

Goal:
Deploy a controlled preview and harden for public traffic.

Deliverables:

- preview deployment in the portal environment
- SEO, sitemap, canonical, and noindex checks by environment
- analytics and event instrumentation
- final content and attribution pass

Exit gate:

- portal preview signoff
- environment variables, health checks, and data refresh commands documented

### March 20 to March 23, 2026

Goal:
Public launch.

Deliverables:

- production deployment
- monitored first refresh run
- launch checklist completion
- post-launch issue queue for district and legacy-entity refinements

Exit gate:

- public route live on the portal
- refresh process repeatable without manual debugging
- first production QA snapshot archived

## Phase 1: National catalog and source inventory

Goal:
Know exactly which state versions, election years, and district surfaces are available before bulk ingestion starts.

Deliverables:

- normalized all-states catalog
- state-version coverage counts
- Assembly year inventory by state version
- latest usable district inventory by state version

Why this comes first:
Without a catalog, bulk scraping creates silent holes and bad assumptions around split states and legacy entities.

## Phase 2: Contracted result extraction

Goal:
Define one stable constituency-result contract per house before scaling.

Deliverables:

- one Bihar Vidhan Sabha extraction slice
- one Bihar Lok Sabha extraction slice
- raw artifacts with parser metadata
- documented field contract for winners, runner-up, party, votes, turnout, and margin

Rule:
No bulk “all states” constituency run until the row contract is stable on both houses.

## Phase 3: Normalization and alias maps

Goal:
Make source labels safe for canonical storage.

Deliverables:

- `party_alias_map`
- `constituency_name_map`
- `candidate_alias_map`
- first discrepancy log

Rule:
Every ambiguous label must map explicitly or be flagged.

## Phase 4: Current-state production batch

Goal:
Move from Bihar to national current-state coverage in batches.

Suggested batch order:

1. Bihar, Uttar Pradesh, Maharashtra, Rajasthan, Madhya Pradesh
2. Karnataka, Gujarat, Tamil Nadu, West Bengal, Odisha
3. Remaining current states and union territories

Why batch:
This gives scale without losing QA control.

## Phase 5: Historical and legacy geography batch

Goal:
Bring in pre-split and historic entities without contaminating modern-state reporting.

Deliverables:

- version-aware canonical marts for:
  - Andhra Pradesh pre/post Telangana
  - Bihar pre/post Jharkhand
  - Madhya Pradesh pre/post Chhattisgarh
  - Uttar Pradesh pre/post Uttarakhand
  - legacy entities exposed by IndiaVotes

## Phase 6: Production marts and UI replacement

Goal:
Retire seed data as real marts become trustworthy.

Replacement order:

1. election table
2. constituency drilldown
3. party trend series
4. state summary KPIs
5. narrative snapshot

Rule:
Only replace a UI surface when its underlying QA gates pass.

## Phase 7: Hardening for production

Goal:
Turn the embedded atlas into a reliable production subsystem inside Arjuna.

Deliverables:

- repeatable extraction commands
- discrepancy reporting
- data freshness metadata
- error-budget handling for fragile sources
- deployment checklist

## Repeatable refresh sequence

1. `npm run atlas:extract:indiavotes:batch -- --scope current --house both --years latest`
2. `npm run atlas:enrich:indiavotes:details`
3. `npm run atlas:enrich:indiavotes:alliances`
4. `npm run atlas:extract:lokdhaba`
5. `npm run atlas:normalize:lokdhaba`
6. `npm run atlas:build:normalization`
7. `npm run atlas:index:results`
8. `npm run atlas:build:districts`
9. `npm run atlas:build:discrepancies`
10. `npm run atlas:build:marts`
11. `npm run atlas:qa:results`

## Portal beta release checklist

1. Run the repeatable refresh sequence and confirm `qa-results.json` reports `0` failing files.
2. Confirm `/api/health` returns `200`.
3. Confirm one reconciled live slice, for example Bihar `VS 2020`, returns `summary.quality.statusLabel = "Reconciled beta slice"`.
4. Confirm one constituency deep link and one district deep link open locally with no outbound IndiaVotes or LokDhaba navigation.
5. Confirm a seed-fallback or coverage-gap slice shows the atlas fallback or coverage banner instead of blending into live coverage.
6. In preview and local environments without `SITE_URL`, confirm `noindex` behavior still holds.
7. In production with `SITE_URL` set, confirm canonical URLs, sitemap, and indexable headers are correct.
8. Confirm the atlas HTML route is revalidating on the short beta cache window and APIs remain `no-store`.

## Core risks

- public helper endpoints may change without warning
- LokDhaba public endpoints can respond with server errors even when route discovery is correct
- historical state labels are not interchangeable with current state names
- bulk ingestion without QA will create misleading political intelligence

## Practical next move

1. Materialize Assembly district marts from LokDhaba candidate rows and keep `GA` for the later Lok Sabha AC-segment bridge.
2. Finish candidate-detail parity on the priority current-state slices so runner-up and vote-share stop degrading to partial coverage.
3. Freeze discrepancy logging and QA gates before the final portal hardening pass.
