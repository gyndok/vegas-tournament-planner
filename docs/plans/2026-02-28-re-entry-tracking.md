# Re-Entry Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to re-enter tournaments (when format permits), tracking each entry separately with its own result for accurate P&L.

**Architecture:** Multiple rows in `user_schedule` per tournament (one per entry). Each row links to its own `tournament_result`. The `entry_number` column distinguishes entries. Re-entry eligibility is determined by the tournament's `format` field containing "Re-entry".

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres), React 19, TypeScript, Tailwind CSS, shadcn/ui

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260228_add_reentry_support.sql`

**Step 1: Write the migration**

```sql
-- Add entry_number column to user_schedule
ALTER TABLE user_schedule
  ADD COLUMN entry_number INTEGER NOT NULL DEFAULT 1;

-- Drop the old unique constraint (user_id, tournament_id)
ALTER TABLE user_schedule
  DROP CONSTRAINT user_schedule_user_id_tournament_id_key;

-- Add new unique constraint including entry_number
ALTER TABLE user_schedule
  ADD CONSTRAINT user_schedule_user_id_tournament_id_entry_number_key
  UNIQUE (user_id, tournament_id, entry_number);
```

**Step 2: Run migration against Supabase**

Run: `npx supabase db push` or apply via the Supabase dashboard SQL editor.

**Step 3: Commit**

```bash
git add supabase/migrations/20260228_add_reentry_support.sql
git commit -m "feat: add entry_number column to user_schedule for re-entry tracking"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts` (lines 57-65, `UserScheduleEntry` interface)

**Step 1: Add `entry_number` to `UserScheduleEntry`**

Update the interface from:

```typescript
export interface UserScheduleEntry {
  id: string
  user_id: string
  tournament_id: string
  priority: 'target' | 'backup' | 'maybe'
  notes: string | null
  created_at: string
  tournament?: Tournament
}
```

To:

```typescript
export interface UserScheduleEntry {
  id: string
  user_id: string
  tournament_id: string
  entry_number: number
  priority: 'target' | 'backup' | 'maybe'
  notes: string | null
  created_at: string
  tournament?: Tournament
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (entry_number is returned by Supabase but not used anywhere yet)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add entry_number to UserScheduleEntry type"
```

---

### Task 3: Update Schedule API to Support Re-Entries

**Files:**
- Modify: `src/app/api/schedule/route.ts` (lines 37-95, POST handler)

**Step 1: Update POST handler to support re-entries**

Replace the existing POST handler. Key changes:
- Accept optional `is_reentry` boolean in request body
- If `is_reentry` is true, find the max `entry_number` for that user+tournament and increment
- If `is_reentry` is false (default), keep the existing duplicate check for first entries
- Also check that the tournament format allows re-entry before permitting it

Replace lines 37-95 with:

```typescript
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { tournament_id, priority, notes, is_reentry } = body

  if (!tournament_id || !priority) {
    return NextResponse.json(
      { error: 'tournament_id and priority are required' },
      { status: 400 }
    )
  }

  if (!['target', 'backup', 'maybe'].includes(priority)) {
    return NextResponse.json(
      { error: 'priority must be target, backup, or maybe' },
      { status: 400 }
    )
  }

  // Check existing entries for this user + tournament
  const { data: existingEntries } = await supabase
    .from('user_schedule')
    .select('id, entry_number')
    .eq('user_id', user.id)
    .eq('tournament_id', tournament_id)
    .order('entry_number', { ascending: false })

  if (is_reentry) {
    // Verify tournament format allows re-entry
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('format')
      .eq('id', tournament_id)
      .single()

    if (!tournament || !tournament.format.toLowerCase().includes('re-entry')) {
      return NextResponse.json(
        { error: 'This tournament does not allow re-entries' },
        { status: 400 }
      )
    }

    if (!existingEntries || existingEntries.length === 0) {
      return NextResponse.json(
        { error: 'Cannot re-enter a tournament not in your schedule' },
        { status: 400 }
      )
    }

    const nextEntryNumber = (existingEntries[0].entry_number ?? 1) + 1

    const { data, error } = await supabase
      .from('user_schedule')
      .insert({
        user_id: user.id,
        tournament_id,
        entry_number: nextEntryNumber,
        priority,
        notes: notes ?? null,
      })
      .select('*, tournament:tournament_id(*, series:series_id(id, name, venue))')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  }

  // Standard first entry — reject if already exists
  if (existingEntries && existingEntries.length > 0) {
    return NextResponse.json(
      { error: 'Tournament already in schedule' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('user_schedule')
    .insert({
      user_id: user.id,
      tournament_id,
      priority,
      notes: notes ?? null,
      entry_number: 1,
    })
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/schedule/route.ts
git commit -m "feat: schedule API supports re-entries with entry_number tracking"
```

---

### Task 4: Update Schedule Hook with `reenterTournament`

**Files:**
- Modify: `src/hooks/use-schedule.ts`

**Step 1: Add `reenterTournament` function**

Add after the existing `addToSchedule` callback (after line 51):

```typescript
const reenterTournament = useCallback(
  async (tournamentId: string) => {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: tournamentId,
        priority: 'target',
        is_reentry: true,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to re-enter tournament')
    }
    await fetchSchedule()
  },
  [fetchSchedule]
)
```

**Step 2: Add helper to count entries per tournament**

Add before the return statement:

```typescript
const getEntryCount = useCallback(
  (tournamentId: string) => {
    return entries.filter((e) => e.tournament_id === tournamentId).length
  },
  [entries]
)
```

**Step 3: Update the return object**

Add `reenterTournament` and `getEntryCount` to the returned object:

```typescript
return {
  entries,
  loading,
  error,
  addToSchedule,
  removeFromSchedule,
  updateEntry,
  reenterTournament,
  getEntryCount,
  refetch: fetchSchedule,
}
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-schedule.ts
git commit -m "feat: add reenterTournament and getEntryCount to schedule hook"
```

---

### Task 5: Update AddToScheduleButton for Re-Entry

**Files:**
- Modify: `src/components/add-to-schedule-button.tsx`

**Step 1: Update to show "Re-enter" when already scheduled and format allows**

The component needs a new prop `tournamentFormat` to know if re-entry is allowed. Update the component:

Add to the props interface:

```typescript
interface AddToScheduleButtonProps {
  tournamentId: string
  tournamentFormat?: string
}
```

Update the function signature:

```typescript
export function AddToScheduleButton({ tournamentId, tournamentFormat }: AddToScheduleButtonProps)
```

Add `reenterTournament` and `getEntryCount` to the hook destructuring:

```typescript
const { entries, loading: scheduleLoading, addToSchedule, removeFromSchedule, reenterTournament, getEntryCount } = useSchedule()
```

Add re-entry logic:

```typescript
const existingEntry = entries.find((e) => e.tournament_id === tournamentId)
const isInSchedule = !!existingEntry
const entryCount = getEntryCount(tournamentId)
const allowsReentry = tournamentFormat?.toLowerCase().includes('re-entry') ?? false
```

Replace the "Already in schedule" section (lines 104-127) with:

```tsx
if (isInSchedule) {
  return (
    <div className="pt-2">
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleRemove}
          disabled={actionLoading}
          className="gap-2 bg-primary hover:bg-primary/90 text-white"
          size="lg"
        >
          {actionLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarCheck className="size-4" />
          )}
          In Schedule{entryCount > 1 ? ` (${entryCount} entries)` : ''}
        </Button>
        {allowsReentry && (
          <Button
            onClick={handleReenter}
            disabled={actionLoading}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <RotateCcw className="size-4" />
            Re-enter
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-primary mt-2">{success}</p>
      )}
    </div>
  )
}
```

Add the `handleReenter` function (after `handleRemove`):

```typescript
async function handleReenter() {
  if (!user) return

  setError(null)
  setSuccess(null)
  setActionLoading(true)

  try {
    await reenterTournament(tournamentId)
    setSuccess('Re-entry added!')
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to re-enter')
    setTimeout(() => setError(null), 4000)
  } finally {
    setActionLoading(false)
  }
}
```

Add `RotateCcw` to the lucide-react imports:

```typescript
import { CalendarPlus, CalendarCheck, Loader2, RotateCcw } from 'lucide-react'
```

**Step 2: Update tournament detail page to pass format prop**

In `src/app/tournament/[id]/page.tsx`, update line 223:

From: `<AddToScheduleButton tournamentId={tournament.id} />`

To: `<AddToScheduleButton tournamentId={tournament.id} tournamentFormat={tournament.format} />`

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/add-to-schedule-button.tsx src/app/tournament/\\[id\\]/page.tsx
git commit -m "feat: add Re-enter button on tournament detail page"
```

---

### Task 6: Update Trip Day Card for Re-Entry Display

**Files:**
- Modify: `src/components/trip-day-card.tsx`

**Step 1: Add re-enter button and entry count to trip day cards**

Update `TripDayCardProps` to include `onReenter`:

```typescript
interface TripDayCardProps {
  date: string
  dayLabel: string
  dayNumber: number
  scheduledEntries: UserScheduleEntry[]
  availableTournaments: Tournament[]
  onQuickAdd: (tournamentId: string) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
  onReenter: (tournamentId: string) => Promise<void>
  getResultForEntry: (scheduleEntryId: string) => TournamentResult | null
  onLogResult: (scheduleEntryId: string, data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onUpdateResult: (resultId: string, data: { result_amount?: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onDeleteResult: (resultId: string) => Promise<void>
}
```

Add `onReenter` to the destructured props and add `RotateCcw` to imports:

```typescript
import { ChevronDown, ChevronUp, CalendarPlus, Trash2, Search, Trophy, Pencil, RotateCcw } from 'lucide-react'
```

In the scheduled entries rendering, after the remove button (around line 151-159), add a re-enter button for tournaments whose format allows it. Inside the `scheduledEntries.map()`, after the delete button:

```tsx
{t.format?.toLowerCase().includes('re-entry') && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => onReenter(t.id)}
    className="text-muted-foreground hover:text-primary"
    title="Re-enter"
  >
    <RotateCcw className="size-4" />
  </Button>
)}
```

For the entry count display, update the buy-in display line (line 123) to show entry count when > 1:

Find the line: `<p className="text-xs text-muted-foreground">{formatBuyIn(t.buy_in)}</p>`

To determine if this tournament has multiple entries, count how many entries in `scheduledEntries` share the same `tournament_id`:

```tsx
{(() => {
  const entryCount = scheduledEntries.filter(e => e.tournament_id === t.id).length
  return (
    <p className="text-xs text-muted-foreground">
      {entryCount > 1
        ? `Entry ${entry.entry_number} · ${formatBuyIn(t.buy_in)}`
        : formatBuyIn(t.buy_in)}
    </p>
  )
})()}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (will show errors if trip page doesn't pass `onReenter` yet — fix in next task)

**Step 3: Commit**

```bash
git add src/components/trip-day-card.tsx
git commit -m "feat: trip day card shows re-enter button and entry numbers"
```

---

### Task 7: Wire Up Trip Planner Page

**Files:**
- Modify: `src/app/trip/page.tsx`

**Step 1: Pass `onReenter` to TripDayCard**

In `src/app/trip/page.tsx`, find where `<TripDayCard>` is rendered. Add the `onReenter` prop, using the `reenterTournament` function from the schedule hook.

Make sure the schedule hook destructuring includes `reenterTournament`:

```typescript
const { entries: scheduleEntries, ..., reenterTournament } = useSchedule()
```

Pass to TripDayCard:

```tsx
onReenter={async (tournamentId) => {
  try {
    await reenterTournament(tournamentId)
  } catch {
    // handle silently or show toast
  }
}}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/trip/page.tsx
git commit -m "feat: wire re-enter action into trip planner page"
```

---

### Task 8: Update Shared Schedule API

**Files:**
- Modify: `src/app/api/schedule/shared/[token]/route.ts` (line 29)

**Step 1: Include `entry_number` in the shared schedule select**

Update the select query to include `entry_number`:

From:
```typescript
.select('id, user_id, tournament_id, priority, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
```

To:
```typescript
.select('id, user_id, tournament_id, entry_number, priority, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
```

**Step 2: Commit**

```bash
git add src/app/api/schedule/shared/\\[token\\]/route.ts
git commit -m "feat: include entry_number in shared schedule API response"
```

---

### Task 9: Final Verification

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors

**Step 2: Test manually**

1. Navigate to a tournament with "Re-entry" format → verify "Add to Schedule" works
2. After adding, verify "In Schedule" button appears WITH a "Re-enter" button next to it
3. Click "Re-enter" → verify success message, button now shows "(2 entries)"
4. Check Trip Planner → verify the tournament shows with entry numbers and correct total buy-in
5. Verify Freezeout tournaments do NOT show "Re-enter" button
6. Log a result for each entry independently

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete re-entry tracking for tournament events"
```
