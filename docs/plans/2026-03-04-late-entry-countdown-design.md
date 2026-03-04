# Late Entry Countdown Clocks — Design

## Problem

Poker players planning their Vegas trips need to know when late registration closes for tournaments. A countdown clock showing time remaining to enter a tournament in progress is a high-value, differentiating feature. The tournament schema already supports `late_reg_levels`, `late_reg_end_time`, and `blind_levels_minutes`, but these fields are currently unpopulated.

## Solution Overview

Two-part approach:

1. **Get the data in** — enhance the existing scraper to extract late reg info, plus add a bulk admin editor for manual gap-filling
2. **Show countdown clocks** — live countdown badges on browse cards, schedule, tournament detail pages, and a new dashboard "Closing Soon" widget

## Data Acquisition

### A. Enhanced Scraper

Update the PokerAtlas/FireCrawl parser pipeline (`src/lib/scraper/parser.ts` and `src/lib/scraper/pipeline.ts`) to extract three currently-null fields from the markdown:

- **`blind_levels_minutes`** — e.g., "20 min levels" -> `20`
- **`late_reg_levels`** — e.g., "Late entry through level 8" -> `8`
- **`starting_stack`** — e.g., "20,000 chips" -> `20000`

PokerAtlas includes this data on tournament detail pages. FireCrawl may already be returning it in the scraped markdown — we just aren't parsing it. If the data isn't present for a given tournament, the fields remain `null`.

### B. Admin Bulk Editor

New admin page at `/admin/late-reg` showing a filterable table of tournaments with inline editing for:

- `blind_levels_minutes`
- `late_reg_levels`
- `late_reg_end_time` (override)

Design: simple table with editable cells. Click a cell, type value, tab to next. Bulk save button. Filter by series, date range, or "missing data only."

### Coverage Goal

60-70% coverage is sufficient to make the feature valuable. The scraper handles the automated portion; admin editor fills gaps for tournaments that matter.

## Countdown Clock Calculation

```
late_reg_end = tournament_date + start_time + (blind_levels_minutes * late_reg_levels)
```

If `late_reg_end_time` is explicitly set, use that directly instead of calculating.

## Display Design

### Color States

| State | Condition | Color | Label |
|-------|-----------|-------|-------|
| Open | > 1 hour left | Green | "Late reg: 3h 15m" |
| Closing | < 1 hour left | Amber | "Late reg: 45m" |
| Urgent | < 15 minutes | Red | "Late reg: 12m" |
| Closed | Past cutoff | Gray | "Late reg closed" |
| N/A | No data or not today | — | No badge (future: static text) |

### Display Locations

**1. Browse page & My Schedule cards**
- Small colored badge on each tournament card
- Only shows for today's tournaments with late reg data
- Updates every 60 seconds (no need for per-second updates in list view)

**2. Tournament detail page**
- Prominent countdown card with per-second ticking
- Shows calculated late reg end time alongside the countdown
- Same color state system but larger and more prominent

**3. Dashboard "Closing Soon" widget**
- New card on the dashboard
- Shows today's tournaments where late reg is still open or closing within 4 hours
- Sorted by soonest closing first
- Each row shows: tournament name, casino, buy-in, countdown badge
- Quick "Add to schedule" action for tournaments not yet on user's schedule

### When Countdowns Are Active

- **Today's tournaments**: Live countdown badge shown
- **Future tournaments with data**: Static text only ("Late reg through level 8, ~1:40 PM")
- **Past tournaments / no data**: No badge shown

## Implementation Components

### Shared Hook: `useLateRegCountdown`

A React hook that:
- Takes a tournament object
- Calculates `late_reg_end` datetime
- Returns `{ timeRemaining, status, formattedTime, isActive }`
- Uses `useEffect` with interval for live updates
- Handles timezone correctly (all tournaments are PT/Las Vegas time)

### `<LateRegBadge>` Component

Shared badge component used on cards and detail pages:
- Accepts `tournament` prop
- Uses `useLateRegCountdown` hook
- Renders appropriate color state and formatted time
- Supports `size="sm"` (cards) and `size="lg"` (detail page) variants

### `<ClosingSoonWidget>` Component

Dashboard widget:
- Fetches today's tournaments with late reg data
- Filters to those with late reg still open or closing within 4 hours
- Renders sorted list with `<LateRegBadge>` for each

## No New Database Changes

All required fields already exist in the `tournaments` table:
- `late_reg_levels` (integer, nullable)
- `late_reg_end_time` (time, nullable)
- `blind_levels_minutes` (integer, nullable)
- `starting_stack` (integer, nullable)

## Technical Notes

- All tournament times are Las Vegas time (America/Los_Angeles)
- The countdown hook should handle DST transitions correctly
- Badge updates use `setInterval` — 60s for list views, 1s for detail page
- No SSR concerns — countdown is fully client-side
- Tournaments without late reg data simply don't show a badge (graceful degradation)
