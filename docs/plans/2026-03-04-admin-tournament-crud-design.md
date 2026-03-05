# Admin Tournament CRUD — Unified Admin Hub

**Date:** 2026-03-04
**Status:** Approved

## Overview

Replace the scattered admin pages (`/admin/import`, `/admin/late-reg`) with a single unified admin hub at `/admin`. Provides full CRUD for tournaments: searchable/filterable list, slide-over edit panel, single-tournament creation, and the existing import/scrape flow — all in one tabbed interface.

## Page Structure

**Route:** `/admin`
**Tabs:** Tournaments | Import | Add New

### Tournaments Tab (default)

**Top bar:**
- Search input — filters by tournament name, series/venue
- Filter dropdowns: Casino, Date range, Game type
- Count display: "Showing 47 of 1,284 tournaments"

**Table:**

| Date | Time | Tournament | Casino | Buy-in | Game | Format | Guarantee |
|------|------|-----------|--------|--------|------|--------|-----------|

- Sortable by column header click (date default)
- Cursor-based pagination (load more or infinite scroll)
- Click any row → opens edit slide-over panel

**Edit slide-over panel (~400px, right side):**
- Tournament name as header
- Fields organized in sections:
  - **Core:** Name, Event #, Date, Day of Week, Start Time
  - **Game:** Buy-in, Game Type, Format, Table Size
  - **Structure:** Starting Stack, Blind Levels (min), Late Reg Levels, Late Reg End Time
  - **Prize:** Guaranteed Prize
  - **Flight:** Is Flight, Flight Label, Parent Event #
  - **Other:** Estimated Duration, Notes
- Series displayed as read-only (changing series is rare/dangerous)
- Save / Cancel buttons
- Delete button (bottom, red, confirmation dialog)

### Import Tab

Existing `/admin/import` page content moved here. Two sub-tabs:
- **Scrape Casino** — scrape from PokerAtlas via Firecrawl
- **Paste Data** — JSON/CSV import with preview

No functional changes — same API routes (`/api/admin/import`, `/api/admin/scrape`).

### Add New Tab

Full-width form with same field layout as edit panel, plus:
- Series picker: select existing series or create new
- New series inline form (name, venue, start/end date)
- Submit creates tournament via POST

## API Design

**New route:** `/api/admin/tournaments`

### GET /api/admin/tournaments
- Query params: `search`, `series_id`, `game_type`, `date_from`, `date_to`, `cursor`, `limit` (default 50)
- Reuses `buildTournamentQuery()` from `lib/queries.ts` with added text search
- Returns `{ data: Tournament[], nextCursor: string | null, totalCount: number }`
- Auth: `isAdminEmail()` check

### POST /api/admin/tournaments
- Body: All tournament fields + optional `new_series` object
- Required: name, date, start_time, buy_in, game_type, series_id (or new_series)
- Creates series first if `new_series` provided
- Returns created tournament
- Auth: `isAdminEmail()` check

### PATCH /api/admin/tournaments
- Body: `{ id: string, ...partial tournament fields }`
- Updates single tournament by ID
- Returns updated tournament
- Auth: `isAdminEmail()` check

### DELETE /api/admin/tournaments
- Body: `{ id: string }`
- Deletes tournament and cascading user_schedule / user_favorites references
- Returns `{ deleted: true }`
- Auth: `isAdminEmail()` check

## Pages Removed

- `/admin/import/page.tsx` — absorbed into Import tab
- `/admin/late-reg/page.tsx` — redundant, all fields editable via tournament edit

## Edge Cases

- **Delete cascade:** Remove `user_schedule` and `user_favorites` rows referencing deleted tournament
- **Scrape dedup:** No changes to existing import deduplication logic
- **Concurrent editing:** Single admin, not a concern
- **Validation:** Client-side for UX, server-side as safety net
- **Existing API routes:** `/api/admin/import`, `/api/admin/scrape` remain. `/api/admin/late-reg` kept temporarily, removed once stable.

## Tech Stack

- React client component with useState for tab/panel state
- Supabase server client for API routes
- Existing UI components: Button, Input, Badge, Card
- Custom slide-over panel component (no external dependency)
- Existing `isAdminEmail()` auth pattern
- Existing `buildTournamentQuery()` for filtered listing
