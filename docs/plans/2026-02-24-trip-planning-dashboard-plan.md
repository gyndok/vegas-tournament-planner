# Trip Planning Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/trip` page with a day-by-day itinerary view showing scheduled + available tournaments, plus a budget tracker with progress bar.

**Architecture:** Reuse existing `user_preferences` for trip dates (already stored) and budget (new column). The page fetches schedule entries and available tournaments for the trip date range, then groups everything by day client-side. Quick-add uses the existing schedule API.

**Tech Stack:** Next.js 16, React 19, Supabase, Tailwind CSS 4, shadcn/ui, lucide-react

---

### Task 1: Add `trip_budget` column to user_preferences

**Files:**
- Create: `supabase/migrations/20260224_add_trip_budget.sql`
- Modify: `src/types/index.ts:37-52`
- Modify: `src/app/api/preferences/route.ts:39-51`

**Step 1: Create migration file**

Create `supabase/migrations/20260224_add_trip_budget.sql`:

```sql
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS trip_budget integer;
```

**Step 2: Add to TypeScript type**

In `src/types/index.ts`, add `trip_budget: number | null` to the `UserPreferences` interface after `trip_end`:

```typescript
  trip_end: string | null
  trip_budget: number | null
  created_at: string
```

**Step 3: Handle in API route**

In `src/app/api/preferences/route.ts`, add `trip_budget` to the preferences object in the PUT handler (around line 50):

```typescript
    trip_end: body.trip_end ?? null,
    trip_budget: body.trip_budget ?? null,
    updated_at: new Date().toISOString(),
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add supabase/migrations/20260224_add_trip_budget.sql src/types/index.ts src/app/api/preferences/route.ts
git commit -m "feat: add trip_budget column to user_preferences"
```

---

### Task 2: Add budget input to Settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

**Step 1: Add budget state variable**

After the `tripEnd` state (around line 33), add:

```typescript
  const [tripBudget, setTripBudget] = useState<string>('')
```

**Step 2: Load budget from preferences**

In the `loadPreferences` callback, after `setTripEnd` (around line 49), add:

```typescript
          setTripBudget(data.trip_budget?.toString() ?? '')
```

**Step 3: Include budget in save payload**

In `handleSave`, after `trip_end` in the JSON body (around line 92), add:

```typescript
          trip_budget: tripBudget ? Number(tripBudget) : null,
```

**Step 4: Add budget field to Trip Dates card UI**

In the Trip Dates card (around line 298-327), add a budget input after the date pickers div. Place it after the closing `</div>` of the date pickers grid and before the card's closing `</CardContent>`:

```tsx
          <div className="mt-4 space-y-2">
            <Label htmlFor="tripBudget">Trip Budget ($)</Label>
            <Input
              id="tripBudget"
              type="number"
              min="0"
              placeholder="5000"
              value={tripBudget}
              onChange={(e) => setTripBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Set a total buy-in budget for your trip to track spending.
            </p>
          </div>
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add trip budget input to settings page"
```

---

### Task 3: Add "Trip" nav item to sidebar

**Files:**
- Modify: `src/components/left-sidebar.tsx:6-36`

**Step 1: Import Plane icon**

Add `Plane` to the lucide-react import (line 6-18):

```typescript
import {
  LayoutDashboard,
  Search,
  Calendar,
  MessageSquare,
  Settings,
  Plane,
  // ... rest of existing imports
} from 'lucide-react'
```

**Step 2: Add Trip to navItems**

In the `navItems` array (line 30-36), add Trip after My Schedule:

```typescript
const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/schedule', label: 'My Schedule', icon: Calendar },
  { href: '/trip', label: 'Trip Planner', icon: Plane },
  { href: '/chat', label: 'AI Advisor', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
]
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/components/left-sidebar.tsx
git commit -m "feat: add Trip Planner nav item to sidebar"
```

---

### Task 4: Create TripDayCard component

**Files:**
- Create: `src/components/trip-day-card.tsx`

**Step 1: Create the component**

Create `src/components/trip-day-card.tsx`. This component renders a single day of the trip itinerary:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tournament, UserScheduleEntry } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSeriesColor, formatBuyIn, formatTime } from '@/lib/utils'
import { ChevronDown, ChevronUp, CalendarPlus, Trash2, Search } from 'lucide-react'

const PRIORITY_CONFIG = {
  target: { label: 'Target', className: 'bg-primary text-primary-foreground' },
  backup: { label: 'Backup', className: 'bg-yellow-600 text-white' },
  maybe: { label: 'Maybe', className: 'bg-gray-600 text-white' },
}

interface TripDayCardProps {
  date: string
  dayLabel: string
  dayNumber: number
  scheduledEntries: UserScheduleEntry[]
  availableTournaments: Tournament[]
  onQuickAdd: (tournamentId: string) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
}

export function TripDayCard({
  date,
  dayLabel,
  dayNumber,
  scheduledEntries,
  availableTournaments,
  onQuickAdd,
  onRemove,
}: TripDayCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleQuickAdd = async (tournamentId: string) => {
    setAddingId(tournamentId)
    try {
      await onQuickAdd(tournamentId)
    } finally {
      setAddingId(null)
    }
  }

  const handleRemove = async (entryId: string) => {
    setRemovingId(entryId)
    try {
      await onRemove(entryId)
    } finally {
      setRemovingId(null)
    }
  }

  const totalBuyIn = scheduledEntries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0)

  return (
    <Card>
      <CardContent className="p-4">
        {/* Day header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
              {dayNumber}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{dayLabel}</h3>
              <p className="text-xs text-muted-foreground">{date}</p>
            </div>
          </div>
          {scheduledEntries.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {scheduledEntries.length} tournament{scheduledEntries.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs font-medium">{formatBuyIn(totalBuyIn)}</p>
            </div>
          )}
        </div>

        {/* Scheduled tournaments */}
        {scheduledEntries.length > 0 ? (
          <div className="space-y-2 mb-3">
            {scheduledEntries.map((entry) => {
              const t = entry.tournament
              if (!t) return null
              const colors = getSeriesColor(t.series?.name || '', t.series?.venue, t.name)
              const priority = PRIORITY_CONFIG[entry.priority]
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-lg border-l-4 ${colors.border} bg-muted/50 p-3`}
                >
                  <Link href={`/tournament/${t.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{formatTime(t.start_time)}</span>
                      <Badge variant="outline" className={`text-[10px] ${colors.bg} ${colors.text} border-transparent`}>
                        {colors.label}
                      </Badge>
                      <Badge className={`text-[10px] ${priority.className}`}>
                        {priority.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate mt-1">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBuyIn(t.buy_in)}</p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(entry.id)}
                    disabled={removingId === entry.id}
                    className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 mb-3">
            <Search className="size-4" />
            <span>Free day — </span>
            <Link href={`/browse?dateFrom=${date}&dateTo=${date}`} className="text-primary hover:underline">
              browse tournaments
            </Link>
          </div>
        )}

        {/* Available tournaments (collapsible) */}
        {availableTournaments.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {availableTournaments.length} more tournament{availableTournaments.length !== 1 ? 's' : ''} available
            </button>

            {expanded && (
              <div className="space-y-1.5 mt-2">
                {availableTournaments.map((t) => {
                  const colors = getSeriesColor(t.series?.name || '', t.series?.venue, t.name)
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md bg-muted/30 p-2"
                    >
                      <Link href={`/tournament/${t.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatTime(t.start_time)}</span>
                          <Badge variant="outline" className={`text-[10px] ${colors.bg} ${colors.text} border-transparent`}>
                            {colors.label}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium truncate mt-0.5">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBuyIn(t.buy_in)}</p>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAdd(t.id)}
                        disabled={addingId === t.id}
                        className="shrink-0 ml-2 text-xs h-7"
                      >
                        <CalendarPlus className="size-3 mr-1" />
                        {addingId === t.id ? '...' : 'Add'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/trip-day-card.tsx
git commit -m "feat: create TripDayCard component for daily itinerary"
```

---

### Task 5: Create Trip Planning Dashboard page

**Files:**
- Create: `src/app/trip/page.tsx`

**Step 1: Create the page**

Create `src/app/trip/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { Tournament, UserPreferences } from '@/types'
import { TripDayCard } from '@/components/trip-day-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatBuyIn } from '@/lib/utils'
import { Plane, LogIn, Settings, CalendarDays, Loader2 } from 'lucide-react'

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const current = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (current <= last) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default function TripPage() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, addToSchedule, removeFromSchedule, refetch } = useSchedule()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(false)

  // Load preferences
  useEffect(() => {
    if (!user) {
      setPrefsLoading(false)
      return
    }
    async function loadPrefs() {
      try {
        const res = await fetch('/api/preferences')
        if (res.ok) {
          const data = await res.json()
          setPrefs(data)
        }
      } catch {
        // Ignore
      } finally {
        setPrefsLoading(false)
      }
    }
    loadPrefs()
  }, [user])

  const tripStart = prefs?.trip_start
  const tripEnd = prefs?.trip_end
  const tripBudget = prefs?.trip_budget
  const hasTrip = tripStart && tripEnd

  // Load available tournaments for trip dates
  useEffect(() => {
    if (!hasTrip) return
    async function loadTournaments() {
      setTournamentsLoading(true)
      try {
        const params = new URLSearchParams({
          dateFrom: tripStart!,
          dateTo: tripEnd!,
          limit: '500',
        })
        const res = await fetch(`/api/tournaments?${params}`)
        if (res.ok) {
          const result = await res.json()
          setAllTournaments(result.data || [])
        }
      } catch {
        // Ignore
      } finally {
        setTournamentsLoading(false)
      }
    }
    loadTournaments()
  }, [hasTrip, tripStart, tripEnd])

  // Compute trip days
  const tripDays = useMemo(() => {
    if (!tripStart || !tripEnd) return []
    return getDaysBetween(tripStart, tripEnd)
  }, [tripStart, tripEnd])

  // Scheduled tournament IDs for quick lookup
  const scheduledTournamentIds = useMemo(
    () => new Set(entries.map((e) => e.tournament_id)),
    [entries]
  )

  // Filter entries to trip date range
  const tripEntries = useMemo(
    () => entries.filter((e) => {
      const d = e.tournament?.date
      return d && d >= tripStart! && d <= tripEnd!
    }),
    [entries, tripStart, tripEnd]
  )

  // Budget computation
  const totalCommitted = useMemo(
    () => tripEntries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0),
    [tripEntries]
  )

  const budgetPercent = tripBudget ? Math.min((totalCommitted / tripBudget) * 100, 100) : 0
  const budgetColor = budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'

  // Quick add handler
  const handleQuickAdd = useCallback(async (tournamentId: string) => {
    await addToSchedule(tournamentId, 'target')
  }, [addToSchedule])

  const loading = userLoading || prefsLoading || scheduleLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Plane className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Sign in to plan your trip</p>
          <p className="text-muted-foreground text-sm mt-1">
            Create an account to build your Vegas tournament itinerary.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/trip">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  if (!hasTrip) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Plane className="size-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">Set your trip dates</p>
            <p className="text-muted-foreground text-sm mt-1">
              Head to Settings to enter your Vegas arrival and departure dates.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings">
              <Settings className="size-4 mr-2" />
              Go to Settings
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Trip Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="size-6" />
              Trip Planner
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateDisplay(tripStart)} — {formatDateDisplay(tripEnd)} · {tripDays.length} day{tripDays.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              <Settings className="size-4 mr-1" />
              Edit Trip
            </Link>
          </Button>
        </div>

        {/* Budget bar */}
        {tripBudget ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">{formatBuyIn(totalCommitted)} committed</span>
              <span className="text-muted-foreground">of {formatBuyIn(tripBudget)} budget</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${budgetColor}`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            {tripBudget - totalCommitted > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {formatBuyIn(tripBudget - totalCommitted)} remaining
              </p>
            ) : (
              <p className="text-xs text-red-500 mt-1">
                Budget exceeded by {formatBuyIn(totalCommitted - tripBudget)}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              {tripEntries.length > 0 && (
                <span>{formatBuyIn(totalCommitted)} in buy-ins · </span>
              )}
              <Link href="/settings" className="text-primary hover:underline">Set a budget</Link> to track spending.
            </p>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripEntries.length}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripDays.filter(d => tripEntries.some(e => e.tournament?.date === d)).length}</p>
            <p className="text-xs text-muted-foreground">Days Playing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripDays.length - tripDays.filter(d => tripEntries.some(e => e.tournament?.date === d)).length}</p>
            <p className="text-xs text-muted-foreground">Free Days</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily itinerary */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="size-5" />
          Daily Itinerary
        </h2>

        {tournamentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {tripDays.map((day, index) => {
              const dayEntries = tripEntries
                .filter((e) => e.tournament?.date === day)
                .sort((a, b) => (a.tournament?.start_time || '').localeCompare(b.tournament?.start_time || ''))

              const dayAvailable = allTournaments
                .filter((t) => t.date === day && !scheduledTournamentIds.has(t.id))
                .sort((a, b) => a.start_time.localeCompare(b.start_time))

              return (
                <TripDayCard
                  key={day}
                  date={day}
                  dayLabel={getDayLabel(day)}
                  dayNumber={index + 1}
                  scheduledEntries={dayEntries}
                  availableTournaments={dayAvailable}
                  onQuickAdd={handleQuickAdd}
                  onRemove={removeFromSchedule}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/trip/page.tsx
git commit -m "feat: create Trip Planning Dashboard page with itinerary and budget"
```

---

### Task 6: Apply migration, push, and deploy

**Step 1: Apply the Supabase migration**

```bash
npx supabase db push
```

Expected: Migration applies the `trip_budget` column.

**Step 2: Full build check**

Run: `npm run build 2>&1 | tail -10`
Expected: Clean build

**Step 3: Push to remote**

```bash
git push origin main
```

**Step 4: Deploy to Vercel**

Use vercel:deploy skill.
