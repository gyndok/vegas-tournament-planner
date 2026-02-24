# Custom Tournament Import — Design

## Overview

Let users add tournaments that aren't in our database (home games, smaller casinos, charity events) and optionally submit them for inclusion in the public database. Supports single event entry via form and bulk import via CSV.

## Decisions

- **Single event input:** Simple form at `/custom/new`
- **Bulk import:** CSV upload at `/custom/import`
- **Visibility:** Private by default, optionally submitted as public
- **Moderation:** Admin approval required for public submissions
- **Deduplication:** Admin review checks against existing tournaments by venue/date/time/buy-in

## Database

### New table: `custom_tournaments`

```sql
CREATE TABLE custom_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | pending | approved | rejected
  is_public BOOLEAN DEFAULT FALSE,
  approved_tournament_id UUID REFERENCES tournaments(id),  -- set after admin approval

  -- Tournament fields
  name TEXT NOT NULL,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  buy_in INTEGER NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'NLH',
  format TEXT NOT NULL DEFAULT 'Re-entry',
  table_size INTEGER NOT NULL DEFAULT 9,
  venue_name TEXT NOT NULL,                   -- free text, not FK to series
  guaranteed_prize INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_tournaments_created_by ON custom_tournaments(created_by);
CREATE INDEX idx_custom_tournaments_status ON custom_tournaments(status) WHERE status = 'pending';
```

**RLS policies:**
- Users SELECT/INSERT/UPDATE/DELETE own rows (`created_by = auth.uid()`)
- Service role reads all `pending` rows for admin review

**Key design choice:** Uses `venue_name` (free text) instead of `series_id` (FK) since custom tournaments may reference venues not in our `series` table. When admin approves a public submission, they map it to an existing series or create a new one.

## User Features

### 1. Add Custom Tournament (Form)

**Route:** `/custom/new`

**Form fields:**
- Name (text, required)
- Date (date picker, required)
- Start Time (time picker, required)
- Buy-in (number, required)
- Game Type (dropdown: NLH, PLO, PLO8, Mixed, Stud, Razz, etc.)
- Format (dropdown: Re-entry, Freezeout, Deepstack, Bounty, etc.)
- Table Size (dropdown: 6, 8, 9, 10)
- Venue Name (text, required)
- Guarantee (number, optional)
- Notes (textarea, optional)
- Checkbox: "Submit to public database" (sets `is_public = true`, `status = 'pending'`)

**After save:** redirects to schedule page. Tournament appears with a "Custom" badge.

### 2. CSV Bulk Import

**Route:** `/custom/import`

**Flow:**
1. Upload CSV file
2. Parse and show preview table
3. User confirms → bulk insert into `custom_tournaments`
4. Option to batch-submit as public

**Required CSV columns:** name, date, start_time, buy_in, game_type
**Optional columns:** format, table_size, venue_name, guarantee, notes

**Reuses** existing CSV parsing patterns from the admin import page.

### 3. Schedule Integration

- Custom tournaments appear on schedule, trip planner, and calendar views alongside regular tournaments
- Distinguished by a "Custom" badge (purple color scheme)
- Can be assigned priority (target/backup/maybe) same as regular tournaments
- User can edit/delete their custom tournaments from the schedule

**Implementation:** The schedule hooks and components need to fetch from both `user_schedule` (regular) and `custom_tournaments` (custom), merging them for display.

### 4. Navigation

- Add "Add Tournament" button/link accessible from schedule page header
- `/custom/new` for single entry
- `/custom/import` for CSV bulk import

## Admin Features

### Admin Review Page

**Route:** `/admin/review` (or section within existing `/admin/import`)

**Features:**
- List all `pending` custom tournaments
- For each, run deduplication check against `tournaments` table:
  - Match on: `venue_name ILIKE series.venue AND date AND start_time AND buy_in`
  - If duplicate found: show match side-by-side, admin can reject with "Already in database"
- Approve action:
  1. Admin selects or creates a series for the venue
  2. Insert into main `tournaments` table
  3. Set `approved_tournament_id` on the custom tournament
  4. Update `status = 'approved'`
- Reject action: set `status = 'rejected'`
- Bulk approve/reject for efficiency

## Data Flow

```
User creates custom tournament (form or CSV)
  → INSERT into custom_tournaments (status = 'draft' or 'pending')
  → Appears on user's schedule with "Custom" badge

If is_public = true:
  → status = 'pending'
  → Shows in admin review queue
  → Admin checks for duplicates
  → Approve: copy to tournaments table, link via approved_tournament_id
  → Reject: status = 'rejected', user notified

Schedule display:
  → Fetch user_schedule entries (regular tournaments)
  → Fetch custom_tournaments where created_by = user
  → Merge and display together, custom ones get "Custom" badge
```

## API Endpoints

- `GET /api/custom-tournaments` — list user's custom tournaments
- `POST /api/custom-tournaments` — create single custom tournament
- `PUT /api/custom-tournaments/[id]` — update custom tournament
- `DELETE /api/custom-tournaments/[id]` — delete custom tournament
- `POST /api/custom-tournaments/import` — bulk CSV import
- `GET /api/admin/review` — list pending submissions (admin only)
- `POST /api/admin/review/[id]` — approve/reject (admin only)
