# Vegas Tournament Planner — Design Document

**Date**: 2026-02-22
**Status**: Approved

## Overview

An AI-powered web application that helps poker players plan their tournament schedule across all Las Vegas poker festivals. Users browse tournaments with structured filters and/or ask an AI chat planner for personalized recommendations.

## Decisions

| Decision | Choice |
|----------|--------|
| Project base | New standalone project in `~/Developer/vegas-tournament-planner` |
| Supabase | Env var placeholders, configure later |
| Data scope | Open-ended multi-festival, starting with WSOP 2026 |
| Chat UX | Dedicated `/chat` page |
| Auth model | Anonymous browse, login required to save preferences/schedule |
| Data ingestion | Admin page with CSV/JSON paste |
| Implementation approach | Feature-Layered MVP (Data+Browse → AI Chat → Auth+Personalization → Admin) |

## Tech Stack

- **Frontend**: Next.js 15 (App Router) deployed on Vercel
- **Backend**: Vercel serverless/edge functions
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Auth**: Supabase Auth (email/password, Google OAuth)
- **Styling**: Tailwind CSS v4 + shadcn/ui

## Project Structure

```
vegas-tournament-planner/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing page
│   │   ├── browse/page.tsx         # Tournament browser
│   │   ├── chat/page.tsx           # AI chat planner
│   │   ├── schedule/page.tsx       # Personal schedule (auth)
│   │   ├── tournament/[id]/page.tsx # Tournament detail
│   │   ├── login/page.tsx          # Auth page
│   │   ├── settings/page.tsx       # User preferences (auth)
│   │   ├── admin/import/page.tsx   # CSV/JSON import (protected)
│   │   └── api/
│   │       ├── tournaments/route.ts
│   │       ├── chat/route.ts
│   │       ├── schedule/route.ts
│   │       ├── schedule/export/route.ts
│   │       └── preferences/route.ts
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── tournament-card.tsx
│   │   ├── tournament-filters.tsx
│   │   ├── chat-interface.tsx
│   │   ├── schedule-view.tsx
│   │   └── nav.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── claude.ts
│   │   └── utils.ts
│   └── types/index.ts
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── scripts/
│   └── parse-wsop-excel.ts
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Data Model

### `series` table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Series name |
| venue | text | Casino/venue name |
| start_date | date | Series start |
| end_date | date | Series end |
| website_url | text | Official schedule URL |
| created_at | timestamptz | Record creation |

### `tournaments` table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| series_id | uuid | FK to series |
| event_number | integer | Event number within series |
| name | text | Full event name |
| date | date | Tournament date |
| day_of_week | text | e.g., "Monday" |
| start_time | time | Local start time (PDT) |
| buy_in | integer | Buy-in in dollars |
| game_type | text | NLH, PLO, PLO8, Mixed, Stud, Razz, etc. |
| format | text | Freezeout, Re-entry, Bounty, Turbo, Deepstack, etc. |
| table_size | integer | 6, 8, 9, or 2 |
| starting_stack | integer | Starting chip count (nullable) |
| blind_levels_minutes | integer | Minutes per level (nullable) |
| late_reg_levels | integer | Levels late reg is open (nullable) |
| late_reg_end_time | time | Computed end time for late reg (nullable) |
| guaranteed_prize | integer | Guarantee in dollars (nullable) |
| is_flight | boolean | Whether this is a flight |
| flight_label | text | e.g., "Flight A" (nullable) |
| parent_event_number | integer | Main event number for flights (nullable) |
| estimated_duration_hours | float | Estimated hours (nullable) |
| notes | text | Additional info |
| created_at | timestamptz | Record creation |

### `user_preferences` table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| buy_in_min | integer | Minimum buy-in |
| buy_in_max | integer | Maximum buy-in |
| preferred_games | text[] | e.g., ["NLH", "PLO"] |
| preferred_formats | text[] | e.g., ["Deepstack", "Freezeout"] |
| preferred_start_time_earliest | time | Earliest start |
| preferred_start_time_latest | time | Latest start |
| preferred_table_size | integer[] | e.g., [6, 9] |
| avoid_turbos | boolean | Skip turbo events |
| trip_start | date | Trip start date |
| trip_end | date | Trip end date |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

### `user_schedule` table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| tournament_id | uuid | FK to tournaments |
| priority | text | "target", "backup", "maybe" |
| notes | text | Personal notes |
| created_at | timestamptz | Record creation |

### Indexes

- `tournaments(date, start_time)` — primary query pattern
- `tournaments(series_id)` — filter by series
- `tournaments(buy_in)` — range queries
- `tournaments(game_type)` — filter by game
- `user_schedule(user_id)` — schedule lookups

### Row Level Security

- `series`, `tournaments` — public read, admin-only write
- `user_preferences`, `user_schedule` — users read/write own rows only
- Anonymous users can read tournaments and series

## Core Features

### 1. Tournament Browser (`/browse`)

**Filter bar** (sticky top on mobile, sidebar on desktop):
- Date: "Today", "Tomorrow", "This week", custom date picker
- Series: multi-select chips with color badges
- Buy-in: dual-handle range slider ($100–$100,000)
- Game type: multi-select chips (NLH, PLO, PLO8, Mixed, Stud, etc.)
- Format: multi-select chips (Freezeout, Re-entry, Bounty, Deepstack, Turbo)
- Table size: toggle chips (6-max, 8-handed, Full ring, Any)
- Start time: range slider (8 AM–8 PM)
- Sort: dropdown (Date/time, Buy-in asc/desc, Guarantee desc)

**Results**: Card list (default) or table view (toggle). Each card shows series color badge, event name, date/time, buy-in, game type, format, guarantee. All filters synced to URL query params.

### 2. AI Chat Planner (`/chat`)

Full-screen chat interface with Claude-powered assistant. Tournament recommendations render as interactive cards within the chat.

**Claude tools**:
- `search_tournaments(filters)` — query tournaments with structured filters
- `get_user_schedule()` — retrieve saved schedule
- `add_to_schedule(tournament_id, priority, notes)` — save tournament
- `get_current_time()` — current PDT time

Response streams to frontend. If user has saved preferences, Claude uses them as defaults. Inline "Add to Schedule" buttons on tournament cards in chat.

### 3. Personal Schedule (`/schedule`, auth required)

Calendar (week) or list view. Color-coded by priority: target (green), backup (yellow), maybe (gray). Conflict detection for overlapping tournaments. ICS export for Google/Apple Calendar.

### 4. Admin Import (`/admin/import`, protected)

Textarea for CSV/JSON paste. Preview table before confirming. Validation for required fields and duplicate detection. Bulk insert.

## UI/UX

### Theme
- Dark mode default: background #0a0a0a, surfaces #1a1a1a, borders #2a2a2a
- Primary accent: poker-table green (#22c55e)
- Clean, modern — not poker kitsch

### Series Colors
| Series | Color |
|--------|-------|
| WSOP | Gold (#eab308) |
| Venetian | Deep Red (#dc2626) |
| Wynn | Dark Green (#16a34a) |
| Aria | Dark Blue (#2563eb) |
| Other | Gray (#6b7280) |

### Mobile-First
- Bottom tab bar on mobile, top nav on desktop
- Collapsible filter sheet on mobile, sidebar on desktop
- Full-width cards on mobile, 2-column grid on desktop

## Error Handling & Edge Cases

- **No results**: Friendly empty state with filter reset button
- **Late-reg past**: Claude suggests upcoming alternatives
- **Flights**: Grouped together with expandable section
- **Missing data**: Nullable fields show "TBD"
- **Anonymous → save**: Login prompt toast, preserve action after redirect
- **Session expired**: Graceful redirect preserving page state
- **Chat errors**: Retry button on stream failures
- **Rate limiting**: Queue requests, typing indicator, disable input while processing

## Performance

- Tournament data cached at edge (ISR/SWR, 1-hour revalidation)
- Chat history in client state (not persisted for MVP)
- Filter changes debounced (300ms)

## Implementation Layers

1. **Layer 1 — Data + Browse**: Supabase schema, seed WSOP data, tournament browser with filters
2. **Layer 2 — AI Chat**: `/chat` page with Claude integration and tool calls
3. **Layer 3 — Auth + Personalization**: Supabase Auth, preferences, schedule, conflict detection, ICS export
4. **Layer 4 — Admin**: Protected `/admin/import` for CSV/JSON ingestion
