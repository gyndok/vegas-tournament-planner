# Custom Tournament Import (Phase 1) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users create custom tournaments via a form, store them in a new table, and display them on the schedule alongside regular tournaments.

**Architecture:** New `custom_tournaments` table with RLS. CRUD API at `/api/custom-tournaments`. New form page at `/custom/new`. Schedule hooks and views merge custom tournaments with regular schedule entries for unified display.

**Tech Stack:** Next.js App Router, Supabase (RLS + service role), React, shadcn/ui, Tailwind CSS

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260225_add_custom_tournaments.sql`

**Step 1: Write the migration**

```sql
-- Custom tournaments table
CREATE TABLE custom_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_public BOOLEAN DEFAULT FALSE,
  approved_tournament_id UUID REFERENCES tournaments(id),

  name TEXT NOT NULL,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  buy_in INTEGER NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'NLH',
  format TEXT NOT NULL DEFAULT 'Re-entry',
  table_size INTEGER NOT NULL DEFAULT 9,
  venue_name TEXT NOT NULL,
  guaranteed_prize INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_tournaments_created_by ON custom_tournaments(created_by);
CREATE INDEX idx_custom_tournaments_status ON custom_tournaments(status) WHERE status = 'pending';

-- RLS
ALTER TABLE custom_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own custom tournaments"
  ON custom_tournaments FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users insert own custom tournaments"
  ON custom_tournaments FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own custom tournaments"
  ON custom_tournaments FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users delete own custom tournaments"
  ON custom_tournaments FOR DELETE
  USING (auth.uid() = created_by);
```

**Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applies successfully. May need `npx supabase migration repair --status applied 20260225` first if the sharing migration date conflicts.

**Step 3: Commit**

```bash
git add supabase/migrations/20260225_add_custom_tournaments.sql
git commit -m "feat: add custom_tournaments table with RLS"
```

---

### Task 2: Add TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add CustomTournament interface**

Add after the `UserScheduleEntry` interface:

```typescript
export interface CustomTournament {
  id: string
  created_by: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  is_public: boolean
  approved_tournament_id: string | null

  name: string
  date: string
  day_of_week: string
  start_time: string
  buy_in: number
  game_type: string
  format: string
  table_size: number
  venue_name: string
  guaranteed_prize: number | null
  notes: string | null
  created_at: string
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add CustomTournament type"
```

---

### Task 3: Custom Tournaments CRUD API

**Files:**
- Create: `src/app/api/custom-tournaments/route.ts`

**Step 1: Implement GET, POST, PATCH, DELETE**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('custom_tournaments')
    .select('*')
    .eq('created_by', user.id)
    .order('date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Compute day_of_week from date
  const dateObj = new Date(body.date + 'T12:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayOfWeek = days[dateObj.getUTCDay()]

  const tournament = {
    created_by: user.id,
    status: body.is_public ? 'pending' : 'draft',
    is_public: body.is_public ?? false,
    name: body.name,
    date: body.date,
    day_of_week: dayOfWeek,
    start_time: body.start_time,
    buy_in: body.buy_in,
    game_type: body.game_type ?? 'NLH',
    format: body.format ?? 'Re-entry',
    table_size: body.table_size ?? 9,
    venue_name: body.venue_name,
    guaranteed_prize: body.guaranteed_prize ?? null,
    notes: body.notes ?? null,
  }

  const { data, error } = await supabase
    .from('custom_tournaments')
    .insert(tournament)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Recompute day_of_week if date changed
  if (updates.date) {
    const dateObj = new Date(updates.date + 'T12:00:00')
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    updates.day_of_week = days[dateObj.getUTCDay()]
  }

  const { data, error } = await supabase
    .from('custom_tournaments')
    .update(updates)
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('custom_tournaments')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/custom-tournaments/route.ts
git commit -m "feat: add custom tournaments CRUD API"
```

---

### Task 4: Custom Tournaments Hook

**Files:**
- Create: `src/hooks/use-custom-tournaments.ts`

**Step 1: Implement the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CustomTournament } from '@/types'

export function useCustomTournaments() {
  const [customTournaments, setCustomTournaments] = useState<CustomTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomTournaments = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/custom-tournaments')
      if (res.status === 401) {
        setCustomTournaments([])
        setLoading(false)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch custom tournaments')
      }
      const data = await res.json()
      setCustomTournaments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomTournaments()
  }, [fetchCustomTournaments])

  const createCustomTournament = useCallback(
    async (tournament: Omit<CustomTournament, 'id' | 'created_by' | 'status' | 'approved_tournament_id' | 'day_of_week' | 'created_at'>) => {
      const res = await fetch('/api/custom-tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournament),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create custom tournament')
      }
      await fetchCustomTournaments()
      return await res.json()
    },
    [fetchCustomTournaments]
  )

  const deleteCustomTournament = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/custom-tournaments?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      await fetchCustomTournaments()
    },
    [fetchCustomTournaments]
  )

  return {
    customTournaments,
    loading,
    error,
    createCustomTournament,
    deleteCustomTournament,
    refetch: fetchCustomTournaments,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-custom-tournaments.ts
git commit -m "feat: add useCustomTournaments hook"
```

---

### Task 5: Add Custom Tournament Form Page

**Files:**
- Create: `src/app/custom/new/page.tsx`

**Step 1: Build the form page**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useCustomTournaments } from '@/hooks/use-custom-tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Plus, LogIn } from 'lucide-react'
import Link from 'next/link'

const GAME_TYPES = ['NLH', 'PLO', 'PLO8', 'Mixed', 'Stud', 'Razz', 'Limit Hold\'em', 'Big O', 'Badugi']
const FORMATS = ['Re-entry', 'Freezeout', 'Deepstack', 'Bounty', 'Mystery Bounty', 'Turbo']
const TABLE_SIZES = [6, 8, 9, 10]

export default function NewCustomTournamentPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { createCustomTournament } = useCustomTournaments()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('12:00')
  const [buyIn, setBuyIn] = useState('')
  const [gameType, setGameType] = useState('NLH')
  const [format, setFormat] = useState('Re-entry')
  const [tableSize, setTableSize] = useState('9')
  const [venueName, setVenueName] = useState('')
  const [guarantee, setGuarantee] = useState('')
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name || !date || !startTime || !buyIn || !venueName) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      await createCustomTournament({
        name,
        date,
        start_time: startTime,
        buy_in: parseInt(buyIn, 10),
        game_type: gameType,
        format,
        table_size: parseInt(tableSize, 10),
        venue_name: venueName,
        guaranteed_prize: guarantee ? parseInt(guarantee, 10) : null,
        notes: notes || null,
        is_public: isPublic,
      })
      router.push('/schedule')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Plus className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Sign in to add custom tournaments</p>
        </div>
        <Button asChild>
          <Link href="/login?next=/custom/new">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/schedule">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Add Custom Tournament</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tournament Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tournament Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. $200 NLH Daily" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyIn">Buy-in ($) *</Label>
                <Input id="buyIn" type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="200" min="0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guarantee">Guarantee ($)</Label>
                <Input id="guarantee" type="number" value={guarantee} onChange={(e) => setGuarantee(e.target.value)} placeholder="Optional" min="0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueName">Venue *</Label>
              <Input id="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Bellagio, Home Game, etc." required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Game Type</Label>
                <Select value={gameType} onValueChange={setGameType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GAME_TYPES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Table Size</Label>
                <Select value={tableSize} onValueChange={setTableSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TABLE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}-max</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <div>
                <p className="text-sm font-medium">Submit to public database</p>
                <p className="text-xs text-muted-foreground">If approved by admin, other users will be able to see this tournament</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/schedule">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add Tournament'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/custom/new/page.tsx
git commit -m "feat: add custom tournament form page"
```

---

### Task 6: Integrate Custom Tournaments into Schedule

**Files:**
- Modify: `src/app/schedule/page.tsx` (imports, hooks, merge logic, add button)
- Modify: `src/types/index.ts` (ensure `UserScheduleEntry.tournament` can be optional for custom)

**Step 1: Update schedule page to fetch and merge custom tournaments**

Add import at top of `src/app/schedule/page.tsx`:

```typescript
import { useCustomTournaments } from '@/hooks/use-custom-tournaments'
import { CustomTournament } from '@/types'
import { Plus } from 'lucide-react'
```

Add the hook call after existing hooks:

```typescript
const { customTournaments, loading: customLoading } = useCustomTournaments()
```

Update the loading check to include customLoading:

```typescript
const loading = userLoading || scheduleLoading || favLoading || customLoading
```

**Step 2: Convert custom tournaments to UserScheduleEntry format for the calendar**

Add a conversion function inside the component:

```typescript
// Convert custom tournaments to schedule entry format for unified display
const customEntries: UserScheduleEntry[] = customTournaments.map((ct) => ({
  id: `custom-${ct.id}`,
  user_id: ct.created_by,
  tournament_id: ct.id,
  priority: 'target' as const,
  notes: ct.notes,
  created_at: ct.created_at,
  tournament: {
    id: ct.id,
    series_id: '',
    event_number: 0,
    name: ct.name,
    date: ct.date,
    day_of_week: ct.day_of_week,
    start_time: ct.start_time,
    buy_in: ct.buy_in,
    game_type: ct.game_type,
    format: ct.format,
    table_size: ct.table_size,
    starting_stack: null,
    blind_levels_minutes: null,
    late_reg_levels: null,
    late_reg_end_time: null,
    guaranteed_prize: ct.guaranteed_prize,
    is_flight: false,
    flight_label: null,
    parent_event_number: null,
    estimated_duration_hours: null,
    notes: null,
    created_at: ct.created_at,
    series: { id: '', name: ct.venue_name, venue: ct.venue_name },
  },
}))

const allEntries = [...entries, ...customEntries].sort((a, b) => {
  const dateA = a.tournament?.date ?? ''
  const dateB = b.tournament?.date ?? ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  const timeA = a.tournament?.start_time ?? ''
  const timeB = b.tournament?.start_time ?? ''
  return timeA.localeCompare(timeB)
})
```

**Step 3: Pass allEntries to ScheduleCalendar instead of entries**

Replace `entries` with `allEntries` in the `ScheduleCalendar` component and in the entry count displays.

**Step 4: Add "Add Custom Tournament" button next to Export**

In the header buttons area, add:

```tsx
<Button variant="outline" size="sm" asChild>
  <Link href="/custom/new">
    <Plus className="size-4 mr-2" />
    Add Tournament
  </Link>
</Button>
```

**Step 5: Commit**

```bash
git add src/app/schedule/page.tsx
git commit -m "feat: integrate custom tournaments into schedule view"
```

---

### Task 7: Ensure Select and Textarea Components Exist

**Files:**
- Check if `src/components/ui/select.tsx` exists
- Check if `src/components/ui/textarea.tsx` exists

**Step 1: Install missing shadcn components**

Run:
```bash
npx shadcn@latest add select textarea -y
```

If they already exist, this is a no-op.

**Step 2: Commit if any new files created**

```bash
git add src/components/ui/select.tsx src/components/ui/textarea.tsx 2>/dev/null
git diff --cached --quiet || git commit -m "feat: add select and textarea shadcn components"
```

---

### Task 8: Build, Push, Deploy

**Step 1: Build**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Apply migration**

Run: `npx supabase db push`
May need: `npx supabase migration repair --status applied 20260225` if the sharing migration collides.

**Step 3: Push and deploy**

```bash
git push
```

**Step 4: Verify**

1. Go to nextrebuy.com/schedule
2. Click "Add Tournament" button
3. Fill out form, submit
4. Verify it appears on the schedule calendar
5. Verify it shows on the trip planner
