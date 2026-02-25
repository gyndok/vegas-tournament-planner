# Bankroll Tracker Design

## Goal

Let players log tournament results against their scheduled tournaments and see a trip P&L summary on the Trip Planner page.

## Scope

- Scheduled tournaments only (no cash games or unscheduled sessions)
- Minimal data per result: net cash out, finish position (optional), notes (optional)
- Results summary lives on the Trip Planner page alongside the existing budget bar

## Database

New `tournament_results` table:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| user_id | UUID FK → auth.users | ON DELETE CASCADE |
| schedule_entry_id | UUID FK → user_schedule | ON DELETE CASCADE, UNIQUE |
| result_amount | INTEGER | Net cash out (e.g. $1200 won, not profit). Profit = result_amount - buy_in |
| finish_position | INTEGER | Nullable. E.g. 3 for 3rd place |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

RLS: users can only CRUD rows where `user_id = auth.uid()`.

One result per schedule entry (UNIQUE constraint on schedule_entry_id).

## API

`/api/results` route:

- **GET** — returns all results for the authenticated user, joined with schedule entry + tournament data
- **POST** — create a result: `{ schedule_entry_id, result_amount, finish_position?, notes? }`
- **PATCH** — update a result: `{ id, result_amount?, finish_position?, notes? }`
- **DELETE** — delete a result by id (with ownership check)

## Hook

`useResults()` — fetches results on mount, exposes `results`, `loading`, `createResult`, `updateResult`, `deleteResult`.

## UI Changes

### Trip Planner — Results Summary Section

New section between the budget bar and daily itinerary. Three stat cards:

- **Net P&L** — sum of (result_amount - buy_in) across all logged results. Green if positive, red if negative.
- **Played** — count of logged results out of total scheduled
- **ROI** — (net P&L / total buy-ins invested) × 100, shown as percentage

### Trip Day Card — Log Result Button

Each scheduled tournament in the daily itinerary gets:

- If no result logged: "Log Result" button
- If result logged: green/red badge showing the net result (e.g. "+$700" or "-$500") with edit/delete options

Clicking "Log Result" opens a small dialog with:
- Result amount (number input, required)
- Finish position (number input, optional)
- Notes (textarea, optional)

## Non-Goals

- No cash game tracking
- No charts or historical trends (future feature)
- No re-buy/add-on tracking
