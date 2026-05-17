# Last Longer Pools — Implementation Spec (v1.1)

**Project:** nextrebuy.com
**Feature:** Last Longer Pools (v1)
**Status:** Ready for implementation
**Owner:** Geffrey Klein

**Changelog from v1.0:** Incorporates codebase review — confirmed `custom_tournaments` + Resend exist; no `profiles` table (display_name fallback chain); `user_schedule` table name + missing `source` column; schema fixes (circular FK, ON DELETE, drop bust_order); home games skip schedule auto-add; Day 2 Restart heuristic.

---

## Overview

Last Longer Pools let a group of players bet on who survives longest in a single poker tournament. One user (the **organizer**) creates a pool tied to a tournament, shares an invite link, and manages verification + bust-out tracking. The **last alive** player wins (organizer declares the winner manually).

This spec covers v1 scope only. Items explicitly deferred are listed at the end.

---

## Core Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Pool scope | Single tournament per pool |
| 2 | Re-entries keep you alive? | Organizer chooses per pool |
| 3 | Pool start point | Organizer chooses: tournament start OR after rebuy period closes |
| 4 | Multi-flight "out" rule | Organizer chooses per pool (first flight bust OR last flight bust) |
| 5 | Can organizer also play? | Yes, always |
| 6 | `open → locked` transition | Organizer manually locks |
| 7 | Source tournament cancelled? | Auto-cancel pool + email all members |
| 8 | Change tournament after pool creation? | No, locked at creation |
| 9 | Winner declaration | Organizer manually declares always |
| 10 | Bust-out reversal | No self-undo. Organizer-only edits. |
| 11 | Chip count history | Latest value only |
| 12 | Display name per pool | Optional per-pool display name; fallback chain below |
| 13 | Joining a pool → schedule | Auto-add for official tournaments only; home games skip (note in UI) |
| 14 | Custom/home-game tournaments | Yes, with `pool_type = 'home_game'` flag |
| 15 | Member accounting | Single `verified` boolean per member |
| 16 | Verified status visibility | All pool members see everyone's verified status |
| 17 | Unverified members | Can still self-report bust + update chips, flagged "Unverified" in UI |
| 18 | Signup friction on invite | Lightweight email-only signup |
| 19 | Audit log | Status changes only (join / verify / bust), not chip updates |
| 20 | Organizer notified on join? | **No** — organizer checks dashboard |
| 21 | Day 2 Restart filtering | Heuristic: exclude `buy_in = 0 OR name ILIKE '%restart%' OR '%day 2%'` |

---

## Codebase Findings (confirmed)

| Question | Answer |
|---|---|
| `custom_tournaments` exists? | **Yes** (`20260226_add_custom_tournaments.sql`) |
| Email provider | **Resend**, helper at `src/lib/email.ts` |
| User identity | **No `profiles` table.** `auth.users` + `user_metadata` (`full_name`, `name`) |
| Schedule table name | `user_schedule` (not `user_schedule_entries`) |
| Schedule `source` column | **Does not exist** — requires migration |

---

## Identity / display_name fallback chain

Since there's no profiles table, resolve a member's display name in this order:

1. `pool_members.display_name` (per-pool override, nullable)
2. `auth.users.raw_user_meta_data->>'full_name'`
3. `auth.users.raw_user_meta_data->>'name'`
4. Email local-part (everything before `@`)

Implement as a Postgres view or a TS helper `resolveMemberName(member, user)`. UI never shows raw email.

**Note:** Two members in the same pool sharing a display name is **allowed**. UI disambiguates (e.g., `Geff` and `Geff (K.)`) by appending last-name initial when collision detected. No DB uniqueness constraint on display_name.

---

## Data Model

### Schema dependencies / migration order

1. `ALTER TABLE user_schedule ADD COLUMN source text NOT NULL DEFAULT 'manual';`
2. Create `pool_members` (no FK from pools yet)
3. Create `pools` (without `winner_member_id`)
4. `ALTER TABLE pools ADD COLUMN winner_member_id uuid REFERENCES pool_members(id) ON DELETE SET NULL;`
5. Create `pool_audit_log`
6. Create RLS policies + indexes

### `pools`

```sql
create table pools (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references auth.users(id) on delete set null,
  tournament_id uuid references tournaments(id),
  custom_tournament_id uuid references custom_tournaments(id),
  pool_type text not null default 'official' check (pool_type in ('official', 'home_game')),
  name text not null,
  status text not null default 'open' check (
    status in ('draft', 'open', 'locked', 'live', 'ended', 'cancelled')
  ),

  -- Organizer-configured rules
  reentries_keep_alive boolean not null default true,
  start_after_reentry_period boolean not null default false,
  multiflight_out_rule text not null default 'last_flight' check (
    multiflight_out_rule in ('first_flight', 'last_flight')
  ),

  -- Invite
  invite_token text not null unique,

  -- winner_member_id added AFTER pool_members exists (see migration order)
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pool_has_one_tournament check (
    (tournament_id is not null)::int + (custom_tournament_id is not null)::int = 1
  ),
  constraint pool_type_matches_fk check (
    (pool_type = 'official' and tournament_id is not null) or
    (pool_type = 'home_game' and custom_tournament_id is not null)
  )
);

create index idx_pools_organizer on pools(organizer_id);
create index idx_pools_tournament on pools(tournament_id) where tournament_id is not null;
create index idx_pools_invite_token on pools(invite_token);
```

### `pool_members`

```sql
create table pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  display_name text,                                -- nullable; resolves via fallback chain
  verified boolean not null default false,

  status text not null default 'alive' check (
    status in ('alive', 'busted', 'no_show')
  ),
  busted_at timestamptz,
  current_chips bigint,                             -- bigint: WSOP $50K stacks exceed int4

  joined_at timestamptz not null default now(),

  unique (pool_id, user_id)
);

create index idx_pool_members_pool on pool_members(pool_id);
create index idx_pool_members_user on pool_members(user_id);
create index idx_pool_members_alive on pool_members(pool_id) where status = 'alive';
create index idx_pool_members_busted on pool_members(pool_id, busted_at) where status = 'busted';
```

**Bust order is computed at read time**, not stored. Avoids race conditions on concurrent busts and removes the renumber-on-unbust path:

```sql
select id, display_name,
       row_number() over (partition by pool_id order by busted_at asc) as bust_order
from pool_members
where pool_id = $1 and status = 'busted';
```

### `pool_audit_log`

```sql
create table pool_audit_log (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  member_id uuid references pool_members(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in ('joined', 'verified', 'unverified', 'busted', 'unbusted', 'no_show',
               'pool_locked', 'pool_started', 'pool_ended', 'pool_cancelled',
               'winner_declared')
  ),
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_audit_pool on pool_audit_log(pool_id, created_at desc);
```

**Audit log writes happen at the API/app layer**, not via Postgres triggers — keeps HTTP context (actor, reason, etc.) accessible. Service role used for inserts.

Chip count updates are NOT logged.

### `user_schedule` migration

```sql
alter table user_schedule add column source text not null default 'manual';
-- After deploy + verify, optionally:
-- alter table user_schedule alter column source drop default;
```

`source` values: `'manual'` (user added themselves) or `'pool:{pool_id}'` (auto-added on pool join).

### Deleted-user handling

All user FK columns (`organizer_id`, `pool_members.user_id`, `actor_id`) use `ON DELETE SET NULL`. UI renders null as **"Former player"** / **"Former organizer"**. Audit log entries survive intact.

---

## Lifecycle / State Machine

```
  draft ──────► open ─────► locked ─────► live ─────► ended
                  │             │            │
                  └─────────────┴────────────┴────────► cancelled
```

| From | To | Trigger | Who |
|---|---|---|---|
| draft | open | Publish | Organizer |
| open | locked | Manual lock | Organizer |
| locked | live | Manual or auto at tournament start_time | Organizer (auto fallback) |
| live | ended | Winner declared | Organizer |
| any non-ended | cancelled | Source tournament cancelled OR manual | System (auto) / Organizer |

**Auto-cancel rule:** If `tournaments.status` flips to `cancelled`, all related pools auto-transition to `cancelled` and email all members.

**v1 simplification:** Pools spawn directly into `open`; `draft` is a schema-reserved state for future use. Chip/bust updates allowed in both `locked` and `live`.

---

## Rules: Re-entry, Start Point, Multi-flight

All three are organizer-configured on the pool row and honored **manually** in v1 — no auto-detection against tournament structure data.

### Re-entries
- `reentries_keep_alive = true` (default): A re-entered player can be marked `alive` again. Self-report ("I re-entered") or organizer un-bust.
- `reentries_keep_alive = false`: First bust is final. "I busted" self-report is irreversible except via organizer un-bust.

### Pool start point
- `start_after_reentry_period = false` (default): Tracking from tournament start.
- `start_after_reentry_period = true`: UI banner: "Tracking starts after re-entry period closes." Organizer manually flips "tracking active" when ready. Bust-outs reported before this don't count.

### Multi-flight events
- `multiflight_out_rule = 'last_flight'` (default): Member is "out" only after busting all flights.
- `multiflight_out_rule = 'first_flight'`: First flight bust = out.

The pool config chip on the dashboard tells everyone how to handle it; bust-out reporting itself is manual either way.

---

## Tournament Picker — Day 2 Restart Filter

When the organizer picks a tournament for a new pool, exclude continuation rows via this heuristic:

```sql
where buy_in > 0
  and name not ilike '%restart%'
  and name not ilike '%day 2%'
```

This is a v1 heuristic. Long-term, add an `is_continuation` boolean to `tournaments` and backfill. Tracked as a follow-up, not in v1 scope.

---

## Custom Tournament Ownership

When `pool_type = 'home_game'`:

- Server validates: `pools.organizer_id = custom_tournaments.created_by`
- Returns 403 if mismatched
- Prevents users from creating pools tied to someone else's home game

Enforced in the `POST /api/pools` handler. Add a comment in the SQL but no DB constraint.

---

## Permissions / RLS

### Pool visibility
- **Members** (rows in `pool_members`): read full pool.
- **Holders of valid `invite_token`**: read pool metadata (name, tournament, member count) for the join page. Not full member list.
- **Logged-out users**: same as token holders — must hit join page via token to see anything.

### Pool members table
- **Members of same pool**: read all rows (including `verified` flag).
- **Self**: update own `current_chips`, `status` (alive → busted only), `display_name`.
- **Organizer**: full CRUD on member rows in their pool.

### Audit log
- **All pool members**: read.
- **Service role only**: insert (from API routes).

---

## API Surface

All routes use Supabase auth except where marked Public.

### Pools

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/pools` | Required | Create pool. Validates home-game ownership. Returns pool + invite_token. |
| GET | `/api/pools/:id` | Member | Full pool detail + member list (with resolved display names). |
| GET | `/api/pools/by-token/:token` | Public | Join-page metadata only. |
| PATCH | `/api/pools/:id` | Organizer | Update name + display rules. **Cannot change tournament.** |
| POST | `/api/pools/:id/lock` | Organizer | `open → locked`. |
| POST | `/api/pools/:id/start` | Organizer | `locked → live`. |
| POST | `/api/pools/:id/declare-winner` | Organizer | Body: `member_id`. Transitions to `ended`. |
| POST | `/api/pools/:id/cancel` | Organizer | Manual cancel. |
| POST | `/api/pools/:id/rotate-token` | Organizer | Regenerate invite_token. |

### Members

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/pools/by-token/:token/join` | Required | Add caller as member. Auto-add to user_schedule **only if pool_type = 'official'**. |
| PATCH | `/api/pools/:id/members/:member_id` | Self or Organizer | Update display_name, chips, status (self: alive→busted only). |
| POST | `/api/pools/:id/members/:member_id/verify` | Organizer | Toggle verified true. |
| POST | `/api/pools/:id/members/:member_id/unverify` | Organizer | Toggle verified false. |
| POST | `/api/pools/:id/members/:member_id/bust` | Self or Organizer | Mark busted + set busted_at. |
| POST | `/api/pools/:id/members/:member_id/unbust` | **Organizer only** | Revert bust. |
| POST | `/api/pools/:id/members/:member_id/no-show` | Organizer | Mark as no_show. |
| DELETE | `/api/pools/:id/members/:member_id` | Organizer or self (leave) | Remove member. Conditionally remove from schedule. |

### URL conventions
- Public join page: `/pools/join/:token`
- API for join page metadata: `/api/pools/by-token/:token`
- API for join action: `/api/pools/by-token/:token/join`

### Rate limits
- `PATCH .../members/:id` chip updates: **max 1/minute per member**.
- `POST .../join`: max 5/min per IP.
- **Implementation:** Next.js middleware + in-memory LRU. Single-region OK for v1. Upgrade path: Upstash Redis.

---

## UI Flows

### A. Create pool
1. From a tournament page → "Create Last Longer Pool" button. Also from a custom tournament page if user owns it.
2. Modal:
   - Pool name (default: `{Tournament} Last Longer`)
   - Re-entries keep you alive? Yes/No toggle
   - Start tracking: At tournament start / After re-entry period closes
   - Multi-flight: First flight bust / Last flight bust
3. Submit → redirect to pool dashboard with invite link prominent.

### B. Join via invite link
1. URL: `/pools/join/:token`
2. Logged out → "Join this pool — sign in or create an account" (email-only signup, no profile required).
3. Logged in → "Join {Pool Name} — {Tournament}" + confirm button.
4. On join:
   - Insert `pool_member` row
   - If `pool_type = 'official'`: insert `user_schedule` row with `source = 'pool:{pool_id}'` (idempotent — no-op if already present)
   - If `pool_type = 'home_game'`: skip schedule add, show toast "Home games aren't added to your schedule"
   - Redirect to pool dashboard

### C. Pool dashboard (member view)
- Header: pool name, tournament link, status badge, member count alive/total.
- Rules summary chip: e.g., "Re-entries: alive · Multi-flight: last flight · Tracking from rebuy close"
- **Leaderboard table:** display_name | chips | status (Alive 🟢 / Busted ⚫ / No-show ⚪) | verified badge (✓ / "Unverified")
  - Sort: alive first (by chips desc), then busted (by busted_at desc), then no_show
  - Bust order rendered live via window function
- Self row sticky at top: update chips, "I busted" button.
- Organizer rows have inline controls: chips, verify toggle, un-bust, no-show, reorder bust position (via editing busted_at).
- Bottom: audit log feed (collapsed by default).

### D. Organizer-only actions panel
- Lock pool / Start pool / Declare winner / Cancel pool
- Rotate invite token + copy link
- Per-member verify toggle

### E. Declare winner flow
- "Declare Winner" button → modal lists `alive` members first, then all (for chop / multi-survivor scenarios).
- Select one → confirm → transitions to `ended` + logs `winner_declared`.

### F. Leaving / removing a member
- Self-leave: confirm modal. If schedule was pool-sourced, ask "Also remove from your schedule?" (default checked).
- Organizer-remove: confirm modal. Schedule entry removed only if `source = 'pool:{this_pool_id}'`.

---

## Anti-abuse

- `invite_token`: 32-byte random (256 bits), base64url-encoded.
- Unique constraint `(pool_id, user_id)` prevents double-join.
- Chip update rate limit: 1/min per member (middleware).
- Join rate limit: 5/min per IP.
- Custom tournament ownership check (server-side) prevents hijacking home games.

---

## Notifications (v1: minimal)

- **Email only**, via Resend (`src/lib/email.ts`).
- **Pool cancelled** (source tournament cancelled) → email all members.
- **Winner declared** → email all members.
- **No notifications** for: join, bust, chip updates, verify changes. Organizer checks dashboard.

---

## Deferred (NOT in v1)

- Real-time updates (use ~30s polling on leaderboard page)
- Push notifications
- Organizer-on-join notifications (decided: dashboard-only)
- Multi-event pools
- Public/discoverable pools
- Pool comments / chat
- P&L tracking from pool history
- Side wagers integration with trip budget
- Auto-detection of re-entries / flight progression / rebuy period close
- Time-series chip count history
- Mid-pool tournament reassignment
- `is_continuation` column on tournaments (currently heuristic-filtered)

---

## Build order

1. **Migrations**
   - `ALTER TABLE user_schedule ADD COLUMN source`
   - Create `pool_members`
   - Create `pools` (no winner FK yet)
   - `ALTER TABLE pools ADD COLUMN winner_member_id`
   - Create `pool_audit_log`
   - RLS policies + indexes
2. **Pool CRUD API** — create (with home-game ownership check), fetch, lock, cancel, rotate token.
3. **Join flow** — token route + auth gate + conditional schedule auto-add.
4. **Member status API** — bust, unbust, verify, chips, display_name.
5. **Pool dashboard UI** — leaderboard with computed bust_order, member view, organizer panel.
6. **Declare winner + ended state.**
7. **Auto-cancel hook** — trigger or scheduled check on `tournaments.status = 'cancelled'`.
8. **Email notifications** (cancel + winner only) via Resend.
9. **Rate limiting middleware + token rotation.**
10. **Audit log feed in UI** (read-only).

---

## Implementation notes

- **Bust order:** computed via window function at read time. Never stored.
- **Display name:** resolved via fallback chain in a TS helper or Postgres view. Two members can share a display_name; UI handles disambiguation.
- **Schedule integration:** official tournaments only. Home games skip auto-add and surface a toast/note.
- **Custom tournament ownership:** validated in `POST /api/pools` handler when `pool_type = 'home_game'`.
- **Day 2 Restart filter:** heuristic on tournament picker (`buy_in > 0 AND name NOT ILIKE`). Plan a proper `is_continuation` column post-v1.
- **Audit log:** app-level inserts using service role. Captures HTTP context cleanly.
- **Deleted users:** all user FKs use `ON DELETE SET NULL`. UI renders nulls as "Former player" / "Former organizer".
