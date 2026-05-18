# Last Longer Pools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Last Longer Pools" feature where a poker tournament organizer creates an honor-system pool, shares an invite link, and tracks bust-outs to declare a winner.

**Architecture:** Three new Postgres tables (`pools`, `pool_members`, `pool_audit_log`) with strict RLS, a Next.js API surface under `/api/pools`, a public join page, and a member-only pool dashboard. All user FKs use `ON DELETE SET NULL`. Bust order is computed at read time via a window function — never stored. Email notifications (cancel + winner) via the existing Resend helper. Rate limiting via Next.js middleware with an in-memory LRU. No test runner is configured in this repo; verification is via `npx tsc --noEmit`, `npm run lint`, and manual curl/UI checks.

**Tech Stack:** Next.js 16 (App Router) + TypeScript strict, Supabase (Postgres + Auth + RLS), Resend (transactional email), shadcn/ui + Tailwind v4.

**Reference:** Spec at `docs/superpowers/specs/2026-05-17-last-longer-pools-design.md`.

---

## File Map

**New files**
- `supabase/migrations/20260517_add_user_schedule_source.sql` — adds `source` column to `user_schedule`.
- `supabase/migrations/20260517_create_pools_tables.sql` — creates `pools`, `pool_members`, `pool_audit_log` + RLS + indexes.
- `src/lib/pool-utils.ts` — `generateInviteToken`, `resolveDisplayName`, `writeAuditLog` helper.
- `src/app/api/pools/route.ts` — POST create pool.
- `src/app/api/pools/[id]/route.ts` — GET detail + PATCH metadata.
- `src/app/api/pools/[id]/lock/route.ts` — POST `open → locked`.
- `src/app/api/pools/[id]/start/route.ts` — POST `locked → live`.
- `src/app/api/pools/[id]/cancel/route.ts` — POST manual cancel.
- `src/app/api/pools/[id]/declare-winner/route.ts` — POST `live → ended`.
- `src/app/api/pools/[id]/rotate-token/route.ts` — POST regenerate invite token.
- `src/app/api/pools/by-token/[token]/route.ts` — GET public join-page metadata.
- `src/app/api/pools/by-token/[token]/join/route.ts` — POST join (+ schedule auto-add).
- `src/app/api/pools/[id]/members/[memberId]/route.ts` — PATCH self/organizer fields, DELETE leave/kick.
- `src/app/api/pools/[id]/members/[memberId]/bust/route.ts` — POST mark busted.
- `src/app/api/pools/[id]/members/[memberId]/unbust/route.ts` — POST organizer-only revert.
- `src/app/api/pools/[id]/members/[memberId]/verify/route.ts` — POST set `verified=true`.
- `src/app/api/pools/[id]/members/[memberId]/unverify/route.ts` — POST set `verified=false`.
- `src/app/api/pools/[id]/members/[memberId]/no-show/route.ts` — POST mark `no_show`.
- `src/app/pools/page.tsx` — list of pools the user is a member of.
- `src/app/pools/[id]/page.tsx` — pool dashboard.
- `src/app/pools/join/[token]/page.tsx` — public join page.
- `src/components/pool-create-modal.tsx` — create-pool modal.
- `src/components/pool-leaderboard.tsx` — leaderboard table (alive → busted → no_show).
- `src/components/pool-audit-feed.tsx` — read-only collapsed feed.
- `src/components/pool-organizer-panel.tsx` — lock / start / cancel / declare / rotate token.
- `src/hooks/use-pool.ts` — fetch + mutate one pool.
- `src/hooks/use-my-pools.ts` — list pools for current user.

**Modified files**
- `src/types/index.ts` — add `Pool`, `PoolMember`, `PoolAuditLog`, `PoolStatus`, `PoolMemberStatus`, `PoolType`, `MultiFlightOutRule` types. Extend `UserScheduleEntry`-related types with optional `source` field.
- `src/lib/email.ts` — add `sendPoolCancelledEmail` and `sendPoolWinnerEmail`.
- `src/middleware.ts` — add rate-limiting layer for pool routes.
- `src/app/tournament/[id]/page.tsx` — "Create Last Longer Pool" CTA.
- `src/app/custom/[id]/page.tsx` (if exists) or the custom-tournament detail view — same CTA gated on ownership.
- `src/app/api/cron/monitor-schedules/route.ts` — call auto-cancel helper when a tournament is detected as cancelled.

---

## Conventions

**Auth pattern (use this everywhere):**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ...
}
```

**Service-role pattern** (for audit log inserts that must bypass RLS):

```typescript
import { createServiceClient } from '@/lib/supabase/service'
const svc = createServiceClient()
await svc.from('pool_audit_log').insert({ ... })
```

**Commit hygiene:** every task ends in a commit. Use full file paths in `git add`. Each commit gets a co-author line.

```bash
git commit -m "$(cat <<'EOF'
<subject>

<body>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation commands (no test runner configured):**

```bash
npx tsc --noEmit          # typecheck
npm run lint              # eslint
```

---

## Task 1: Migrations — schedule source column + pools schema

**Files:**
- Create: `supabase/migrations/20260517_add_user_schedule_source.sql`
- Create: `supabase/migrations/20260517_create_pools_tables.sql`

### Steps

- [ ] **Step 1.1: Write the `user_schedule.source` migration**

Create `supabase/migrations/20260517_add_user_schedule_source.sql` with:

```sql
-- Add source column to user_schedule.
-- Values: 'manual' (user added themselves) or 'pool:<pool_id>' (auto-added on pool join).
ALTER TABLE user_schedule
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
```

- [ ] **Step 1.2: Write the pools schema migration**

Create `supabase/migrations/20260517_create_pools_tables.sql` with:

```sql
-- =====================================================================
-- Last Longer Pools — schema, indexes, RLS
-- =====================================================================

-- pool_members must exist BEFORE pools.winner_member_id FK is added.
-- The FK is added at the end of the file via ALTER TABLE.

-- ---------------------------------------------------------------------
-- pool_members (created first; pool_id FK added after pools exists)
-- ---------------------------------------------------------------------
CREATE TABLE pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL,                                 -- FK added below
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  display_name TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'alive'
    CHECK (status IN ('alive', 'busted', 'no_show')),
  busted_at TIMESTAMPTZ,
  current_chips BIGINT,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (pool_id, user_id)
);

CREATE INDEX idx_pool_members_pool ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user ON pool_members(user_id);
CREATE INDEX idx_pool_members_alive ON pool_members(pool_id) WHERE status = 'alive';
CREATE INDEX idx_pool_members_busted ON pool_members(pool_id, busted_at) WHERE status = 'busted';

-- ---------------------------------------------------------------------
-- pools
-- ---------------------------------------------------------------------
CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  custom_tournament_id UUID REFERENCES custom_tournaments(id) ON DELETE SET NULL,
  pool_type TEXT NOT NULL DEFAULT 'official'
    CHECK (pool_type IN ('official', 'home_game')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'locked', 'live', 'ended', 'cancelled')),

  reentries_keep_alive BOOLEAN NOT NULL DEFAULT TRUE,
  start_after_reentry_period BOOLEAN NOT NULL DEFAULT FALSE,
  multiflight_out_rule TEXT NOT NULL DEFAULT 'last_flight'
    CHECK (multiflight_out_rule IN ('first_flight', 'last_flight')),

  invite_token TEXT NOT NULL UNIQUE,
  winner_member_id UUID,                                 -- FK added below
  ended_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pool_has_one_tournament CHECK (
    (tournament_id IS NOT NULL)::int + (custom_tournament_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT pool_type_matches_fk CHECK (
    (pool_type = 'official' AND tournament_id IS NOT NULL) OR
    (pool_type = 'home_game' AND custom_tournament_id IS NOT NULL)
  )
);

CREATE INDEX idx_pools_organizer ON pools(organizer_id);
CREATE INDEX idx_pools_tournament ON pools(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_pools_invite_token ON pools(invite_token);

-- Now add the FKs that close the cycle.
ALTER TABLE pool_members
  ADD CONSTRAINT pool_members_pool_id_fkey
  FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;

ALTER TABLE pools
  ADD CONSTRAINT pools_winner_member_id_fkey
  FOREIGN KEY (winner_member_id) REFERENCES pool_members(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- pool_audit_log
-- ---------------------------------------------------------------------
CREATE TABLE pool_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  member_id UUID REFERENCES pool_members(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'joined', 'verified', 'unverified', 'busted', 'unbusted', 'no_show',
    'pool_locked', 'pool_started', 'pool_ended', 'pool_cancelled',
    'winner_declared'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_pool ON pool_audit_log(pool_id, created_at DESC);

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_audit_log ENABLE ROW LEVEL SECURITY;

-- A user is a member of a pool if they have a row in pool_members for that pool.
-- We use a helper function to keep policies readable and avoid recursion.
CREATE OR REPLACE FUNCTION is_pool_member(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pool_members
    WHERE pool_id = _pool_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_pool_organizer(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pools
    WHERE id = _pool_id AND organizer_id = _user_id
  );
$$;

-- ---- pools ----
CREATE POLICY "members read their pools" ON pools
  FOR SELECT USING (is_pool_member(id, auth.uid()));

CREATE POLICY "organizer writes pool" ON pools
  FOR UPDATE USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "anyone inserts as organizer" ON pools
  FOR INSERT WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "organizer deletes pool" ON pools
  FOR DELETE USING (organizer_id = auth.uid());

-- ---- pool_members ----
CREATE POLICY "members read fellow members" ON pool_members
  FOR SELECT USING (is_pool_member(pool_id, auth.uid()));

CREATE POLICY "self insert as member" ON pool_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "self update own status/chips/name" ON pool_members
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "organizer updates any member" ON pool_members
  FOR UPDATE USING (is_pool_organizer(pool_id, auth.uid()))
  WITH CHECK (is_pool_organizer(pool_id, auth.uid()));

CREATE POLICY "self or organizer deletes member" ON pool_members
  FOR DELETE USING (user_id = auth.uid() OR is_pool_organizer(pool_id, auth.uid()));

-- ---- pool_audit_log ----
-- All members can read; no client-side inserts (use service role).
CREATE POLICY "members read audit log" ON pool_audit_log
  FOR SELECT USING (is_pool_member(pool_id, auth.uid()));
```

- [ ] **Step 1.3: Apply migrations to the Supabase project**

Apply via Supabase MCP `apply_migration` calls (one per file). Project id: `ecultkmiqtdwkbtixjbk`. Migration names: `add_user_schedule_source` and `create_pools_tables`. If running locally with the Supabase CLI, `supabase db reset` against a dev branch.

- [ ] **Step 1.4: Verify schema applied**

Run a quick SQL probe to confirm tables and constraints exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('pools', 'pool_members', 'pool_audit_log');
-- Expected: 3 rows.

SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_schedule' AND column_name = 'source';
-- Expected: 1 row.
```

- [ ] **Step 1.5: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add \
  supabase/migrations/20260517_add_user_schedule_source.sql \
  supabase/migrations/20260517_create_pools_tables.sql
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add migrations for last longer pools

Three new tables: pools, pool_members, pool_audit_log. All user
FKs use ON DELETE SET NULL so account deletion preserves history.
pool_members.pool_id FK is added after pools is created to break
the cycle with winner_member_id. Bust order is not stored; it is
computed at read time via row_number() ordered by busted_at.

Also adds source column to user_schedule to track whether a row
was added manually or via a pool join.

RLS policies: pool members read their pool and fellow members,
organizers write the pool row and any member row, self updates
own status/chips/display_name only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TypeScript types for pools

**Files:**
- Modify: `src/types/index.ts`

### Steps

- [ ] **Step 2.1: Append pool types to `src/types/index.ts`**

Add these declarations at the bottom of the file (after `SERIES_COLORS`):

```typescript
// ---------------------------------------------------------------------
// Last Longer Pools
// ---------------------------------------------------------------------

export type PoolStatus = 'draft' | 'open' | 'locked' | 'live' | 'ended' | 'cancelled'
export type PoolType = 'official' | 'home_game'
export type MultiFlightOutRule = 'first_flight' | 'last_flight'
export type PoolMemberStatus = 'alive' | 'busted' | 'no_show'
export type PoolAuditAction =
  | 'joined' | 'verified' | 'unverified' | 'busted' | 'unbusted' | 'no_show'
  | 'pool_locked' | 'pool_started' | 'pool_ended' | 'pool_cancelled'
  | 'winner_declared'

export interface Pool {
  id: string
  organizer_id: string | null
  tournament_id: string | null
  custom_tournament_id: string | null
  pool_type: PoolType
  name: string
  status: PoolStatus
  reentries_keep_alive: boolean
  start_after_reentry_period: boolean
  multiflight_out_rule: MultiFlightOutRule
  invite_token: string
  winner_member_id: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface PoolMember {
  id: string
  pool_id: string
  user_id: string | null
  display_name: string | null
  verified: boolean
  status: PoolMemberStatus
  busted_at: string | null
  current_chips: number | null
  joined_at: string
  // resolved fields (server-side joined)
  resolved_display_name?: string
  bust_order?: number | null
}

export interface PoolAuditEntry {
  id: string
  pool_id: string
  member_id: string | null
  actor_id: string | null
  action: PoolAuditAction
  metadata: Record<string, unknown>
  created_at: string
}

export interface PoolDetail extends Pool {
  tournament?: Tournament | null
  custom_tournament?: CustomTournament | null
  members: PoolMember[]
  alive_count: number
  total_count: number
  is_organizer: boolean
}
```

- [ ] **Step 2.2: Run typecheck**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit
```

Expected: exit 0. (`CustomTournament` and `Tournament` are already exported from this file.)

- [ ] **Step 2.3: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/types/index.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add TypeScript types for last longer pools

Pool, PoolMember, PoolAuditEntry plus union types for status,
member status, audit action, and pool/multiflight rules. PoolDetail
is the server response shape with joined tournament + members.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Pool utility module — token, display name, audit logger

**Files:**
- Create: `src/lib/pool-utils.ts`

### Steps

- [ ] **Step 3.1: Create `src/lib/pool-utils.ts`**

```typescript
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoolAuditAction, PoolMember } from '@/types'

/**
 * Cryptographically random invite token, 256 bits, base64url-encoded.
 * Length: 43 chars.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Resolve a member's display name using the fallback chain:
 *   1. pool_members.display_name (per-pool override)
 *   2. auth user metadata: full_name
 *   3. auth user metadata: name
 *   4. Email local-part (everything before '@')
 *   5. "Former player" (user was deleted)
 *
 * `user` is the joined row from auth.users — but auth.users is not exposed
 * to anon Postgres clients, so the caller must fetch via service role.
 */
export interface AuthUserShape {
  email?: string | null
  raw_user_meta_data?: Record<string, unknown> | null
}

export function resolveDisplayName(member: Pick<PoolMember, 'display_name' | 'user_id'>, user?: AuthUserShape | null): string {
  if (member.display_name) return member.display_name
  if (user?.raw_user_meta_data) {
    const meta = user.raw_user_meta_data
    if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name
    if (typeof meta.name === 'string' && meta.name.trim()) return meta.name
  }
  if (user?.email) return user.email.split('@')[0]
  return 'Former player'
}

/**
 * Write a single audit log entry. Must be called with a service-role client
 * because the pool_audit_log RLS denies all client inserts.
 */
export async function writeAuditLog(
  svc: SupabaseClient,
  args: {
    pool_id: string
    member_id?: string | null
    actor_id: string | null
    action: PoolAuditAction
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await svc.from('pool_audit_log').insert({
    pool_id: args.pool_id,
    member_id: args.member_id ?? null,
    actor_id: args.actor_id,
    action: args.action,
    metadata: args.metadata ?? {},
  })
  if (error) {
    // Never block the main operation on audit logging — log to stderr.
    console.error('[pool-audit] insert failed', error.message, { ...args, metadata: undefined })
  }
}

/**
 * Compute bust_order for an array of members. 1 = first out, ascending busted_at.
 * Alive and no_show members get null. Mutates and returns the same array (sorted
 * with alive first, then busted by order, then no_show).
 */
export function annotateBustOrder(members: PoolMember[]): PoolMember[] {
  const busted = members
    .filter(m => m.status === 'busted' && m.busted_at)
    .sort((a, b) => (a.busted_at! < b.busted_at! ? -1 : 1))
  busted.forEach((m, i) => { m.bust_order = i + 1 })

  return members.map(m => {
    if (m.status !== 'busted') m.bust_order = null
    return m
  })
}
```

- [ ] **Step 3.2: Verify a service-role client helper exists**

Inspect `src/lib/supabase/service.ts`. If the file already exports a callable like `createServiceClient()`, no change needed. If it does not, create it with:

```typescript
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
```

- [ ] **Step 3.3: Typecheck**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/lib/pool-utils.ts
# also add src/lib/supabase/service.ts if it was created in step 3.2
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool utility module

generateInviteToken returns 256 bits of base64url randomness.
resolveDisplayName implements the four-step fallback chain.
writeAuditLog inserts via service role and swallows errors so
audit writes never block the main operation. annotateBustOrder
attaches the read-time bust_order rank to each member.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API — POST /api/pools (create)

**Files:**
- Create: `src/app/api/pools/route.ts`

### Steps

- [ ] **Step 4.1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateInviteToken, writeAuditLog } from '@/lib/pool-utils'
import type { MultiFlightOutRule, PoolType } from '@/types'

interface CreatePoolBody {
  name: string
  pool_type: PoolType
  tournament_id?: string | null
  custom_tournament_id?: string | null
  reentries_keep_alive?: boolean
  start_after_reentry_period?: boolean
  multiflight_out_rule?: MultiFlightOutRule
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreatePoolBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (body.pool_type !== 'official' && body.pool_type !== 'home_game') {
    return NextResponse.json({ error: 'pool_type must be official or home_game' }, { status: 400 })
  }
  const hasTournament = !!body.tournament_id
  const hasCustom = !!body.custom_tournament_id
  if (hasTournament === hasCustom) {
    return NextResponse.json({ error: 'Supply exactly one of tournament_id or custom_tournament_id' }, { status: 400 })
  }
  if (body.pool_type === 'official' && !hasTournament) {
    return NextResponse.json({ error: 'official pools require tournament_id' }, { status: 400 })
  }
  if (body.pool_type === 'home_game' && !hasCustom) {
    return NextResponse.json({ error: 'home_game pools require custom_tournament_id' }, { status: 400 })
  }

  // Home game ownership check: organizer must own the custom_tournament.
  if (body.pool_type === 'home_game') {
    const { data: ct } = await supabase
      .from('custom_tournaments')
      .select('created_by')
      .eq('id', body.custom_tournament_id!)
      .maybeSingle()
    if (!ct) return NextResponse.json({ error: 'Custom tournament not found' }, { status: 404 })
    if (ct.created_by !== user.id) {
      return NextResponse.json({ error: 'You do not own this home game' }, { status: 403 })
    }
  }

  // Reject continuation rows (Day 2 Restart, $0 buy-in, name pattern).
  if (body.pool_type === 'official') {
    const { data: t } = await supabase
      .from('tournaments')
      .select('buy_in, name')
      .eq('id', body.tournament_id!)
      .maybeSingle()
    if (!t) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    const nameLower = t.name.toLowerCase()
    if (t.buy_in === 0 || nameLower.includes('restart') || nameLower.includes('day 2')) {
      return NextResponse.json({ error: 'Pools must attach to a parent event, not a continuation row' }, { status: 400 })
    }
  }

  const invite_token = generateInviteToken()
  const insertRow = {
    organizer_id: user.id,
    tournament_id: body.tournament_id ?? null,
    custom_tournament_id: body.custom_tournament_id ?? null,
    pool_type: body.pool_type,
    name: body.name.trim().slice(0, 200),
    status: 'open' as const,
    reentries_keep_alive: body.reentries_keep_alive ?? true,
    start_after_reentry_period: body.start_after_reentry_period ?? false,
    multiflight_out_rule: body.multiflight_out_rule ?? 'last_flight',
    invite_token,
  }

  const { data: pool, error } = await supabase
    .from('pools')
    .insert(insertRow)
    .select()
    .single()
  if (error || !pool) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  const svc = createServiceClient()
  await writeAuditLog(svc, {
    pool_id: pool.id,
    actor_id: user.id,
    action: 'joined',
    metadata: { reason: 'pool_created', organizer: true },
  })

  return NextResponse.json(pool, { status: 201 })
}
```

- [ ] **Step 4.2: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

Expected: both exit 0.

- [ ] **Step 4.3: Manual verification (skip if local dev server isn't trivial to spin up)**

Hit the endpoint with a logged-in session cookie present. Sample shell:

```bash
curl -sS -X POST https://YOUR-DEPLOY/api/pools \
  -H 'Content-Type: application/json' \
  --cookie "sb-access-token=<token>" \
  -d '{"name":"Test pool","pool_type":"official","tournament_id":"<a real id>"}'
```

Expected: 201 with the inserted pool row including `invite_token`.

- [ ] **Step 4.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/api/pools/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add POST /api/pools to create a pool

Validates: required fields, exactly one of tournament_id or
custom_tournament_id, home-game ownership (organizer must own the
custom_tournament), and that the referenced tournament is not a
Day 2 Restart or $0 continuation row. Generates a 256-bit invite
token. Inserts an initial audit log entry on success.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: API — GET pool by id, GET pool by token, PATCH pool

**Files:**
- Create: `src/app/api/pools/[id]/route.ts`
- Create: `src/app/api/pools/by-token/[token]/route.ts`

### Steps

- [ ] **Step 5.1: Create `src/app/api/pools/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { annotateBustOrder, resolveDisplayName } from '@/lib/pool-utils'
import type { PoolDetail, PoolMember } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool, error } = await supabase
    .from('pools')
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue)), custom_tournament:custom_tournament_id(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members, error: memErr } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', id)
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  // Resolve display names via service role (auth.users isn't queryable by anon).
  const svc = createServiceClient()
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]
  const userMap = new Map<string, { email: string | null; raw_user_meta_data: Record<string, unknown> | null }>()
  if (userIds.length > 0) {
    const { data: authUsers } = await svc.auth.admin.listUsers({ perPage: 1000 })
    for (const u of authUsers?.users ?? []) {
      if (userIds.includes(u.id)) {
        userMap.set(u.id, { email: u.email ?? null, raw_user_meta_data: (u.user_metadata as Record<string, unknown>) ?? null })
      }
    }
  }
  const enrichedMembers: PoolMember[] = (members ?? []).map(m => ({
    ...m,
    resolved_display_name: resolveDisplayName(m, m.user_id ? userMap.get(m.user_id) : null),
  }))
  annotateBustOrder(enrichedMembers)

  const detail: PoolDetail = {
    ...pool,
    members: enrichedMembers,
    alive_count: enrichedMembers.filter(m => m.status === 'alive').length,
    total_count: enrichedMembers.length,
    is_organizer: pool.organizer_id === user.id,
  }
  return NextResponse.json(detail)
}

interface PatchBody {
  name?: string
  reentries_keep_alive?: boolean
  start_after_reentry_period?: boolean
  multiflight_out_rule?: 'first_flight' | 'last_flight'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 200)
  if (typeof body.reentries_keep_alive === 'boolean') update.reentries_keep_alive = body.reentries_keep_alive
  if (typeof body.start_after_reentry_period === 'boolean') update.start_after_reentry_period = body.start_after_reentry_period
  if (body.multiflight_out_rule === 'first_flight' || body.multiflight_out_rule === 'last_flight') {
    update.multiflight_out_rule = body.multiflight_out_rule
  }

  const { data, error } = await supabase
    .from('pools')
    .update(update)
    .eq('id', id)
    .eq('organizer_id', user.id)              // belt-and-suspenders even with RLS
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or not organizer' }, { status: 404 })
  return NextResponse.json(data)
}
```

- [ ] **Step 5.2: Create `src/app/api/pools/by-token/[token]/route.ts` (public metadata for the join page)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const svc = createServiceClient()
  const { data: pool } = await svc
    .from('pools')
    .select('id, name, pool_type, status, tournament:tournament_id(name, date, venue:series_id(venue)), custom_tournament:custom_tournament_id(name, date)')
    .eq('invite_token', token)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'cancelled' || pool.status === 'ended') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 410 })
  }

  const { count: memberCount } = await svc
    .from('pool_members')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', pool.id)

  return NextResponse.json({
    id: pool.id,
    name: pool.name,
    pool_type: pool.pool_type,
    status: pool.status,
    tournament: pool.tournament,
    custom_tournament: pool.custom_tournament,
    member_count: memberCount ?? 0,
  })
}
```

- [ ] **Step 5.3: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

Expected: exit 0.

- [ ] **Step 5.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/api/pools/[id]/route.ts src/app/api/pools/by-token/[token]/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add GET and PATCH for pool detail, plus public token route

GET /api/pools/:id returns the pool with joined tournament,
member list (display names resolved via service role admin
listUsers, bust order computed at read time), and is_organizer
flag for the caller.

PATCH /api/pools/:id lets the organizer change name and rule
toggles; tournament cannot change.

GET /api/pools/by-token/:token is public — used by the join page
to render pool name, tournament, and member count without leaking
member identities.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Pool lifecycle endpoints — lock, start, cancel, declare-winner, rotate-token

**Files:**
- Create: `src/app/api/pools/[id]/lock/route.ts`
- Create: `src/app/api/pools/[id]/start/route.ts`
- Create: `src/app/api/pools/[id]/cancel/route.ts`
- Create: `src/app/api/pools/[id]/declare-winner/route.ts`
- Create: `src/app/api/pools/[id]/rotate-token/route.ts`

Each route follows the same pattern: load user → load pool → check `pool.organizer_id === user.id` → validate state transition → update → audit log.

### Steps

- [ ] **Step 6.1: Create a shared lifecycle helper**

Add at the top of `src/lib/pool-utils.ts`:

```typescript
import type { PoolStatus } from '@/types'

const ALLOWED_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  draft:     ['open', 'cancelled'],
  open:      ['locked', 'cancelled'],
  locked:    ['live', 'cancelled'],
  live:      ['ended', 'cancelled'],
  ended:     [],
  cancelled: [],
}

export function canTransition(from: PoolStatus, to: PoolStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

- [ ] **Step 6.2: Create `src/app/api/pools/[id]/lock/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canTransition, writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'locked')) {
    return NextResponse.json({ error: `Cannot lock from status ${pool.status}` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('pools')
    .update({ status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, actor_id: user.id, action: 'pool_locked',
  })
  return NextResponse.json(data)
}
```

- [ ] **Step 6.3: Create `src/app/api/pools/[id]/start/route.ts`**

Identical pattern. Replace target status `locked` → `live`, audit action → `pool_started`, error wording.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canTransition, writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'live')) {
    return NextResponse.json({ error: `Cannot start from status ${pool.status}` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('pools')
    .update({ status: 'live', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), { pool_id: id, actor_id: user.id, action: 'pool_started' })
  return NextResponse.json(data)
}
```

- [ ] **Step 6.4: Create `src/app/api/pools/[id]/cancel/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canTransition, writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'cancelled')) {
    return NextResponse.json({ error: `Pool already in terminal status ${pool.status}` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('pools')
    .update({ status: 'cancelled', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, actor_id: user.id, action: 'pool_cancelled', metadata: { reason: 'organizer_cancel' },
  })
  return NextResponse.json(data)
}
```

- [ ] **Step 6.5: Create `src/app/api/pools/[id]/declare-winner/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canTransition, writeAuditLog } from '@/lib/pool-utils'

interface Body { member_id: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'ended')) {
    return NextResponse.json({ error: `Cannot declare winner from status ${pool.status}` }, { status: 409 })
  }

  // Confirm the member belongs to this pool.
  const { data: member } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', id)
    .eq('id', body.member_id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not in this pool' }, { status: 400 })

  const { data, error } = await supabase
    .from('pools')
    .update({
      status: 'ended',
      winner_member_id: body.member_id,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: body.member_id, actor_id: user.id, action: 'winner_declared',
  })

  // Fire winner notification asynchronously; do not block the response.
  // The email helper is wired up in Task 9 — leave a TODO marker that the task
  // adds the import + call here.
  // (After Task 9 lands, replace the comment below with the actual call.)
  // await sendPoolWinnerEmail(...)

  return NextResponse.json(data)
}
```

- [ ] **Step 6.6: Create `src/app/api/pools/[id]/rotate-token/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pools')
    .update({ invite_token: generateInviteToken(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organizer_id', user.id)
    .select('invite_token')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found or not organizer' }, { status: 404 })
  return NextResponse.json({ invite_token: data.invite_token })
}
```

- [ ] **Step 6.7: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 6.8: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add \
  src/lib/pool-utils.ts \
  src/app/api/pools/[id]/lock/route.ts \
  src/app/api/pools/[id]/start/route.ts \
  src/app/api/pools/[id]/cancel/route.ts \
  src/app/api/pools/[id]/declare-winner/route.ts \
  src/app/api/pools/[id]/rotate-token/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool lifecycle endpoints

lock, start, cancel, declare-winner, rotate-token. All five
require organizer auth. Status transitions are validated by a
shared canTransition helper. Each transition writes an audit log
entry via service role. declare-winner sets winner_member_id and
ended_at; cancel sets ended_at; rotate-token regenerates the
256-bit invite token (existing members keep access).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Join flow — POST /api/pools/by-token/[token]/join

**Files:**
- Create: `src/app/api/pools/by-token/[token]/join/route.ts`

### Steps

- [ ] **Step 7.1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve token → pool (via service role; the route is auth-gated but the
  // pools row may not be readable by RLS yet since the user isn't a member).
  const svc = createServiceClient()
  const { data: pool } = await svc
    .from('pools')
    .select('id, pool_type, tournament_id, custom_tournament_id, status')
    .eq('invite_token', token)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'cancelled' || pool.status === 'ended') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 410 })
  }
  if (pool.status === 'locked' || pool.status === 'live') {
    // Spec: organizer manually locks to prevent late joins. We block at the API.
    return NextResponse.json({ error: 'Pool is locked — no new joins' }, { status: 409 })
  }

  // Insert pool_member (idempotent on (pool_id, user_id) unique).
  const { data: member, error: insErr } = await svc
    .from('pool_members')
    .upsert(
      { pool_id: pool.id, user_id: user.id, status: 'alive' },
      { onConflict: 'pool_id,user_id', ignoreDuplicates: false }
    )
    .select()
    .single()
  if (insErr || !member) {
    return NextResponse.json({ error: insErr?.message ?? 'Join failed' }, { status: 500 })
  }

  // Schedule auto-add (official tournaments only).
  if (pool.pool_type === 'official' && pool.tournament_id) {
    await svc.from('user_schedule').upsert(
      {
        user_id: user.id,
        tournament_id: pool.tournament_id,
        priority: 'target',
        source: `pool:${pool.id}`,
      },
      { onConflict: 'user_id,tournament_id', ignoreDuplicates: true }
    )
  }

  await writeAuditLog(svc, {
    pool_id: pool.id, member_id: member.id, actor_id: user.id, action: 'joined',
  })

  return NextResponse.json({ pool_id: pool.id, member_id: member.id }, { status: 201 })
}
```

- [ ] **Step 7.2: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 7.3: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/api/pools/by-token/[token]/join/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add join flow — POST /api/pools/by-token/:token/join

Auth-gated. Resolves the token via service role (target user is
not yet a member, so RLS would hide the pool). Idempotent upsert
on (pool_id, user_id). For official pools, idempotently adds the
tournament to user_schedule with source = pool:<pool_id>. Home
games skip the schedule add. Blocks joins on locked, live,
cancelled, or ended pools.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Member status API — bust, unbust, verify, unverify, no-show, PATCH, DELETE

**Files:**
- Create: `src/app/api/pools/[id]/members/[memberId]/route.ts`
- Create: `src/app/api/pools/[id]/members/[memberId]/bust/route.ts`
- Create: `src/app/api/pools/[id]/members/[memberId]/unbust/route.ts`
- Create: `src/app/api/pools/[id]/members/[memberId]/verify/route.ts`
- Create: `src/app/api/pools/[id]/members/[memberId]/unverify/route.ts`
- Create: `src/app/api/pools/[id]/members/[memberId]/no-show/route.ts`

### Steps

- [ ] **Step 8.1: Create `src/app/api/pools/[id]/members/[memberId]/route.ts`**

Handles `PATCH` (self chip/display_name update, or organizer full update) and `DELETE` (self-leave or organizer-kick).

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface PatchBody {
  display_name?: string | null
  current_chips?: number | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const update: Record<string, unknown> = {}
  if (body.display_name !== undefined) {
    update.display_name = body.display_name === null ? null : String(body.display_name).trim().slice(0, 80) || null
  }
  if (body.current_chips !== undefined) {
    if (body.current_chips !== null && (!Number.isFinite(body.current_chips) || body.current_chips < 0)) {
      return NextResponse.json({ error: 'current_chips must be a non-negative number or null' }, { status: 400 })
    }
    update.current_chips = body.current_chips
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('pool_members')
    .update(update)
    .eq('id', memberId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('id, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  // Remove the member.
  const { error: delErr } = await svc.from('pool_members').delete().eq('id', memberId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // If the schedule entry was added by this pool, remove it too.
  if (member.user_id) {
    const { data: poolForTournament } = await svc.from('pools').select('tournament_id').eq('id', id).single()
    if (poolForTournament?.tournament_id) {
      await svc.from('user_schedule')
        .delete()
        .eq('user_id', member.user_id)
        .eq('tournament_id', poolForTournament.tournament_id)
        .eq('source', `pool:${id}`)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8.2: Create `src/app/api/pools/[id]/members/[memberId]/bust/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('organizer_id, status').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'ended' || pool.status === 'cancelled') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 409 })
  }

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id, status')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status === 'busted') return NextResponse.json({ error: 'Already busted' }, { status: 409 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('pool_members')
    .update({ status: 'busted', busted_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: memberId, actor_id: user.id, action: 'busted',
    metadata: { reported_by: isSelf ? 'self' : 'organizer' },
  })
  return NextResponse.json(data)
}
```

- [ ] **Step 8.3: Create `src/app/api/pools/[id]/members/[memberId]/unbust/route.ts` (organizer only)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool || pool.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pool_members')
    .update({ status: 'alive', busted_at: null })
    .eq('id', memberId)
    .eq('pool_id', id)
    .select()
    .single()
  if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: memberId, actor_id: user.id, action: 'unbusted',
  })
  return NextResponse.json(data)
}
```

- [ ] **Step 8.4: Create `src/app/api/pools/[id]/members/[memberId]/verify/route.ts` and `.../unverify/route.ts`**

`verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool || pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  const { data, error } = await supabase.from('pool_members').update({ verified: true }).eq('id', memberId).eq('pool_id', id).select().single()
  if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  await writeAuditLog(createServiceClient(), { pool_id: id, member_id: memberId, actor_id: user.id, action: 'verified' })
  return NextResponse.json(data)
}
```

`unverify/route.ts` — identical except `verified: false` and `action: 'unverified'`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool || pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  const { data, error } = await supabase.from('pool_members').update({ verified: false }).eq('id', memberId).eq('pool_id', id).select().single()
  if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  await writeAuditLog(createServiceClient(), { pool_id: id, member_id: memberId, actor_id: user.id, action: 'unverified' })
  return NextResponse.json(data)
}
```

- [ ] **Step 8.5: Create `src/app/api/pools/[id]/members/[memberId]/no-show/route.ts` (organizer only)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool || pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  const { data, error } = await supabase
    .from('pool_members')
    .update({ status: 'no_show', busted_at: null })
    .eq('id', memberId).eq('pool_id', id).select().single()
  if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  await writeAuditLog(createServiceClient(), { pool_id: id, member_id: memberId, actor_id: user.id, action: 'no_show' })
  return NextResponse.json(data)
}
```

- [ ] **Step 8.6: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 8.7: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/api/pools/[id]/members
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool member endpoints

PATCH /members/:memberId — self updates display_name and
current_chips; organizer updates anything. DELETE removes the
member and also removes the schedule entry if its source matches
this pool. bust is self-or-organizer; unbust, verify, unverify,
no-show are organizer-only. All status changes write an audit
log entry via service role.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Email notifications — pool cancelled + winner declared

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/app/api/pools/[id]/cancel/route.ts`
- Modify: `src/app/api/pools/[id]/declare-winner/route.ts`

### Steps

- [ ] **Step 9.1: Add helpers to `src/lib/email.ts`**

Append these two functions (keep the existing `sendScheduleChangeEmail`):

```typescript
export async function sendPoolCancelledEmail(opts: {
  toEmails: string[]
  poolName: string
  reason: 'tournament_cancelled' | 'organizer_cancel'
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || opts.toEmails.length === 0) return
  const resend = new Resend(apiKey)
  const reasonText = opts.reason === 'tournament_cancelled'
    ? 'The underlying tournament was cancelled.'
    : 'The pool organizer cancelled the pool.'
  await resend.emails.send({
    from: 'NextRebuy <noreply@nextrebuy.com>',
    to: opts.toEmails,
    subject: `Last Longer Pool cancelled — ${opts.poolName}`,
    html: `
      <p>The pool <strong>${escapeHtml(opts.poolName)}</strong> has been cancelled.</p>
      <p>${reasonText}</p>
      <p>If you have any out-of-band balance with the organizer, please settle directly.</p>
    `,
  })
}

export async function sendPoolWinnerEmail(opts: {
  toEmails: string[]
  poolName: string
  winnerDisplayName: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || opts.toEmails.length === 0) return
  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: 'NextRebuy <noreply@nextrebuy.com>',
    to: opts.toEmails,
    subject: `Last Longer Pool winner — ${opts.poolName}`,
    html: `
      <p>The pool <strong>${escapeHtml(opts.poolName)}</strong> has ended.</p>
      <p>Winner: <strong>${escapeHtml(opts.winnerDisplayName)}</strong></p>
      <p>Settle any out-of-band stakes directly with the pool organizer.</p>
    `,
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
```

- [ ] **Step 9.2: Add `gatherPoolMemberEmails` helper to `src/lib/pool-utils.ts`**

Append at the bottom:

```typescript
/**
 * Gather emails for all pool members via service-role admin listUsers.
 * Skips members whose user_id is null (deleted accounts) or whose email is
 * unverified/missing.
 */
export async function gatherPoolMemberEmails(
  svc: SupabaseClient,
  poolId: string
): Promise<string[]> {
  const { data: members } = await svc
    .from('pool_members')
    .select('user_id')
    .eq('pool_id', poolId)
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]
  if (userIds.length === 0) return []

  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  return (list?.users ?? [])
    .filter(u => userIds.includes(u.id) && !!u.email)
    .map(u => u.email!) // narrowed by filter above
}
```

- [ ] **Step 9.3: Wire emails into cancel and declare-winner**

In `src/app/api/pools/[id]/cancel/route.ts`, after the `writeAuditLog` call, before the `return`:

```typescript
import { sendPoolCancelledEmail } from '@/lib/email'
import { gatherPoolMemberEmails } from '@/lib/pool-utils'
// ...
const emails = await gatherPoolMemberEmails(createServiceClient(), id)
if (emails.length > 0) {
  await sendPoolCancelledEmail({
    toEmails: emails,
    poolName: data.name,
    reason: 'organizer_cancel',
  }).catch(e => console.error('[pools] cancel email failed', e))
}
```

In `src/app/api/pools/[id]/declare-winner/route.ts`, after the `writeAuditLog` call:

```typescript
import { sendPoolWinnerEmail } from '@/lib/email'
import { gatherPoolMemberEmails, resolveDisplayName } from '@/lib/pool-utils'
// ...
const svc = createServiceClient()
const emails = await gatherPoolMemberEmails(svc, id)
// Resolve winner display name
const { data: winnerMember } = await svc
  .from('pool_members')
  .select('display_name, user_id')
  .eq('id', body.member_id)
  .single()
let winnerName = 'A pool member'
if (winnerMember) {
  if (winnerMember.user_id) {
    const { data: u } = await svc.auth.admin.getUserById(winnerMember.user_id)
    winnerName = resolveDisplayName(winnerMember, u?.user ? {
      email: u.user.email ?? null,
      raw_user_meta_data: (u.user.user_metadata as Record<string, unknown>) ?? null,
    } : null)
  } else {
    winnerName = winnerMember.display_name ?? 'Former player'
  }
}
if (emails.length > 0) {
  await sendPoolWinnerEmail({
    toEmails: emails,
    poolName: data.name,
    winnerDisplayName: winnerName,
  }).catch(e => console.error('[pools] winner email failed', e))
}
```

- [ ] **Step 9.4: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 9.5: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/lib/email.ts src/lib/pool-utils.ts src/app/api/pools/[id]/cancel/route.ts src/app/api/pools/[id]/declare-winner/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool email notifications

sendPoolCancelledEmail and sendPoolWinnerEmail use Resend (already
wired in src/lib/email.ts for schedule alerts). Both fan out to
every member with a verified email via service-role
admin.listUsers. The cancel and declare-winner routes call them
after committing the DB change; failures are logged but do not
fail the request.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rate limiting middleware

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/lib/rate-limit.ts`

### Steps

- [ ] **Step 10.1: Create `src/lib/rate-limit.ts`**

```typescript
/**
 * In-memory token-bucket rate limiter. Keyed by an arbitrary string
 * (typically `${ip}:${route}` or `${userId}:${route}`). Single-region; not
 * shared across instances. Good enough for v1 pool routes.
 */

interface Bucket {
  count: number
  resetAt: number
}

const BUCKETS = new Map<string, Bucket>()
const MAX_BUCKETS = 10000

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const existing = BUCKETS.get(key)
  if (!existing || existing.resetAt <= now) {
    // Trim oldest if cache too large.
    if (BUCKETS.size >= MAX_BUCKETS) {
      const oldestKey = BUCKETS.keys().next().value
      if (oldestKey !== undefined) BUCKETS.delete(oldestKey)
    }
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now }
  }
  existing.count += 1
  return { ok: true, retryAfterMs: 0 }
}
```

- [ ] **Step 10.2: Extend `src/middleware.ts` with rate limits for pool routes**

Replace the file with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from '@/lib/rate-limit'

const CHIP_UPDATE = /^\/api\/pools\/[^/]+\/members\/[^/]+$/
const JOIN_ROUTE = /^\/api\/pools\/by-token\/[^/]+\/join$/

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (request.method === 'PATCH' && CHIP_UPDATE.test(path)) {
    const ip = clientKey(request)
    const { ok, retryAfterMs } = checkRateLimit(`chip:${ip}:${path}`, 1, 60_000)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many chip updates — try again in a moment' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (request.method === 'POST' && JOIN_ROUTE.test(path)) {
    const ip = clientKey(request)
    const { ok, retryAfterMs } = checkRateLimit(`join:${ip}`, 5, 60_000)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many join attempts — try again in a minute' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 10.3: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 10.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/lib/rate-limit.ts src/middleware.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add rate limiting for pool routes

In-memory token-bucket limiter keyed by client IP. Chip update
endpoint (PATCH /api/pools/:id/members/:id) capped at 1 per minute;
join endpoint capped at 5 per minute. 429 responses include a
Retry-After header. Single-region only; Upstash Redis is the
documented upgrade path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Hooks for pool data

**Files:**
- Create: `src/hooks/use-pool.ts`
- Create: `src/hooks/use-my-pools.ts`

### Steps

- [ ] **Step 11.1: Create `src/hooks/use-pool.ts`**

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PoolDetail } from '@/types'

export function usePool(poolId: string | null) {
  const [pool, setPool] = useState<PoolDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(!!poolId)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!poolId) return
    try {
      const res = await fetch(`/api/pools/${poolId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`)
      setPool(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pool')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    if (!poolId) return
    setLoading(true)
    refetch()
    // Poll every 30 seconds on the leaderboard page for near-live updates.
    const t = setInterval(refetch, 30_000)
    return () => clearInterval(t)
  }, [poolId, refetch])

  return { pool, loading, error, refetch }
}
```

- [ ] **Step 11.2: Create `src/hooks/use-my-pools.ts`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Pool } from '@/types'

interface MyPoolRow extends Pool {
  is_organizer: boolean
  member_count: number
  alive_count: number
}

export function useMyPools() {
  const [pools, setPools] = useState<MyPoolRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pools/mine')
      .then(r => r.ok ? r.json() : [])
      .then(setPools)
      .catch(() => setPools([]))
      .finally(() => setLoading(false))
  }, [])

  return { pools, loading }
}
```

- [ ] **Step 11.3: Create the `/api/pools/mine` route to back the hook**

Create `src/app/api/pools/mine/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pools where I'm a member.
  const { data: memberships } = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('user_id', user.id)
  const poolIds = (memberships ?? []).map(m => m.pool_id)
  if (poolIds.length === 0) return NextResponse.json([])

  const { data: pools } = await supabase
    .from('pools')
    .select('*')
    .in('id', poolIds)
    .order('created_at', { ascending: false })

  // Annotate counts.
  const annotated = await Promise.all((pools ?? []).map(async p => {
    const { count: total } = await supabase
      .from('pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', p.id)
    const { count: alive } = await supabase
      .from('pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', p.id)
      .eq('status', 'alive')
    return { ...p, is_organizer: p.organizer_id === user.id, member_count: total ?? 0, alive_count: alive ?? 0 }
  }))
  return NextResponse.json(annotated)
}
```

- [ ] **Step 11.4: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 11.5: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/hooks/use-pool.ts src/hooks/use-my-pools.ts src/app/api/pools/mine/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool hooks and /api/pools/mine endpoint

usePool fetches one pool with 30-second polling for near-live
leaderboard updates. useMyPools backs the pool list page. The
new /api/pools/mine returns pools the caller is a member of with
total + alive counts annotated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Pool dashboard UI — leaderboard, organizer panel, audit feed

**Files:**
- Create: `src/components/pool-leaderboard.tsx`
- Create: `src/components/pool-organizer-panel.tsx`
- Create: `src/components/pool-audit-feed.tsx`
- Create: `src/app/pools/[id]/page.tsx`

### Steps

- [ ] **Step 12.1: Create `src/components/pool-leaderboard.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { PoolDetail, PoolMember } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBuyIn } from '@/lib/utils'

interface Props {
  pool: PoolDetail
  currentUserId: string
  onRefetch: () => void
}

export function PoolLeaderboard({ pool, currentUserId, onRefetch }: Props) {
  const isOrganizer = pool.is_organizer
  const sorted = [...pool.members].sort((a, b) => {
    const rank = (m: PoolMember) =>
      m.status === 'alive' ? 0 : m.status === 'busted' ? 1 : 2
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.status === 'alive') return (b.current_chips ?? 0) - (a.current_chips ?? 0)
    if (a.status === 'busted') return (a.busted_at ?? '').localeCompare(b.busted_at ?? '')
    return 0
  })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground uppercase">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Chips</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">{isOrganizer ? 'Manage' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(m => (
            <Row
              key={m.id}
              poolId={pool.id}
              member={m}
              isSelf={m.user_id === currentUserId}
              isOrganizer={isOrganizer}
              onRefetch={onRefetch}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  poolId, member, isSelf, isOrganizer, onRefetch,
}: { poolId: string; member: PoolMember; isSelf: boolean; isOrganizer: boolean; onRefetch: () => void }) {
  const [chips, setChips] = useState<string>(member.current_chips != null ? String(member.current_chips) : '')
  const [saving, setSaving] = useState(false)

  async function updateChips() {
    if (!isSelf && !isOrganizer) return
    const value = chips.trim() === '' ? null : Number(chips.replace(/,/g, ''))
    if (value !== null && (Number.isNaN(value) || value < 0)) return
    setSaving(true)
    await fetch(`/api/pools/${poolId}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_chips: value }),
    }).catch(() => {})
    setSaving(false)
    onRefetch()
  }

  async function bust() {
    await fetch(`/api/pools/${poolId}/members/${member.id}/bust`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  async function unbust() {
    await fetch(`/api/pools/${poolId}/members/${member.id}/unbust`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  async function toggleVerified() {
    const path = member.verified ? 'unverify' : 'verify'
    await fetch(`/api/pools/${poolId}/members/${member.id}/${path}`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  const status = member.status
  const statusBadge =
    status === 'alive' ? <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Alive</Badge> :
    status === 'busted' ? <Badge variant="outline">Out #{member.bust_order ?? '?'}</Badge> :
    <Badge variant="outline" className="text-muted-foreground">No-show</Badge>

  return (
    <tr className={`border-t border-border ${isSelf ? 'bg-primary/5' : ''}`}>
      <td className="px-3 py-2 text-xs text-muted-foreground">{member.bust_order ?? '—'}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{member.resolved_display_name ?? 'Player'}</span>
        {!member.verified && <span className="ml-2 text-[10px] uppercase text-amber-600">Unverified</span>}
        {member.verified && <span className="ml-2 text-[10px] uppercase text-emerald-600">✓ Verified</span>}
      </td>
      <td className="px-3 py-2">
        {isSelf || isOrganizer ? (
          <div className="flex items-center gap-1">
            <Input value={chips} onChange={e => setChips(e.target.value)} className="h-7 w-24 text-sm" disabled={saving || status !== 'alive'} />
            <Button size="sm" variant="outline" onClick={updateChips} disabled={saving || status !== 'alive'}>Save</Button>
          </div>
        ) : (
          <span>{member.current_chips != null ? formatBuyIn(member.current_chips).replace('$', '') : '—'}</span>
        )}
      </td>
      <td className="px-3 py-2">{statusBadge}</td>
      <td className="px-3 py-2 text-right space-x-1">
        {isSelf && status === 'alive' && (
          <Button size="sm" variant="destructive" onClick={bust}>I busted</Button>
        )}
        {isOrganizer && status === 'busted' && (
          <Button size="sm" variant="outline" onClick={unbust}>Un-bust</Button>
        )}
        {isOrganizer && status === 'alive' && !isSelf && (
          <Button size="sm" variant="outline" onClick={bust}>Bust them</Button>
        )}
        {isOrganizer && (
          <Button size="sm" variant="outline" onClick={toggleVerified}>{member.verified ? 'Unverify' : 'Verify'}</Button>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 12.2: Create `src/components/pool-organizer-panel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PoolDetail } from '@/types'

interface Props {
  pool: PoolDetail
  onRefetch: () => void
}

export function PoolOrganizerPanel({ pool, onRefetch }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [winnerId, setWinnerId] = useState<string>('')

  async function call(path: string, body?: object) {
    setBusy(path)
    try {
      await fetch(`/api/pools/${pool.id}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
    } finally {
      setBusy(null)
      onRefetch()
    }
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}/pools/join/${pool.invite_token}`
    await navigator.clipboard.writeText(url)
  }

  const aliveMembers = pool.members.filter(m => m.status === 'alive')

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Organizer controls</h3>
      <div className="flex flex-wrap gap-2">
        {pool.status === 'open' && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('lock')}>Lock pool</Button>
        )}
        {pool.status === 'locked' && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('start')}>Start pool</Button>
        )}
        {pool.status !== 'ended' && pool.status !== 'cancelled' && (
          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => {
            if (confirm('Cancel this pool?')) call('cancel')
          }}>Cancel pool</Button>
        )}
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('rotate-token')}>Rotate invite token</Button>
        <Button size="sm" variant="outline" onClick={copyInviteLink}>Copy invite link</Button>
      </div>

      {pool.status === 'live' || pool.status === 'locked' ? (
        <div className="space-y-2 border-t pt-3">
          <label className="text-xs font-medium">Declare winner</label>
          <select
            value={winnerId}
            onChange={e => setWinnerId(e.target.value)}
            className="w-full rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">Pick a member…</option>
            {aliveMembers.length > 0 ? (
              <optgroup label="Alive">
                {aliveMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.resolved_display_name ?? 'Player'}</option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All members">
              {pool.members.map(m => (
                <option key={m.id} value={m.id}>{m.resolved_display_name ?? 'Player'} ({m.status})</option>
              ))}
            </optgroup>
          </select>
          <Button
            size="sm"
            disabled={!winnerId || !!busy}
            onClick={() => call('declare-winner', { member_id: winnerId })}
          >
            Confirm winner
          </Button>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 12.3: Create `src/components/pool-audit-feed.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { PoolAuditEntry } from '@/types'

export function PoolAuditFeed({ poolId }: { poolId: string }) {
  const [entries, setEntries] = useState<PoolAuditEntry[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/pools/${poolId}/audit`).then(r => r.ok ? r.json() : []).then(setEntries).catch(() => setEntries([]))
  }, [poolId, open])

  return (
    <div className="rounded-xl border border-border p-3 text-xs">
      <button className="font-medium" onClick={() => setOpen(o => !o)}>
        {open ? '▼' : '►'} Audit log ({entries.length} entries)
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-muted-foreground max-h-60 overflow-y-auto">
          {entries.map(e => (
            <li key={e.id}>
              <span className="font-mono">{e.created_at.slice(0, 16).replace('T', ' ')}</span>
              {' — '}
              <span>{e.action}</span>
            </li>
          ))}
          {entries.length === 0 && <li>No entries yet.</li>}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 12.4: Add the audit endpoint backing the feed**

Create `src/app/api/pools/[id]/audit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('pool_audit_log')
    .select('*')
    .eq('pool_id', id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 12.5: Create `src/app/pools/[id]/page.tsx`**

```typescript
'use client'

import { use } from 'react'
import { usePool } from '@/hooks/use-pool'
import { useUser } from '@/hooks/use-user'
import { PoolLeaderboard } from '@/components/pool-leaderboard'
import { PoolOrganizerPanel } from '@/components/pool-organizer-panel'
import { PoolAuditFeed } from '@/components/pool-audit-feed'
import { Badge } from '@/components/ui/badge'

export default function PoolDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useUser()
  const { pool, loading, error, refetch } = usePool(id)

  if (loading) return <div className="p-6">Loading pool…</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!pool) return <div className="p-6">Pool not found.</div>

  const tournamentName = pool.tournament?.name ?? pool.custom_tournament?.name ?? 'Tournament'
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        <p className="text-sm text-muted-foreground">{tournamentName}</p>
        <div className="flex gap-2">
          <Badge variant="outline">{pool.status}</Badge>
          <Badge variant="outline">{pool.alive_count}/{pool.total_count} alive</Badge>
        </div>
      </header>

      <div className="text-xs text-muted-foreground">
        Re-entries: {pool.reentries_keep_alive ? 'alive' : 'final'} ·
        Multi-flight: {pool.multiflight_out_rule === 'last_flight' ? 'last flight' : 'first flight'} ·
        {pool.start_after_reentry_period ? ' Tracking after re-entry close' : ' Tracking from start'}
      </div>

      <PoolLeaderboard pool={pool} currentUserId={user?.id ?? ''} onRefetch={refetch} />

      {pool.is_organizer && <PoolOrganizerPanel pool={pool} onRefetch={refetch} />}

      <PoolAuditFeed poolId={pool.id} />
    </div>
  )
}
```

- [ ] **Step 12.6: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 12.7: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/components/pool-leaderboard.tsx src/components/pool-organizer-panel.tsx src/components/pool-audit-feed.tsx src/app/api/pools/[id]/audit/route.ts src/app/pools/[id]/page.tsx
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool dashboard UI

PoolLeaderboard renders alive, busted (with bust order), then
no-show; inline chip update + bust button for self; bust /
verify / un-bust controls for organizer. PoolOrganizerPanel
exposes lock / start / cancel / declare-winner / rotate-token.
PoolAuditFeed pulls the audit log entries lazily on expand. The
page polls every 30s via usePool.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Create-pool modal and tournament-page CTA

**Files:**
- Create: `src/components/pool-create-modal.tsx`
- Modify: `src/app/tournament/[id]/page.tsx`

### Steps

- [ ] **Step 13.1: Create `src/components/pool-create-modal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface Props {
  tournamentId?: string
  customTournamentId?: string
  defaultName: string
  triggerLabel?: string
  onCreated: (poolId: string, inviteToken: string) => void
}

export function PoolCreateModal({ tournamentId, customTournamentId, defaultName, triggerLabel, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [reentries, setReentries] = useState(true)
  const [trackAfterRebuy, setTrackAfterRebuy] = useState(false)
  const [multiflight, setMultiflight] = useState<'first_flight' | 'last_flight'>('last_flight')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pool_type: tournamentId ? 'official' : 'home_game',
          tournament_id: tournamentId ?? null,
          custom_tournament_id: customTournamentId ?? null,
          reentries_keep_alive: reentries,
          start_after_reentry_period: trackAfterRebuy,
          multiflight_out_rule: multiflight,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create pool')
      onCreated(data.id, data.invite_token)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{triggerLabel ?? 'Create Last Longer Pool'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Last Longer Pool</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Pool name
            <Input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reentries} onChange={e => setReentries(e.target.checked)} />
            Re-entries keep you alive
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={trackAfterRebuy} onChange={e => setTrackAfterRebuy(e.target.checked)} />
            Start tracking after re-entry period closes
          </label>
          <label className="block text-sm">
            Multi-flight rule
            <select value={multiflight} onChange={e => setMultiflight(e.target.value as 'first_flight' | 'last_flight')} className="block w-full rounded border bg-background px-2 py-1">
              <option value="last_flight">Out only after last flight bust</option>
              <option value="first_flight">Out on first flight bust</option>
            </select>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create pool'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 13.2: Add the CTA to `src/app/tournament/[id]/page.tsx`**

Open the file, find the JSX near the tournament header (above "Add to Schedule" or similar). Add an inline import and component:

```tsx
import { PoolCreateModal } from '@/components/pool-create-modal'
import { useRouter } from 'next/navigation'
// ...
const router = useRouter()
// inside the action area of the tournament header:
<PoolCreateModal
  tournamentId={tournament.id}
  defaultName={`${tournament.name} Last Longer`}
  onCreated={(poolId) => router.push(`/pools/${poolId}`)}
/>
```

(Place it next to existing action buttons.)

- [ ] **Step 13.3: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 13.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/components/pool-create-modal.tsx src/app/tournament/[id]/page.tsx
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add pool create modal and tournament-page CTA

PoolCreateModal lets the user name the pool and pick the three
rule toggles. Submits to POST /api/pools and routes to the new
pool dashboard on success. The CTA is wired into the tournament
detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Public join page

**Files:**
- Create: `src/app/pools/join/[token]/page.tsx`

### Steps

- [ ] **Step 14.1: Create the page**

```typescript
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface PoolMeta {
  id: string
  name: string
  pool_type: 'official' | 'home_game'
  status: string
  tournament?: { name: string; date: string; venue?: { venue?: string } } | null
  custom_tournament?: { name: string; date: string } | null
  member_count: number
}

export default function PoolJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [meta, setMeta] = useState<PoolMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/pools/by-token/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error ?? `${r.status}`) }))
      .then(setMeta)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  async function join() {
    setJoining(true)
    setError(null)
    try {
      const res = await fetch(`/api/pools/by-token/${token}/join`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join')
      router.push(`/pools/${data.pool_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setJoining(false)
    }
  }

  if (loading || userLoading) return <div className="p-6">Loading…</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!meta) return <div className="p-6">Pool not found.</div>

  const tournamentLine = meta.tournament?.name ?? meta.custom_tournament?.name ?? 'Tournament'
  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">Join Last Longer Pool</h1>
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="text-lg font-semibold">{meta.name}</div>
        <div className="text-sm text-muted-foreground">{tournamentLine}</div>
        <div className="text-xs text-muted-foreground">{meta.member_count} member{meta.member_count === 1 ? '' : 's'} so far</div>
      </div>
      {!user ? (
        <div className="space-y-2">
          <p className="text-sm">Sign in or create an account to join.</p>
          <Button asChild>
            <Link href={`/login?next=/pools/join/${token}`}>Sign in / create account</Link>
          </Button>
        </div>
      ) : (
        <Button disabled={joining} onClick={join}>{joining ? 'Joining…' : 'Join pool'}</Button>
      )}
    </div>
  )
}
```

- [ ] **Step 14.2: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 14.3: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/pools/join/[token]/page.tsx
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add public pool join page

/pools/join/[token] resolves the invite token via the public
metadata endpoint, prompts for login if unauthenticated (routing
back here via ?next=), then submits the join action and routes
to the pool dashboard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: My pools list page

**Files:**
- Create: `src/app/pools/page.tsx`

### Steps

- [ ] **Step 15.1: Create the list page**

```typescript
'use client'

import Link from 'next/link'
import { useMyPools } from '@/hooks/use-my-pools'
import { Badge } from '@/components/ui/badge'

export default function MyPoolsPage() {
  const { pools, loading } = useMyPools()
  if (loading) return <div className="p-6">Loading…</div>

  if (pools.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-muted-foreground">
        You haven&apos;t joined any pools yet. Create one from a tournament page.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
      <h1 className="text-2xl font-bold">My Last Longer Pools</h1>
      {pools.map(p => (
        <Link key={p.id} href={`/pools/${p.id}`} className="block rounded-xl border border-border p-4 hover:bg-accent">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.alive_count}/{p.member_count} alive · {p.status}
                {p.is_organizer ? ' · You are the organizer' : ''}
              </div>
            </div>
            <Badge variant="outline">{p.status}</Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 15.2: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 15.3: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/app/pools/page.tsx
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Add my-pools list page

/pools renders every pool the user is a member of with the
alive/total counter, status badge, and an organizer flag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Auto-cancel hook in cron monitor

**Files:**
- Modify: `src/app/api/cron/monitor-schedules/route.ts`
- Modify: `src/lib/pool-utils.ts` (add helper)

### Steps

- [ ] **Step 16.1: Add `autoCancelPoolsForTournament` to `src/lib/pool-utils.ts`**

Append:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPoolCancelledEmail } from '@/lib/email'

/**
 * Cancel every non-terminal pool tied to the given tournament_id, write audit
 * log entries, and email all members.
 */
export async function autoCancelPoolsForTournament(svc: SupabaseClient, tournamentId: string) {
  const { data: pools } = await svc
    .from('pools')
    .select('id, name, status')
    .eq('tournament_id', tournamentId)
    .not('status', 'in', '(ended,cancelled)')
  for (const pool of pools ?? []) {
    await svc.from('pools').update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', pool.id)

    await writeAuditLog(svc, {
      pool_id: pool.id,
      actor_id: null,
      action: 'pool_cancelled',
      metadata: { reason: 'tournament_cancelled' },
    })

    const emails = await gatherPoolMemberEmails(svc, pool.id)
    if (emails.length > 0) {
      sendPoolCancelledEmail({
        toEmails: emails,
        poolName: pool.name,
        reason: 'tournament_cancelled',
      }).catch(e => console.error('[pools] auto-cancel email failed', e))
    }
  }
}
```

- [ ] **Step 16.2: Wire the helper into `src/app/api/cron/monitor-schedules/route.ts`**

Locate where the cron handler discovers cancelled/removed tournaments. Most likely it's flagging IDs in a `removed` list. After that, call:

```typescript
import { autoCancelPoolsForTournament } from '@/lib/pool-utils'
import { createServiceClient } from '@/lib/supabase/service'
// ...
const svc = createServiceClient()
for (const removedId of removedTournamentIds) {
  await autoCancelPoolsForTournament(svc, removedId)
}
```

If the cron does not currently produce a `removedTournamentIds` collection, add a short sweep at the top of the handler instead:

```typescript
const { data: cancelledTournaments } = await svc
  .from('tournaments')
  .select('id')
  .ilike('status', 'cancelled')
for (const t of cancelledTournaments ?? []) {
  await autoCancelPoolsForTournament(svc, t.id)
}
```

(Use whichever signal your cron already trusts.)

- [ ] **Step 16.3: Typecheck + lint**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint
```

- [ ] **Step 16.4: Commit**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner add src/lib/pool-utils.ts src/app/api/cron/monitor-schedules/route.ts
git -C /Users/gyndok/Developer/vegas-tournament-planner commit -m "$(cat <<'EOF'
Auto-cancel pools when a tournament is cancelled

The cron monitor now sweeps for cancelled tournaments and
transitions every non-terminal pool attached to that tournament to
cancelled, writes a pool_audit_log entry (with reason =
tournament_cancelled, actor null since it is a system action),
and emails all members via Resend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Final smoke + lint sweep + push

### Steps

- [ ] **Step 17.1: Run final validation**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all exit 0. (`npm run build` catches issues that `tsc --noEmit` misses, e.g. dynamic route param shape mismatches.)

- [ ] **Step 17.2: Push everything**

```bash
git -C /Users/gyndok/Developer/vegas-tournament-planner push origin main
```

- [ ] **Step 17.3: Manually verify a full round-trip on the deployed Vercel build**

In order:
1. Visit `/tournament/<some-id>`, click **Create Last Longer Pool**, fill in form, submit. Expect redirect to `/pools/<new-id>`.
2. Copy the invite link from the organizer panel. Paste in a private window. Sign in as a different user. Click Join. Expect redirect to `/pools/<id>` for the second user, and a `pool:<id>` row in `user_schedule`.
3. As the organizer, click **Lock pool**, then **Start pool**.
4. As the second user, hit **I busted**. Verify the leaderboard shows them as Out #1.
5. As the organizer, click **Declare winner**, pick the alive member. Verify status flips to `ended` and (if Resend is configured) the winner email arrives.
6. Visit `/pools` as either user — verify the pool appears with the correct status.

---

## Deferred items (out of v1 scope, per spec)

- Real-time updates beyond 30s polling
- Push notifications
- Multi-event pools
- Public/discoverable pools
- Pool comments / chat
- P&L tracking from pool history
- Side wagers integration with trip budget
- Auto-detection of re-entries / flight progression / rebuy period close
- Time-series chip count history
- `is_continuation` column on tournaments (currently heuristic-filtered)
