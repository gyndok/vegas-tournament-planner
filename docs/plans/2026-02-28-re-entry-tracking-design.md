# Re-Entry Tracking for Tournament Events

**Date:** 2026-02-28

## Overview

Allow users to re-enter tournaments they've busted out of (when the tournament format permits it). Each re-entry is tracked separately with its own result, and the trip budget reflects the total cost across all entries.

## Data Model: Multiple Rows Per Tournament

Each re-entry creates a new row in `user_schedule` with an incrementing `entry_number`.

### Migration

- Drop unique constraint on `(user_id, tournament_id)` in `user_schedule`
- Add `entry_number INT NOT NULL DEFAULT 1` column
- New unique constraint: `(user_id, tournament_id, entry_number)`
- No new tables — each `user_schedule` row already links to its own `tournament_result`
- No changes to `tournaments` table — existing `format` field ("Re-entry", "Freezeout") determines eligibility

## User Flow

1. User adds tournament to schedule — works as today (entry #1)
2. If tournament format allows re-entry, the scheduled event card shows a **"Re-enter"** button
3. Tapping "Re-enter" creates a new `user_schedule` row with `entry_number` incremented
4. Card displays badge like **"2 entries × $500 = $1,000"**
5. Each entry can have its own result logged independently

## UI Changes

### Schedule Page
- Group multiple entries for same tournament into single card
- Show entry count badge and total cost
- Expandable section to see/log results per entry

### Trip Planner
- Already sums buy-ins per schedule row — works automatically
- Daily totals and trip budget reflect all entries

### Tournament Detail Page
- "Add to Schedule" button changes to "Re-enter" if already scheduled and format allows it

### Re-Entry Eligibility
- "Re-enter" button only appears when tournament `format` includes "Re-entry"
- Freezeout, Bounty, Mystery Bounty tournaments do not show re-enter option

## What Doesn't Change

- Browse page, calendar views, AI chat, custom tournaments — unaffected
- Shared schedule links still work (show all entries)

## Files to Modify

1. New Supabase migration — schema changes to `user_schedule`
2. `src/types/index.ts` — add `entry_number` to `UserScheduleEntry`
3. `src/app/api/schedule/route.ts` — support re-entry POST, handle entry numbering
4. `src/hooks/use-schedule.ts` — add `reenterTournament()`, update queries
5. `src/app/schedule/page.tsx` — group entries, show count badge, re-enter button
6. `src/app/tournament/[id]/page.tsx` — change button to "Re-enter" when applicable
7. `src/components/trip-day-card.tsx` — display grouped entries with count
