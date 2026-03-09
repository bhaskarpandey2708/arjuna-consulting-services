# Election Atlas Discovery Log

Last reviewed: 2026-03-09

## Bihar bootstrap findings

### IndiaVotes

- `https://www.indiavotes.com/home/advanced_search` exposes the state and route surface needed for bootstrap discovery.
- Bihar appears as split geography entries:
  - `Bihar [1947 - 1999]` with state id `2`
  - `Bihar [2000 Onwards]` with state id `58`
- Helper endpoints confirmed for Assembly discovery:
  - `POST /home/GetyearacAjaxhome_dist/{stateId}`
  - `POST /home/Get_dist_ac/{stateId}/{electionId}`
- Bihar post-2000 Assembly lookup currently exposes years including `2025`, `2020`, `2015`, and `2010`.

### LokDhaba

- Public repo and frontend bundle confirm an API base at `https://lokdhaba.ashoka.edu.in/api`.
- Endpoint inventory captured from the public bundle includes:
  - `/data/api/v1.0/getSearchResults`
  - `/data/api/v1.0/getVizData`
  - `/data/api/v1.0/getVizLegend`
  - `/data/api/v1.0/getMapYear`
  - `/data/api/v1.0/getMapYearParty`
  - `/data/api/v2.0/getDerivedData`
- The current Bihar search probe is expected to be recorded exactly as observed instead of being silently retried or hidden if the endpoint returns `502`.

## Current delivery boundary

- The visible Bihar election metrics on `/election-atlas` are still seeded.
- The source layer now supports timestamped raw capture and a normalized Bihar discovery bootstrap.
- Constituency-result extraction and alias normalization are still pending.

## Immediate next move

1. Capture Bihar constituency result surfaces from IndiaVotes for one Assembly cycle and one Lok Sabha cycle.
2. Define the first `party_alias_map` and `constituency_name_map`.
3. Materialize a canonical `staging_results` table for Bihar before touching more UI.
