# Trip Planning Dashboard Design

## Overview

A dedicated `/trip` page that gives users a day-by-day itinerary view of their Vegas trip with budget tracking. Shows scheduled tournaments, available tournaments they could add, and a budget progress bar.

## Page Layout

### 1. Trip Header
- Trip date range display ("Jun 1 – Jun 15, 2026") with day count
- Budget progress bar: "$2,400 of $5,000 committed" with green/yellow/red color coding
- "Edit Trip" button to modify dates and budget (links to Settings or inline form)

### 2. Daily Itinerary
- Vertically stacked day cards, one per day of the trip
- Each day card shows:
  - Date header ("Tuesday, Jun 3")
  - Scheduled tournaments with time, casino, buy-in, priority badge, and remove action
  - Collapsible "Available Tournaments" section with other tournaments that day and Quick Add button
- Days with no scheduled tournaments show "Free day — browse tournaments" prompt

### 3. No Trip Set State
- If user hasn't set trip dates, show a prompt with date pickers to set them on the page

## Data Flow

- **Trip dates & budget**: Read from `user_preferences` (`trip_start`, `trip_end`, new `trip_budget` column)
- **Scheduled tournaments**: From `/api/schedule`, filtered to trip date range client-side
- **Available tournaments**: From `/api/tournaments` with trip date range, grouped by day client-side, excludes already-scheduled
- **Quick-add**: Uses existing `POST /api/schedule` endpoint
- **Budget**: Computed client-side by summing `buy_in` of scheduled tournaments within trip window

## Data Storage

Reuse existing `user_preferences` table. Add one column: `trip_budget integer`. No new tables. Supports one trip at a time (most users plan one Vegas trip at a time).

## Files Changed

1. `supabase/migrations/..._add_trip_budget.sql` — Add `trip_budget` column to `user_preferences`
2. `src/types/index.ts` — Add `trip_budget: number | null` to `UserPreferences`
3. `src/app/api/preferences/route.ts` — Handle `trip_budget` in GET/PUT
4. `src/app/settings/page.tsx` — Add budget input to Trip Dates card
5. `src/app/trip/page.tsx` — New page: Trip Planning Dashboard
6. `src/components/trip-day-card.tsx` — New component: single day in the itinerary
7. `src/components/left-sidebar.tsx` — Add "Trip" nav item with Plane icon

## Decisions Made

- **Location**: New `/trip` page (not merged into Schedule)
- **Data storage**: Reuse `user_preferences` with one new column (not a new trips table)
- **Discovery**: Show both scheduled and available tournaments per day
- **Budget**: Simple total budget (not per-day), user enters one number
- **Budget computation**: Client-side sum of scheduled tournament buy-ins
