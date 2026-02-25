# Bankroll Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let players log tournament results and see trip P&L on the Trip Planner page.

**Architecture:** New `tournament_results` table (one result per schedule entry), CRUD API at `/api/results`, `useResults` hook, "Log Result" dialog on trip day cards, results summary section on trip page.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js API routes, shadcn Dialog, React hooks

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260227_add_tournament_results.sql`

**Step 1: Create migration**

```sql
-- Tournament results table
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_entry_id UUID REFERENCES user_schedule(id) ON DELETE CASCADE NOT NULL UNIQUE,
  result_amount INTEGER NOT NULL,
  finish_position INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournament_results_user ON tournament_results(user_id);
CREATE INDEX idx_tournament_results_entry ON tournament_results(schedule_entry_id);

-- RLS
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own results"
  ON tournament_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own results"
  ON tournament_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own results"
  ON tournament_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own results"
  ON tournament_results FOR DELETE
  USING (auth.uid() = user_id);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260227_add_tournament_results.sql
git commit -m "feat: add tournament_results table migration"
```

---

### Task 2: TypeScript Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add TournamentResult interface**

Add after the `CustomTournament` interface:

```typescript
export interface TournamentResult {
  id: string
  user_id: string
  schedule_entry_id: string
  result_amount: number
  finish_position: number | null
  notes: string | null
  created_at: string
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TournamentResult type"
```

---

### Task 3: Results CRUD API

**Files:**
- Create: `src/app/api/results/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { schedule_entry_id, result_amount, finish_position, notes } = body

  if (!schedule_entry_id || result_amount === undefined) {
    return NextResponse.json({ error: 'schedule_entry_id and result_amount are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tournament_results')
    .insert({
      user_id: user.id,
      schedule_entry_id,
      result_amount: parseInt(result_amount, 10),
      finish_position: finish_position ? parseInt(finish_position, 10) : null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Result already logged for this tournament' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (updates.result_amount !== undefined) updateData.result_amount = parseInt(updates.result_amount, 10)
  if (updates.finish_position !== undefined) updateData.finish_position = updates.finish_position ? parseInt(updates.finish_position, 10) : null
  if (updates.notes !== undefined) updateData.notes = updates.notes || null

  const { data, error } = await supabase
    .from('tournament_results')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('tournament_results')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/results/route.ts
git commit -m "feat: add tournament results CRUD API"
```

---

### Task 4: useResults Hook

**Files:**
- Create: `src/hooks/use-results.ts`

**Step 1: Create the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { TournamentResult } from '@/types'

export function useResults() {
  const [results, setResults] = useState<TournamentResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/results')
      if (res.status === 401) {
        setResults([])
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch results')
      const data = await res.json()
      setResults(data)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const createResult = useCallback(async (data: {
    schedule_entry_id: string
    result_amount: number
    finish_position?: number | null
    notes?: string | null
  }) => {
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to create result')
    }
    await fetchResults()
  }, [fetchResults])

  const updateResult = useCallback(async (id: string, updates: {
    result_amount?: number
    finish_position?: number | null
    notes?: string | null
  }) => {
    const res = await fetch('/api/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to update result')
    }
    await fetchResults()
  }, [fetchResults])

  const deleteResult = useCallback(async (id: string) => {
    const res = await fetch(`/api/results?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to delete result')
    }
    await fetchResults()
  }, [fetchResults])

  // Helper: get result by schedule entry ID
  const getResultForEntry = useCallback((scheduleEntryId: string) => {
    return results.find(r => r.schedule_entry_id === scheduleEntryId) ?? null
  }, [results])

  return { results, loading, createResult, updateResult, deleteResult, getResultForEntry, refetch: fetchResults }
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-results.ts
git commit -m "feat: add useResults hook"
```

---

### Task 5: Install shadcn Dialog

**Step 1: Install**

```bash
npx shadcn@latest add dialog
```

**Step 2: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "chore: add shadcn dialog component"
```

---

### Task 6: Log Result Dialog Component

**Files:**
- Create: `src/components/log-result-dialog.tsx`

**Step 1: Create the dialog component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { TournamentResult } from '@/types'

interface LogResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentName: string
  buyIn: number
  existingResult?: TournamentResult | null
  onSave: (data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
}

export function LogResultDialog({
  open,
  onOpenChange,
  tournamentName,
  buyIn,
  existingResult,
  onSave,
  onDelete,
}: LogResultDialogProps) {
  const [resultAmount, setResultAmount] = useState('')
  const [finishPosition, setFinishPosition] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      if (existingResult) {
        setResultAmount(String(existingResult.result_amount))
        setFinishPosition(existingResult.finish_position ? String(existingResult.finish_position) : '')
        setNotes(existingResult.notes || '')
      } else {
        setResultAmount('')
        setFinishPosition('')
        setNotes('')
      }
    }
  }, [open, existingResult])

  const profit = resultAmount ? parseInt(resultAmount, 10) - buyIn : null

  async function handleSave() {
    if (!resultAmount) return
    setSaving(true)
    try {
      await onSave({
        result_amount: parseInt(resultAmount, 10),
        finish_position: finishPosition ? parseInt(finishPosition, 10) : null,
        notes: notes || null,
      })
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingResult ? 'Edit Result' : 'Log Result'}</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{tournamentName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resultAmount">Cash Out Amount ($) *</Label>
            <Input
              id="resultAmount"
              type="number"
              value={resultAmount}
              onChange={(e) => setResultAmount(e.target.value)}
              placeholder={`0 if busted (buy-in was $${buyIn})`}
              min="0"
              required
            />
            {profit !== null && (
              <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {profit >= 0 ? '+' : ''}{profit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} net
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="finishPosition">Finish Position</Label>
            <Input
              id="finishPosition"
              type="number"
              value={finishPosition}
              onChange={(e) => setFinishPosition(e.target.value)}
              placeholder="Optional (e.g. 3)"
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultNotes">Notes</Label>
            <Textarea
              id="resultNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existingResult && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="sm:mr-auto">
              {deleting ? 'Deleting...' : 'Delete Result'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !resultAmount}>
            {saving ? 'Saving...' : existingResult ? 'Update' : 'Save Result'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/log-result-dialog.tsx
git commit -m "feat: add LogResultDialog component"
```

---

### Task 7: Integrate Results into Trip Day Card

**Files:**
- Modify: `src/components/trip-day-card.tsx`

**Step 1: Add result display and log button**

Update the `TripDayCardProps` interface to accept results data:

```typescript
// Add to imports
import { TournamentResult } from '@/types'
import { LogResultDialog } from '@/components/log-result-dialog'
import { Trophy } from 'lucide-react'
import { formatBuyIn } from '@/lib/utils'

// Update interface
interface TripDayCardProps {
  date: string
  dayLabel: string
  dayNumber: number
  scheduledEntries: UserScheduleEntry[]
  availableTournaments: Tournament[]
  onQuickAdd: (tournamentId: string) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
  getResultForEntry: (scheduleEntryId: string) => TournamentResult | null
  onLogResult: (scheduleEntryId: string, data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onUpdateResult: (resultId: string, data: { result_amount?: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onDeleteResult: (resultId: string) => Promise<void>
}
```

For each scheduled entry, after the tournament info and before the remove button, show either:
- A green/red result badge if result exists (clickable to edit)
- A "Log Result" button if no result

Add dialog state inside the component and render `<LogResultDialog />`.

Full details: see the existing `trip-day-card.tsx` structure above. The key additions are:
1. State: `const [dialogEntry, setDialogEntry] = useState<UserScheduleEntry | null>(null)`
2. In each scheduled entry row, add a result badge or log button between the link and the remove button
3. Render `<LogResultDialog>` at the bottom of the component

**Step 2: Commit**

```bash
git add src/components/trip-day-card.tsx
git commit -m "feat: integrate results into trip day cards"
```

---

### Task 8: Add Results Summary to Trip Planner

**Files:**
- Modify: `src/app/trip/page.tsx`

**Step 1: Add useResults and summary section**

Add `useResults` to the trip page. Between the budget bar and the summary stats grid, add a results summary section showing:

- **Net P&L** — sum of (result_amount - buy_in) for all logged results
- **Played** — count of results out of total scheduled
- **ROI** — (net P&L / total buy-ins) × 100

Pass `getResultForEntry`, `createResult`, `updateResult`, `deleteResult` down to `TripDayCard`.

**Step 2: Commit**

```bash
git add src/app/trip/page.tsx
git commit -m "feat: add results summary to trip planner"
```

---

### Task 9: Build, Migrate, Push, Deploy

**Step 1: Build**
```bash
npx next build
```

**Step 2: Apply migration**
```bash
npx supabase db push
```

**Step 3: Push and deploy**
```bash
git push
npx vercel --prod
```
