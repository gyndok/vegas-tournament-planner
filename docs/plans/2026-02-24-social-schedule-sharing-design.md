# Social Schedule Sharing — Design

## Overview

Allow users to share a read-only view of their tournament schedule via a private link. Sharing is opt-in, toggle-based, and uses a random token URL so only people with the link can view it.

## Decisions

- **URL format:** Token-based (`/shared/abc123`) — private by default
- **Shared view:** Full calendar with priorities and series colors, read-only
- **Toggle:** On/off switch on the schedule page; token persists across toggles
- **Notes:** Hidden from shared view — personal notes stay private
- **Storage:** Two columns on existing `user_preferences` table (no new table)

## Database

Add to `user_preferences`:

```sql
ALTER TABLE user_preferences
  ADD COLUMN share_token UUID DEFAULT NULL,
  ADD COLUMN share_enabled BOOLEAN DEFAULT FALSE;
```

- First time sharing is enabled → generate `crypto.randomUUID()` and save as `share_token`
- Toggling off sets `share_enabled = false` but keeps the token
- "Regenerate Link" nulls the old token and creates a new one
- Public reads use Supabase service role client to bypass RLS

## API

### New: `GET /api/schedule/shared/[token]`

- **Auth:** None required (public endpoint)
- **Logic:**
  1. Look up `user_preferences` where `share_token = [token]` AND `share_enabled = true`
  2. If not found → 404
  3. Fetch user's `user_schedule` entries with tournament + series joins
  4. Strip `notes` field from all entries
  5. Return `{ entries, tripDates: { from, to } }`
- **Client:** Supabase service role (bypasses RLS)

### Updated: `PUT /api/preferences`

- Accept `share_enabled` boolean in body
- When enabling and no `share_token` exists → generate UUID, save it
- Return `share_token` in response so UI can display the link

## Frontend

### New page: `/shared/[token]/page.tsx`

- Server-rendered, public (no auth check)
- Fetches from `/api/schedule/shared/[token]`
- Reuses `ScheduleCalendar` component in **read-only mode**
- Header: "Shared Schedule" with trip date range
- No edit controls, no notes, no add/remove buttons
- Priority colors (target/backup/maybe) and series color badges visible
- Invalid or disabled token → "This schedule is not available" message

### Updated: `/schedule` page — Share controls

Add to header area:
- Toggle switch: "Share my schedule"
- When enabled: show shareable URL + **Copy Link** button
- "Regenerate Link" text button (creates new token, invalidates old)
- When disabled: link hidden, shared page returns unavailable

## Data Flow

```
User toggles sharing ON
  → PUT /api/preferences { share_enabled: true }
  → Server generates share_token if needed
  → Returns token → UI shows link: nextrebuy.com/shared/[token]

Visitor opens /shared/[token]
  → Server fetches user_preferences by token (service role)
  → If share_enabled=true → fetch user_schedule entries
  → Strip notes → render read-only calendar

User toggles sharing OFF
  → PUT /api/preferences { share_enabled: false }
  → /shared/[token] now returns "not available"
```
