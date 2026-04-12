# WSOP 2026 Side Events Import — Design

**Date:** 2026-04-12
**Status:** Approved for implementation

## Problem

The database currently contains only WSOP bracelet events. The 2026 WSOP runs many non-bracelet events at Horseshoe Las Vegas between May 26 – July 14, 2026:

- Daily Deepstack tournaments (NLH, HORSE, PLO, Seniors)
- Mega Satellites (Mystery Millions, Colossus, Gladiators, Daily Landmark)
- Specialty 7pm Mega Satellites feeding into bracelet events
- High Roller Mega Satellites

Users planning a Vegas trip need these events in the schedule to build realistic itineraries.

## Data Source

WSOP has not yet published the detailed 2026 side events schedule. The 2025 side events PDF (pages 8–10 of the WSOP 2025 schedule) is the authoritative template. Side events are historically stable year to year.

**Adaptation rule:** Shift every 2025 date back by 1 day to align with 2026. Day-of-week alignment is preserved (2025 May 27 Tue → 2026 May 26 Tue).

**Disclosure:** Every imported event carries `notes` including: `"Projected from 2025 WSOP side events schedule - verify when WSOP publishes 2026 side events."`

## Scope

All ~365 tournament instances get their own row in the `tournaments` table (full expansion of recurring series).

### Series Record

```
name:       "2026 WSOP - Side Events"
venue:      "Horseshoe Las Vegas"
start_date: 2026-05-26
end_date:   2026-07-14
```

### Event Categories

| Category | Approx. Count | Dates / Cadence |
|---|---:|---|
| Daily NLH Deepstacks — $250 @ 1pm, $400 @ 4pm, $200 @ 8pm | ~150 | Every day May 26 – Jul 14 |
| HORSE Deepstack — $250 @ 3pm | 7 | Tuesdays Jun 2 – Jul 14 |
| PLO Deepstack — $250 @ 3pm | 6 | Wednesdays Jun 3 – Jul 8 |
| Seniors NLH Deepstack — $250 @ 9am (50+ only) | 7 | Thursdays May 28 – Jul 9 |
| Ladies Warm Up — $1,500 / $150 discounted @ 6pm | 1 | Jun 23 |
| Mystery Millions Megas — $135 @ 12pm, $240 @ 4pm | 8 | May 26 – 29 |
| Colossus Megas — $70 @ 12pm | 4 | Jun 2 – 5 |
| Gladiators Megas — $50 @ 12pm | 4 | Jun 23 – 26 |
| Daily Landmark Megas — $240 @ 3pm, $580 @ 7pm, $135 @ 10pm | ~147 | May 26 – Jul 13 |
| Specialty 7pm Megas (feeding bracelet events) | 21 | Various specific dates |
| High Roller Megas ($25K / $50K / $100K) | 11 | May 28 – Jun 9 |

### Specialty 7pm Mega Satellites (specific dates, adapted -1 day)

| Date (2026) | Feeds Into | Buy-in |
|---|---|---|
| May 26 | $5K NLH 8-Handed | $580 |
| May 27 | $5K PLO | $580 |
| May 29 | $10K Omaha Hi-Lo 8 | $1,100 |
| May 30 | $10K NLH (Mystery Bounty) | $1,100 |
| Jun 1 | $10K Dealers Choice | $1,100 |
| Jun 4 | $10K Seven Card Stud | $1,100 |
| Jun 6 | $10K NL 2-7 Lowball Draw | $1,100 |
| Jun 8 | $10K PLO Hi-Lo Split 8 | $1,100 |
| Jun 10 | $10K Limit Hold'em | $1,100 |
| Jun 12 | $10K Big O | $1,100 |
| Jun 14 | $10K Razz | $1,100 |
| Jun 16 | $10K H.O.R.S.E. | $1,100 |
| Jun 21 | $5K NLH 6-Handed | $580 |
| Jun 24 | $10K 2-7 Triple Draw Lowball | $1,100 |
| Jun 25 | $10K NLH (Super Turbo Bounty) | $1,100 |
| Jun 26 | $10K Pot-Limit Omaha | $1,100 |
| Jun 28 | $10K Seven Card Stud Hi-Lo 8 | $1,100 |
| Jun 30 | $10K 8-Game Mixed | $1,100 |
| Jul 6 | $5K NLH (Super Turbo Bounty) | $580 |
| Jul 10 | $10K NLH 6-Handed | $1,100 |
| Jul 13 | $5K NLH 8-Handed | $580 |

### High Roller Mega Satellites (specific dates, adapted -1 day)

| Date (2026) | Event | Buy-in(s) & Time(s) |
|---|---|---|
| May 28 | $25K Heads-Up NLH | $2,700 @ 6pm |
| May 31 | $25K HR PLO/NLH | $2,700 @ 6pm |
| Jun 3 | $25K HR 6-Handed NLH | $2,700 @ 11am |
| Jun 5 | $25K HR NLH | $2,700 @ 6pm |
| Jun 7 | $50K HR NLH | $625 @ 3pm, $5,300 @ 6pm |
| Jun 9 | $100K HR NLH | $120 @ 12pm, $850 @ 3pm, $7,500 @ 6pm |

## Schema Mapping

Existing schema supports every field needed — no migration required.

- `format`: `"Deepstack"`, `"Satellite"`, `"Satellite - Specialty"`, `"Satellite - High Roller"`
- `game_type`: `"NLH"`, `"PLO"`, `"HORSE"`, `"Omaha Hi-Lo"`, `"2-7 Lowball"`, `"Big O"`, `"Razz"`, `"Seven Card Stud"`, `"8-Game Mixed"`, `"Mixed"`, `"Dealers Choice"`, `"Limit Hold'em"`
- `start_time`: Converted from "1PM" → `"13:00:00"` etc.
- `is_flight`: `false` for all side events
- `guaranteed_prize`: `null` (side events are non-guaranteed)
- `notes`: Projection disclaimer + event-specific detail (seniors age restriction, bracelet event fed, bounty format, etc.)

## Implementation Plan

1. **Generate** `wsop_2026_side_events_schedule.json` at repo root, following the same `metadata + events[]` structure as `wsop_circuit_schedule.json`. Use a small Node.js generator script (or inline generation in the import script) to expand recurring daily/weekly events.

2. **Create** `import_wsop_side_events.js` at repo root, mirroring `import_wsop.js`:
   - Load `.env.local`
   - Create "2026 WSOP - Side Events" series (or reuse if it exists)
   - Bulk insert all ~365 tournament rows
   - Convert `"1PM"` → `"13:00:00"` format
   - Print summary of inserted rows

3. **Run** import against Supabase via `node import_wsop_side_events.js`.

4. **Verify** in the app UI that side events show up on the browse/calendar pages with the correct dates, buy-ins, and the projection disclaimer visible in notes.

## Out of Scope

- Updates to scraper config (PokerAtlas doesn't have the data yet).
- Schema changes (existing schema handles this).
- UI changes (browse view already renders any tournament row).
- Re-import from live WSOP data when published (future task).

## Risks

- **Projection accuracy:** Side events may differ from 2025 in subtle ways (new satellite types, dropped events). Mitigation: projection disclaimer in notes, plan to re-import when real data lands.
- **Duplicate prevention:** Running the import twice would duplicate rows. Mitigation: script checks if the series already exists with any tournaments attached and aborts if so, or supports an `--overwrite` flag.
