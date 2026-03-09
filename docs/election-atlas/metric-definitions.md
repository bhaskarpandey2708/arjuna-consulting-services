# Election Atlas Metric Definitions

These definitions lock the UI language to stable calculations before real-source ingestion begins.

## State overview KPIs

### `total seats`

Definition:
Total number of seats in the selected state, house, year, and geography version.

Important:
This must change when the geography version changes.

### `winner seat share`

Definition:
`winner seats / total seats * 100`

Purpose:
Shows seat conversion strength, which can diverge materially from vote share.

### `winner vote share`

Definition:
Vote share of the top seat-winning party in the selected election.

Purpose:
Used alongside seat share to separate coalition arithmetic from broad support.

### `turnout`

Definition:
Valid turnout percentage for the selected election.

Use:
Signals mobilization intensity and comparability across cycles.

### `close contests`

Prototype definition:
Count of seats under an internal “tight margin” threshold in the selected cycle.

Current note:
In the seeded prototype, this is illustrative.
When live ingestion begins, the threshold must be fixed and documented, for example `< 5 percentage points`.

### `lead over #2`

Definition:
Difference between the selected cycle’s top party seat count and second-ranked party seat count.

Purpose:
Quick pressure read for campaign review.

### `median margin`

Definition:
Median constituency win margin percentage for the selected cycle.

Purpose:
Less sensitive than mean margin to blowout seats.

## Historical metrics

### `seat share trend`

Definition:
Per party:
`party seats / total seats * 100`

Use:
Shows conversion efficiency and coalition capture over time.

### `vote share trend`

Definition:
Per party:
`party votes / total valid votes * 100`

Use:
Shows underlying support movement independent of seat conversion.

### `swing points`

Definition:
Change in the top party’s seat share versus the prior comparable cycle.

Current note:
The seeded prototype stores this directly. In live ingestion it should be derived.

### `fragmentation index`

Definition:
A competition-fragmentation indicator for the selected cycle.

Current note:
The prototype stores this directly as a seeded analytic output.
For live data, the exact formula must be frozen before release.

## LokDhaba source-native metrics now available

These come directly from normalized LokDhaba constituency rows and do not require speculative modelling.

### `ENOP`

Definition:
Effective number of parties for a constituency, as supplied by LokDhaba.

Use:
Signals how fragmented the local contest was, even when the top-two margin looks simple.

### `reservation type`

Definition:
Seat reservation category from the constituency row, usually `GEN`, `SC`, or `ST`.

Use:
Supports reserved-seat mix, turnout by reservation bucket, and representation structure reporting.

### `valid votes`

Definition:
Total valid votes in the constituency row.

Use:
Supports turnout diagnostics, vote-share denominator checks, and custom vote-pressure metrics.

### `electors`

Definition:
Total electors in the constituency row.

Use:
Supports turnout derivation and source-denominator variance checks.

## Advanced state metrics now staged in marts

These are derived from staged constituency rows and are now included in mart-backed live summaries where the source fields exist.

### `mean ENOP`

Definition:
Average constituency `ENOP` across the selected state slice.

Use:
Statewide fragmentation read.

### `median ENOP`

Definition:
Median constituency `ENOP` across the selected state slice.

Use:
Less sensitive than the mean to a few extremely fragmented seats.

### `high fragmentation seats`

Definition:
Count of constituencies where `ENOP >= 5`.

Use:
Highlights seats where three-way or four-way pressure is structurally normal.

### `low plurality seats`

Definition:
Count of constituencies where winner vote share is below `40%`.

Use:
Signals brittle wins and triangular fragmentation.

### `majority winner seats`

Definition:
Count of constituencies where winner vote share is at least `50%`.

Use:
Signals dominant conversions rather than squeaker wins.

### `ultra close seats`

Definition:
Count of constituencies where margin percentage is below `2`.

Use:
Separates extreme pressure seats from the broader `<5` close-contest bucket.

### `turnout median`

Definition:
Median constituency turnout percentage in the selected state slice.

Use:
Typical participation read that is less distorted by a few very high or very low seats.

### `turnout IQR`

Definition:
`75th percentile turnout - 25th percentile turnout`

Use:
Measures how uneven turnout is across constituencies.

### `turnout range`

Definition:
`max turnout - min turnout`

Use:
Fast spread read for the participation map.

### `winner vote-share median`

Definition:
Median constituency winner vote share in the selected state slice.

Use:
Shows how comfortable the typical winning seat was.

### `reservation mix`

Definition:
Counts and shares of `reserved`, `SC`, and `ST` constituencies, plus average turnout in each reservation bucket.

Use:
Gives structure and participation reads without requiring district or booth layers.

## Next metric candidates

These are worth adding next once more historical detail is staged:

- party vote efficiency: seat share divided by vote share
- turnout deviation score: constituency turnout versus state median
- fragmentation pressure score: combine `ENOP`, low plurality, and close-margin incidence
- district concentration score: share of a party’s seats concentrated in its top districts
- retention score: party hold rate cycle-to-cycle where constituency mapping remains valid

## Constituency drilldown metrics

### `margin votes`

Definition:
Winner votes minus runner-up votes.

### `margin %`

Definition:
Percentage-point gap between winner and runner-up vote shares.

### `winner vote share`

Definition:
Winner’s share of valid votes in the constituency.

### `vote gap %`

Definition:
Winner vote share minus runner-up vote share.

Use:
Compact competitiveness read for a single PC or AC.

### `low plurality`

Definition:
Boolean flag for constituencies where winner vote share is below `40%`.

Use:
Highlights seats won through fragmentation rather than broad dominance.

### `majority winner`

Definition:
Boolean flag for constituencies where winner vote share is at least `50%`.

Use:
Separates broad-based wins from narrow multi-cornered conversions.

### `high fragmentation`

Definition:
Boolean flag for constituencies where `ENOP >= 5`.

Use:
Fast local signal that the seat behaves structurally like a crowded field.

### `turnout delta`

Definition:
Constituency turnout minus the staged state median constituency turnout for the same slice.

Use:
Shows whether a PC or AC is participating above or below the state’s typical seat.

### `fragmentation pressure score`

Definition:
Internal `0-100` composite using margin tightness, low plurality, and `ENOP`.

Use:
Gives one compact pressure read for a constituency without hiding the underlying seat metrics.

## District detail metrics

### `district turnout`

Definition:
`district total votes / district total electors * 100`

Use:
Topline participation read for the district page.

### `mean ENOP`

Definition:
Average constituency `ENOP` across all seats inside the district.

Use:
District-level fragmentation benchmark.

### `low plurality seats`

Definition:
Count and share of district constituencies where winner vote share is below `40%`.

Use:
Shows how much of a district is being won through fragmented fields.

### `ultra close seats`

Definition:
Count and share of district constituencies where margin percentage is below `2`.

Use:
Flags districts where seat pressure is concentrated in true toss-up seats.

### `reserved mix`

Definition:
Counts of reserved, `SC`, and `ST` constituencies inside the district.

Use:
Adds structure to district analysis without inventing booth-level proxies.

### `district turnout delta`

Definition:
District turnout minus the staged state median constituency turnout for the same slice.

Use:
Quick read on whether the district is over- or under-participating versus the state’s typical seat.

### `district fragmentation pressure score`

Definition:
Internal `0-100` composite using district shares of low-plurality, ultra-close, and high-fragmentation seats.

Use:
Summarizes how structurally volatile a district’s seat map looks before going seat by seat.

## Reporting rule

When a metric is seeded, derived, or estimated, the UI or docs must make that explicit.
The current prototype labels its data as illustrative for interface development, not live election truth.
