# Social Schedule Sharing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users share a read-only view of their tournament schedule via a private token-based link.

**Architecture:** Add `share_token` UUID and `share_enabled` boolean to `user_preferences`. New public API route fetches schedule by token using Supabase service role. New `/shared/[token]` page renders a read-only `ScheduleCalendar`. Share toggle + copy-link UI on the existing schedule page.

**Tech Stack:** Next.js App Router, Supabase (service role for public reads), React, shadcn/ui

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260224_add_schedule_sharing.sql`

**Step 1: Write the migration**

```sql
-- Add sharing columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT FALSE;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_share_token
  ON user_preferences(share_token)
  WHERE share_token IS NOT NULL;
```

**Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260224_add_schedule_sharing.sql
git commit -m "feat: add share_token and share_enabled columns to user_preferences"
```

---

### Task 2: Update Types

**Files:**
- Modify: `src/types/index.ts` (lines 37-53, `UserPreferences` interface)

**Step 1: Add sharing fields to UserPreferences**

Add two new fields to the `UserPreferences` interface:

```typescript
export interface UserPreferences {
  id: string
  user_id: string
  buy_in_min: number | null
  buy_in_max: number | null
  preferred_games: string[]
  preferred_formats: string[]
  preferred_start_time_earliest: string | null
  preferred_start_time_latest: string | null
  preferred_table_size: number[]
  avoid_turbos: boolean
  trip_start: string | null
  trip_end: string | null
  trip_budget: number | null
  share_token: string | null      // <-- NEW
  share_enabled: boolean           // <-- NEW
  created_at: string
  updated_at: string
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add share_token and share_enabled to UserPreferences type"
```

---

### Task 3: Update Preferences API

**Files:**
- Modify: `src/app/api/preferences/route.ts` (lines 39-53, PUT handler)

**Step 1: Add share_enabled handling to the PUT handler**

In the `preferences` object inside the PUT handler, add:

```typescript
share_enabled: body.share_enabled ?? false,
```

Also, **before** the upsert, add logic to generate a token when sharing is first enabled:

```typescript
// Generate share token if enabling sharing for the first time
if (body.share_enabled) {
  // Check if user already has a share_token
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('share_token')
    .eq('user_id', user.id)
    .single()

  if (!existing?.share_token) {
    preferences.share_token = crypto.randomUUID()
  }
}
```

The full updated PUT handler should be:

```typescript
export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const preferences: Record<string, unknown> = {
    user_id: user.id,
    buy_in_min: body.buy_in_min ?? null,
    buy_in_max: body.buy_in_max ?? null,
    preferred_games: body.preferred_games ?? [],
    preferred_formats: body.preferred_formats ?? [],
    preferred_start_time_earliest: body.preferred_start_time_earliest ?? null,
    preferred_start_time_latest: body.preferred_start_time_latest ?? null,
    preferred_table_size: body.preferred_table_size ?? [],
    avoid_turbos: body.avoid_turbos ?? false,
    trip_start: body.trip_start ?? null,
    trip_end: body.trip_end ?? null,
    trip_budget: body.trip_budget ?? null,
    share_enabled: body.share_enabled ?? false,
    updated_at: new Date().toISOString(),
  }

  // Generate share token if enabling sharing for the first time
  if (body.share_enabled) {
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('share_token')
      .eq('user_id', user.id)
      .single()

    if (!existing?.share_token) {
      preferences.share_token = crypto.randomUUID()
    }
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(preferences, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 2: Add a POST endpoint for regenerating the share token**

Add to the same file — a new function to handle token regeneration. Instead of a separate route, handle it by accepting `regenerate_token: true` in the PUT body. Add this logic right after the `share_enabled` check:

```typescript
// Regenerate share token if requested
if (body.regenerate_token) {
  preferences.share_token = crypto.randomUUID()
}
```

**Step 3: Commit**

```bash
git add src/app/api/preferences/route.ts
git commit -m "feat: handle share_enabled and share_token in preferences API"
```

---

### Task 4: Create Supabase Service Role Client

**Files:**
- Create: `src/lib/supabase/service.ts`

**Step 1: Create service role client helper**

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

**Step 2: Commit**

```bash
git add src/lib/supabase/service.ts
git commit -m "feat: add Supabase service role client for public reads"
```

---

### Task 5: Create Shared Schedule API Route

**Files:**
- Create: `src/app/api/schedule/shared/[token]/route.ts`

**Step 1: Implement the public shared schedule endpoint**

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // Look up the user by share token
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('user_id, share_enabled, trip_start, trip_end')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  if (prefsError || !prefs) {
    return NextResponse.json(
      { error: 'Schedule not found or sharing is disabled' },
      { status: 404 }
    )
  }

  // Fetch the user's schedule entries (without notes)
  const { data: entries, error: entriesError } = await supabase
    .from('user_schedule')
    .select('id, user_id, tournament_id, priority, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', prefs.user_id)
    .order('created_at', { ascending: true })

  if (entriesError) {
    return NextResponse.json(
      { error: 'Failed to load schedule' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    entries: entries ?? [],
    tripDates: {
      from: prefs.trip_start,
      to: prefs.trip_end,
    },
  })
}
```

Key points:
- Uses service role client (bypasses RLS)
- Only returns data if `share_enabled = true`
- Does NOT select `notes` from `user_schedule` — notes stay private
- Returns trip dates for calendar context

**Step 2: Commit**

```bash
git add src/app/api/schedule/shared/[token]/route.ts
git commit -m "feat: add public shared schedule API endpoint"
```

---

### Task 6: Make ScheduleCalendar Support Read-Only Mode

**Files:**
- Modify: `src/components/schedule-calendar.tsx` (lines 50-54, props interface)

**Step 1: Make onUpdateEntry and onRemoveEntry optional**

Update the props interface:

```typescript
interface ScheduleCalendarProps {
  entries: UserScheduleEntry[]
  onUpdateEntry?: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry?: (entryId: string) => Promise<void>
  readOnly?: boolean
}
```

**Step 2: Pass readOnly down to child views**

No-op callbacks when read-only. Update the component function signature:

```typescript
export function ScheduleCalendar({
  entries,
  onUpdateEntry,
  onRemoveEntry,
  readOnly = false,
}: ScheduleCalendarProps) {
```

For each calendar view render, pass no-op functions if readOnly or if callbacks are undefined:

```typescript
const handleUpdate = onUpdateEntry ?? (async () => {})
const handleRemove = onRemoveEntry ?? (async () => {})
```

Then use `handleUpdate` and `handleRemove` in the JSX instead of `onUpdateEntry` and `onRemoveEntry`.

**Step 3: Verify the existing schedule page still works**

The existing schedule page passes both callbacks so it will continue to work unchanged.

**Step 4: Commit**

```bash
git add src/components/schedule-calendar.tsx
git commit -m "feat: support read-only mode in ScheduleCalendar"
```

---

### Task 7: Create the Shared Schedule Page

**Files:**
- Create: `src/app/shared/[token]/page.tsx`

**Step 1: Build the shared schedule page**

```tsx
import { notFound } from 'next/navigation'
import { SharedScheduleView } from '@/components/shared-schedule-view'

interface SharedPageProps {
  params: Promise<{ token: string }>
}

export default async function SharedSchedulePage({ params }: SharedPageProps) {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/schedule/shared/${token}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    notFound()
  }

  const data = await res.json()

  return <SharedScheduleView entries={data.entries} tripDates={data.tripDates} />
}
```

**Step 2: Create the SharedScheduleView client component**

Create: `src/components/shared-schedule-view.tsx`

```tsx
'use client'

import { UserScheduleEntry } from '@/types'
import { ScheduleCalendar } from '@/components/schedule-calendar'
import { CalendarDays } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface SharedScheduleViewProps {
  entries: UserScheduleEntry[]
  tripDates: { from: string | null; to: string | null }
}

export function SharedScheduleView({ entries, tripDates }: SharedScheduleViewProps) {
  const dateRange = tripDates.from && tripDates.to
    ? `${format(parseISO(tripDates.from), 'MMM d')} – ${format(parseISO(tripDates.to), 'MMM d, yyyy')}`
    : null

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <CalendarDays className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">No tournaments scheduled yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            This schedule is empty.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared Schedule</h1>
        {dateRange && (
          <p className="text-muted-foreground text-sm mt-1">{dateRange}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {entries.length} tournament{entries.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <ScheduleCalendar entries={entries} readOnly />
    </div>
  )
}
```

**Step 3: Create a not-found page for invalid tokens**

Create: `src/app/shared/[token]/not-found.tsx`

```tsx
import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SharedNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <CalendarDays className="size-12 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium">Schedule not available</p>
        <p className="text-muted-foreground text-sm mt-1">
          This schedule link is invalid or sharing has been disabled.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/shared/[token]/page.tsx src/components/shared-schedule-view.tsx src/app/shared/[token]/not-found.tsx
git commit -m "feat: add shared schedule page with read-only calendar view"
```

---

### Task 8: Add Share Controls to Schedule Page

**Files:**
- Modify: `src/app/schedule/page.tsx` (lines 1-12 imports, lines 69-82 header area)

**Step 1: Add share toggle UI to the schedule page header**

Add these imports at the top:

```typescript
import { useState, useEffect } from 'react'
import { Share2, Copy, Check, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
```

Add state and share logic inside `SchedulePage` component (after the existing hooks):

```typescript
const [shareEnabled, setShareEnabled] = useState(false)
const [shareToken, setShareToken] = useState<string | null>(null)
const [copied, setCopied] = useState(false)

// Load sharing state from preferences
useEffect(() => {
  async function loadShareState() {
    const res = await fetch('/api/preferences')
    if (res.ok) {
      const prefs = await res.json()
      if (prefs) {
        setShareEnabled(prefs.share_enabled ?? false)
        setShareToken(prefs.share_token ?? null)
      }
    }
  }
  if (user) loadShareState()
}, [user])

async function handleShareToggle(enabled: boolean) {
  setShareEnabled(enabled)
  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_enabled: enabled }),
  })
  if (res.ok) {
    const prefs = await res.json()
    setShareToken(prefs.share_token)
  }
}

async function handleRegenerateLink() {
  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_enabled: true, regenerate_token: true }),
  })
  if (res.ok) {
    const prefs = await res.json()
    setShareToken(prefs.share_token)
  }
}

function handleCopyLink() {
  if (!shareToken) return
  const url = `${window.location.origin}/shared/${shareToken}`
  navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

**Step 2: Add the share UI below the header**

Replace the existing header `<div>` (lines 71-81) with:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold">My Schedule</h1>
  </div>

  <div className="flex items-center gap-2">
    {entries.length > 0 && (
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="size-4 mr-2" />
        Export .ics
      </Button>
    )}
  </div>
</div>

{/* Share controls */}
<div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
  <Share2 className="size-4 text-muted-foreground shrink-0" />
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Share my schedule</span>
      <Switch checked={shareEnabled} onCheckedChange={handleShareToggle} />
    </div>
    {shareEnabled && shareToken && (
      <div className="flex items-center gap-2 mt-2">
        <code className="text-xs bg-muted px-2 py-1 rounded truncate block flex-1">
          {window.location.origin}/shared/{shareToken}
        </code>
        <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" onClick={handleCopyLink}>
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2 text-muted-foreground" onClick={handleRegenerateLink} title="Generate new link">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    )}
  </div>
</div>
```

**Step 3: Verify the preferences PUT call preserves existing fields**

Important: the current PUT handler replaces all fields. The share toggle only sends `share_enabled`. We need the PUT call to merge with existing preferences. Update `handleShareToggle` to first load current preferences, then merge:

```typescript
async function handleShareToggle(enabled: boolean) {
  setShareEnabled(enabled)
  // Load current prefs first to avoid overwriting other fields
  const current = await fetch('/api/preferences')
  const currentPrefs = current.ok ? await current.json() : {}

  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...currentPrefs, share_enabled: enabled }),
  })
  if (res.ok) {
    const prefs = await res.json()
    setShareToken(prefs.share_token)
  }
}

async function handleRegenerateLink() {
  const current = await fetch('/api/preferences')
  const currentPrefs = current.ok ? await current.json() : {}

  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...currentPrefs, share_enabled: true, regenerate_token: true }),
  })
  if (res.ok) {
    const prefs = await res.json()
    setShareToken(prefs.share_token)
  }
}
```

**Step 4: Commit**

```bash
git add src/app/schedule/page.tsx
git commit -m "feat: add share toggle and copy-link UI to schedule page"
```

---

### Task 9: Build, Push, and Deploy

**Step 1: Build**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Push**

```bash
git push
```
Expected: Vercel auto-deploys.

**Step 3: Verify on production**

1. Go to nextrebuy.com/schedule
2. Toggle sharing ON → link appears
3. Copy link → open in incognito → read-only calendar shows
4. Toggle sharing OFF → incognito link shows "not available"
5. Regenerate link → old link stops working, new link works
