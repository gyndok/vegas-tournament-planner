# Browse Page Enhancements Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

Two enhancements to the browse page:
1. "My Preferences" toggle that pre-fills sidebar filters from saved user preferences
2. Guarantee filter with has/min/max and compound date+guarantee sorting

## Feature 1: My Preferences Toggle

### Approach: Client-side pre-fill

When toggled on, fetch `/api/preferences` and map saved values onto URL search params. The sidebar stays interactive — user can tweak freely. No backend changes needed.

### UI

Segmented control / pill toggle at the top of the browse page: **All | My Preferences**. Only visible when the user is logged in.

### Preference → Filter Mapping

| User Preference | URL Param |
|---|---|
| `buy_in_min` / `buy_in_max` | `buyInMin` / `buyInMax` |
| `preferred_games[]` | `gameType` (multiple) |
| `preferred_formats[]` | `format` (multiple) |
| `preferred_start_time_earliest` / `latest` | `startTimeFrom` / `startTimeTo` |
| `trip_start` / `trip_end` | `dateFrom` / `dateTo` |
| `avoid_turbos` | `avoidTurbos=true` |

### Behavior

- Toggle ON → fetch preferences, batch-set URL params, sidebar reflects new values
- Toggle OFF → clear all params (same as "Reset Filters")
- Manual filter changes while toggle is active: toggle stays on (it's a pre-fill, not a lock)
- Not logged in: toggle hidden

### Files Touched

- `src/app/browse/page.tsx` — add toggle UI
- `src/hooks/use-tournament-filters.ts` — add `applyPreferences()` that batch-sets params
- `src/hooks/use-tournaments.ts` — pass `startTimeFrom`, `startTimeTo`, `avoidTurbos` to API
- `src/app/api/tournaments/route.ts` — parse `startTimeFrom`, `startTimeTo`, `avoidTurbos`
- `src/lib/queries.ts` — filter by start time range and turbo exclusion

## Feature 2: Guarantee Filter

### UI

New filter section in the sidebar between "Format" and "Sort By":
- "Guarantee" header
- Checkbox/toggle: "Has guarantee"
- When checked, reveal min/max number inputs

### Filter Params

| Param | Type | Effect |
|---|---|---|
| `hasGuarantee` | boolean | Filter to `guaranteed_prize > 0` |
| `guaranteeMin` | number | `guaranteed_prize >= value` |
| `guaranteeMax` | number | `guaranteed_prize <= value` |

### Sorting

When `hasGuarantee` is active, sort compound: `date ASC, guaranteed_prize DESC`. This shows tournaments chronologically with the biggest guarantees first within each day.

### Files Touched

- `src/types/index.ts` — add `hasGuarantee`, `guaranteeMin`, `guaranteeMax`, `startTimeFrom`, `startTimeTo`, `avoidTurbos` to `TournamentFilters`
- `src/hooks/use-tournament-filters.ts` — read/write new params
- `src/hooks/use-tournaments.ts` — pass new params to API
- `src/components/tournament-filters.tsx` — new "Guarantee" filter section
- `src/app/api/tournaments/route.ts` — parse new params
- `src/lib/queries.ts` — guarantee filtering + compound sort

## What's NOT Changing

- Settings page (`/settings`) — untouched
- `/api/preferences` — untouched
- Database schema — no new tables or columns
