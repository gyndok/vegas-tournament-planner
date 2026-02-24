# Casino/Series Filter Design

## Overview

Add a casino/series filter to the Browse page sidebar, allowing users to filter tournaments by which casino they belong to (WSOP, Venetian, Wynn, etc.). This is the most requested missing filter — the backend already supports series-based filtering, so this is purely a UI addition with minor query adjustments.

## UI Design

- New **"Casino"** section as the **first filter** in the sidebar, above Date
- Color-coded toggle badges matching existing `SERIES_COLORS`:
  - WSOP (amber), Venetian (red), Wynn (green), Aria (blue), Golden Nugget (orange), MGM (purple), Orleans (cyan)
- Multi-select: tap one or more casinos to see tournaments from all selected
- Selected badges use their brand color fill; unselected show as outlined
- Same toggle behavior as existing Game Type and Format badges

## Data Flow

- New URL param: `casino` (multi-value, e.g. `?casino=WSOP&casino=Venetian`)
- New filter field: `casinos?: string[]` in `TournamentFilters` type
- Query approach: name-based match on the series table (no UUID lookup needed)
- Filter count updated to include casino selections

## Files Changed

1. **`src/types/index.ts`** — Add `casinos?: string[]` to `TournamentFilters`
2. **`src/lib/queries.ts`** — Add casino name filtering to `buildTournamentQuery` and `buildCountQuery` using series name matching
3. **`src/hooks/use-tournament-filters.ts`** — Parse `casino` URL params into `casinos` filter, add to `filterCount`
4. **`src/components/tournament-filters.tsx`** — Add Casino section with color-coded toggle badges at the top of the filter list
5. **`src/app/api/tournaments/route.ts`** — Parse `casino` query params and pass to filters

## Approach

Hardcoded casino list from existing `SERIES_COLORS` map. The casino list is stable (~7 venues) and colors are already defined. Name-based text matching against the series name avoids needing UUID lookups.

## Decisions Made

- **Placement:** First filter section (above Date) — casino is typically the first thing users narrow down on
- **Badge style:** Color-coded using existing brand colors from SERIES_COLORS
- **Data source:** Hardcoded list (not dynamic from API) — simpler, no extra API calls
- **Filter method:** Name-based match on series name (not UUID-based) — simpler, no lookup needed
