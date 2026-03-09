# Arjuna Strategy Consulting

Standalone Express.js website for Arjuna Strategy Consulting with:

- an Express.js application server
- a responsive single-page marketing site
- an embedded `Election Atlas` beta route for state-level election intelligence review
- a working `POST /api/contact` endpoint
- local persistence for consultation requests in `data/inquiries.json`

## Run locally

```bash
cd /Users/bhaskar_pandey/Documents/Website/arjuna-consulting-services
npm start
```

The site will start on `http://127.0.0.1:3000` by default.

To use a different port:

```bash
PORT=4000 npm start
```

For production SEO and canonical URLs, set:

```bash
SITE_URL=https://your-production-domain.com npm start
```

If `SITE_URL` is not set, the app falls back to the request origin and emits `noindex` metadata so preview and local environments are not indexed.

For production contact handling, you can also set:

```bash
CONTACT_WEBHOOK_URL=https://your-crm-or-form-endpoint.example.com
DISABLE_LOCAL_INQUIRY_STORE=true
```

If `CONTACT_WEBHOOK_URL` is set, each valid contact submission is POSTed to that endpoint as JSON. If `DISABLE_LOCAL_INQUIRY_STORE=true`, the app requires `CONTACT_WEBHOOK_URL` so submissions still have a delivery target.

## SEO endpoints

- `GET /robots.txt`
- `GET /sitemap.xml`
- `GET /llms.txt`

## Election Atlas beta

The site now includes an embedded review route:

- `GET /election-atlas`
- `GET /election-atlas/:state/:house/:year`
- `GET /election-atlas/:state/:house/:year/constituency/:seatNumber-:slug`
- `GET /election-atlas/:state/:house/:year/district/:districtSlug` for `VS` only

Local JSON endpoints for the beta:

- `GET /api/election-atlas/states`
- `GET /api/election-atlas/pipeline`
- `GET /api/election-atlas/catalog`
- `GET /api/election-atlas/staged-results?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/elections?state=bihar&house=VS`
- `GET /api/election-atlas/state-summary?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/state-summary-mart?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/party-trend?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/constituencies?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/constituency-detail?state=bihar&house=VS&year=2020&seat=1`
- `GET /api/election-atlas/district-detail?state=bihar&house=VS&year=2020&slug=araria`
- `GET /api/election-atlas/districts?state=bihar&house=VS&year=2020`
- `GET /api/election-atlas/discrepancies?state=bihar&house=VS&year=2020`

Current status:

- the atlas serves 562 staged IndiaVotes result slices across 36 selection-ready state surfaces
- the latest IndiaVotes batch manifest is 581 completed jobs, 132 skipped, 0 failed
- normalized LokDhaba coverage now spans 817 slices across 38 states/entities
- Assembly district marts are staged from LokDhaba candidate-level rows for 34 states/entities and 363 slices
- detail enrichment is staged across 587 completed files, with 20,985 constituency rows carrying vote share in the live pipeline layer
- state-summary marts, party-trend marts, constituency-detail index, and discrepancy reporting are now staged artifacts
- state-summary responses now carry advanced metric bundles derived from staged constituency rows, including `ENOP`, reservation mix, turnout spread, and low-plurality pressure
- LokDhaba is primary wherever staged; IndiaVotes only fills gaps or local-only drilldown fields
- seeded Bihar facts remain fallback only where neither live source layer is available
- overview and deep-link routes now expose launch-status strips for source priority, mart backing, freshness, and fallback or coverage caveats
- staged hard conflicts are cleared from the overlap layer; remaining discrepancy reporting is variance and coverage-gap visibility, not a blocker queue
- atlas HTML routes now revalidate on a short 60-second cache window; APIs remain `no-store`
- it is embedded in the existing Arjuna site shell
- live-source discovery and normalization are wired through `data/raw/` and `data/staging/`
- current staged coverage passes `atlas:qa:results`
- `LS` district intelligence is intentionally out of scope for v1, so the `LS` overview hides the district section entirely

Documentation:

- `docs/election-atlas/schema.md`
- `docs/election-atlas/metric-definitions.md`
- `docs/election-atlas/source-contracts.md`
- `docs/election-atlas/discovery-log.md`
- `docs/election-atlas/roadmap.md`
- `docs/election-atlas/production-plan.md`

Extraction and normalization scripts:

- `npm run atlas:extract:indiavotes`
- `npm run atlas:extract:indiavotes:catalog`
- `npm run atlas:extract:indiavotes:plan -- --scope current --house both --years latest`
- `npm run atlas:extract:indiavotes:results -- --house VS --year 2020 --election-id 279 --state-id 58 --state-label 'Bihar [2000 Onwards]' --state-slug bihar`
- `npm run atlas:extract:indiavotes:batch -- --scope current --house both --years latest`
- `npm run atlas:index:results`
- `npm run atlas:extract:lokdhaba`
- `npm run atlas:normalize`
- `npm run atlas:normalize:catalog`
- `npm run atlas:build:normalization`
- `npm run atlas:build:discrepancies`
- `npm run atlas:build:review-queue`
- `npm run atlas:build:districts`
- `npm run atlas:build:marts`
- `npm run atlas:qa:results`

Repeatable refresh sequence:

1. `npm run atlas:extract:indiavotes:batch -- --scope current --house both --years latest`
2. `npm run atlas:enrich:indiavotes:details`
3. `npm run atlas:enrich:indiavotes:alliances`
4. `npm run atlas:extract:lokdhaba`
5. `npm run atlas:normalize:lokdhaba`
6. `npm run atlas:build:normalization`
7. `npm run atlas:index:results`
8. `npm run atlas:build:districts`
9. `npm run atlas:build:discrepancies`
10. `npm run atlas:build:review-queue`
11. `npm run atlas:build:marts`
12. `npm run atlas:qa:results`

Portal beta release checklist:

1. Run the repeatable refresh sequence and confirm `data/staging/election-atlas/qa-results.json` has `0` failing files.
2. Confirm `GET /api/health` returns `200`.
3. Confirm one live reconciled slice, for example `GET /api/election-atlas/state-summary?state=bihar&house=VS&year=2020`, returns `summary.quality.statusLabel = "Reconciled beta slice"`.
4. Confirm one deep-link constituency page and one deep-link district page open locally without outbound source navigation.
5. Confirm a seed-only or gap slice surfaces the fallback or coverage banner rather than looking like fully live data.
6. In preview or local environments without `SITE_URL`, confirm `noindex` behavior is still active.
7. In portal production with `SITE_URL` set, confirm canonical URLs, sitemap, and indexable headers behave as expected.

Artifacts land in:

- `data/raw/indiavotes/<timestamp>/`
- `data/raw/lokdhaba/<timestamp>/`
- `data/staging/election-atlas/bihar-bootstrap.json`
- `data/staging/election-atlas/pipeline-status.json`
- `data/staging/election-atlas/state-catalog.json`
- `data/staging/election-atlas/indiavotes-results-plan.json`
- `data/staging/election-atlas/indiavotes-results-manifest.json`
- `data/staging/election-atlas/results/*.json`
- `data/staging/election-atlas/results-index.json`
- `data/staging/election-atlas/state-summary-marts.json`
- `data/staging/election-atlas/party-trend-marts.json`
- `data/staging/election-atlas/constituency-detail-index.json`
- `data/staging/election-atlas/district-marts/*.json`
- `data/staging/election-atlas/district-marts-index.json`
- `data/staging/election-atlas/discrepancy-report.json`
- `data/staging/election-atlas/manual-review-queue.json`
- `data/staging/election-atlas/qa-results.json`
- `config/election-atlas/party-alias-map.json`
- `config/election-atlas/constituency-name-map.json`
- `config/election-atlas/candidate-alias-map.json`
- `config/election-atlas/manual-seat-adjudications.json`

## Project structure

- `server.js`: Express server, routes, API handling, static asset delivery
- `src/site-content.js`: structured content and profile data
- `src/election-atlas-store.js`: atlas query layer over staged live coverage with seed fallback
- `src/election-atlas.js`: atlas route/page builder
- `src/template.js`: HTML rendering
- `public/styles.css`: layout and visual system
- `public/app.js`: reveal animations, contact form submission, and atlas interactions
- `data/election-atlas/bihar.seed.js`: illustrative Bihar dataset for atlas development
- `config/election-atlas/source-crosswalk.json`: source route and geography-version crosswalk
- `config/election-atlas/state-normalization.json`: canonical state-name normalization rules
- `scripts/election-atlas/`: source capture and normalization scripts
- `data/inquiries.json`: locally stored consultation requests
