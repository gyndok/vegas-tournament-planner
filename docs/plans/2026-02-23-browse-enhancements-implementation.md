# Browse Page Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "My Preferences" toggle that pre-fills browse filters from saved user preferences, and a guarantee filter with has/min/max and compound date+guarantee sorting.

**Architecture:** Client-side pre-fill approach. The existing URL search params are the single source of truth for filters. "My Preferences" toggle fetches from `/api/preferences` and batch-sets URL params. Guarantee filter adds new params to the existing filter system with backend query support.

**Tech Stack:** Next.js 16, React 19, Supabase, Radix UI Tabs, Tailwind CSS 4, shadcn/ui components

---

### Task 1: Extend TournamentFilters type with new fields

**Files:**
- Modify: `src/types/index.ts:64-78`

**Step 1: Add new filter fields to the TournamentFilters interface**

In `src/types/index.ts`, add these fields to the `TournamentFilters` interface:

```typescript
export interface TournamentFilters {
  dateFrom?: string
  dateTo?: string
  seriesIds?: string[]
  buyInMin?: number
  buyInMax?: number
  gameTypes?: string[]
  formats?: string[]
  tableSizes?: number[]
  startTimeFrom?: string    // NEW — e.g. "10:00"
  startTimeTo?: string      // NEW — e.g. "20:00"
  avoidTurbos?: boolean     // NEW
  hasGuarantee?: boolean    // NEW
  guaranteeMin?: number     // NEW
  guaranteeMax?: number     // NEW
  sortBy?: 'date' | 'buy_in_asc' | 'buy_in_desc' | 'guarantee_desc'
  limit?: number
  offset?: number
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds (no consumers of new fields yet)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add guarantee and preferences filter fields to TournamentFilters type"
```

---

### Task 2: Add guarantee filtering and compound sorting to query builder

**Files:**
- Modify: `src/lib/queries.ts`

**Step 1: Add guarantee and turbo filtering to buildTournamentQuery**

In `src/lib/queries.ts`, add these filters after the existing `startTimeTo` filter (line ~21) and before the sort switch:

```typescript
export function buildTournamentQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.seriesIds?.length) query = query.in('series_id', filters.seriesIds)
  if (filters.buyInMin !== undefined) query = query.gte('buy_in', filters.buyInMin)
  if (filters.buyInMax !== undefined) query = query.lte('buy_in', filters.buyInMax)
  if (filters.gameTypes?.length) query = query.in('game_type', filters.gameTypes)
  if (filters.formats?.length) query = query.in('format', filters.formats)
  if (filters.tableSizes?.length) query = query.in('table_size', filters.tableSizes)
  if (filters.startTimeFrom) query = query.gte('start_time', filters.startTimeFrom)
  if (filters.startTimeTo) query = query.lte('start_time', filters.startTimeTo)

  // Turbo exclusion
  if (filters.avoidTurbos) {
    query = query.not('format', 'ilike', '%turbo%')
  }

  // Guarantee filters
  if (filters.hasGuarantee) {
    query = query.gt('guaranteed_prize', 0)
    if (filters.guaranteeMin !== undefined) query = query.gte('guaranteed_prize', filters.guaranteeMin)
    if (filters.guaranteeMax !== undefined) query = query.lte('guaranteed_prize', filters.guaranteeMax)
  }

  // Sorting — when hasGuarantee is active, compound sort: date ASC then guarantee DESC
  if (filters.hasGuarantee) {
    query = query.order('date').order('guaranteed_prize', { ascending: false })
  } else {
    switch (filters.sortBy) {
      case 'buy_in_asc':
        query = query.order('buy_in', { ascending: true })
        break
      case 'buy_in_desc':
        query = query.order('buy_in', { ascending: false })
        break
      case 'guarantee_desc':
        query = query.order('guaranteed_prize', { ascending: false, nullsFirst: false })
        break
      default:
        query = query.order('date').order('start_time')
    }
  }

  if (filters.limit) query = query.limit(filters.limit)
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

  return query
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add guarantee filtering, turbo exclusion, and compound sorting to query builder"
```

---

### Task 3: Parse new filter params in the API route

**Files:**
- Modify: `src/app/api/tournaments/route.ts`

**Step 1: Add parsing for new params**

In `src/app/api/tournaments/route.ts`, add these to the `filters` object construction:

```typescript
const filters: TournamentFilters = {
  dateFrom: searchParams.get('dateFrom') || undefined,
  dateTo: searchParams.get('dateTo') || undefined,
  seriesIds: searchParams.getAll('seriesId').filter(Boolean),
  buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
  buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
  gameTypes: searchParams.getAll('gameType').filter(Boolean),
  formats: searchParams.getAll('format').filter(Boolean),
  tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
  startTimeFrom: searchParams.get('startTimeFrom') || undefined,        // NEW
  startTimeTo: searchParams.get('startTimeTo') || undefined,            // NEW
  avoidTurbos: searchParams.get('avoidTurbos') === 'true',             // NEW
  hasGuarantee: searchParams.get('hasGuarantee') === 'true',           // NEW
  guaranteeMin: searchParams.get('guaranteeMin') ? Number(searchParams.get('guaranteeMin')) : undefined, // NEW
  guaranteeMax: searchParams.get('guaranteeMax') ? Number(searchParams.get('guaranteeMax')) : undefined, // NEW
  sortBy: (searchParams.get('sortBy') as TournamentFilters['sortBy']) || undefined,
  limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
  offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/tournaments/route.ts
git commit -m "feat: parse guarantee, turbo, and start time filter params in tournaments API"
```

---

### Task 4: Wire new params through the client-side hooks

**Files:**
- Modify: `src/hooks/use-tournament-filters.ts`
- Modify: `src/hooks/use-tournaments.ts`

**Step 1: Add new params to useTournamentFilters**

In `src/hooks/use-tournament-filters.ts`, add the new fields to the `filters` memo and update `filterCount`:

```typescript
const filters: TournamentFilters = useMemo(() => ({
  dateFrom: searchParams.get('dateFrom') || undefined,
  dateTo: searchParams.get('dateTo') || undefined,
  buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
  buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
  gameTypes: searchParams.getAll('gameType').filter(Boolean),
  formats: searchParams.getAll('format').filter(Boolean),
  tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
  startTimeFrom: searchParams.get('startTimeFrom') || undefined,        // NEW
  startTimeTo: searchParams.get('startTimeTo') || undefined,            // NEW
  avoidTurbos: searchParams.get('avoidTurbos') === 'true',             // NEW
  hasGuarantee: searchParams.get('hasGuarantee') === 'true',           // NEW
  guaranteeMin: searchParams.get('guaranteeMin') ? Number(searchParams.get('guaranteeMin')) : undefined, // NEW
  guaranteeMax: searchParams.get('guaranteeMax') ? Number(searchParams.get('guaranteeMax')) : undefined, // NEW
  sortBy: (searchParams.get('sortBy') as TournamentFilters['sortBy']) || undefined,
}), [searchParams])
```

Update `filterCount`:

```typescript
const filterCount = useMemo(() => {
  let count = 0
  if (filters.dateFrom || filters.dateTo) count++
  if (filters.buyInMin !== undefined || filters.buyInMax !== undefined) count++
  if (filters.gameTypes?.length) count++
  if (filters.formats?.length) count++
  if (filters.tableSizes?.length) count++
  if (filters.startTimeFrom || filters.startTimeTo) count++  // NEW
  if (filters.avoidTurbos) count++                             // NEW
  if (filters.hasGuarantee) count++                            // NEW
  return count
}, [filters])
```

Add a `batchSetFilters` function for the preferences toggle to use:

```typescript
const batchSetFilters = useCallback((newFilters: Record<string, string | string[] | null>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(newFilters)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v))
      } else {
        params.set(key, value)
      }
    }
  }
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}, [router, pathname])
```

Return `batchSetFilters` from the hook:

```typescript
return { filters, setFilter, resetFilters, filterCount, batchSetFilters }
```

**Step 2: Pass new params to API in useTournaments**

In `src/hooks/use-tournaments.ts`, add these lines inside `fetchTournaments` after the existing param building:

```typescript
if (filters.startTimeFrom) params.set('startTimeFrom', filters.startTimeFrom)
if (filters.startTimeTo) params.set('startTimeTo', filters.startTimeTo)
if (filters.avoidTurbos) params.set('avoidTurbos', 'true')
if (filters.hasGuarantee) params.set('hasGuarantee', 'true')
if (filters.guaranteeMin !== undefined) params.set('guaranteeMin', String(filters.guaranteeMin))
if (filters.guaranteeMax !== undefined) params.set('guaranteeMax', String(filters.guaranteeMax))
```

Also add to the `useEffect` dependency array:

```typescript
}, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
    filters.gameTypes, filters.formats, filters.tableSizes, filters.sortBy,
    filters.startTimeFrom, filters.startTimeTo, filters.avoidTurbos,
    filters.hasGuarantee, filters.guaranteeMin, filters.guaranteeMax,
    gameTypes, formats, tableSizes])
```

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/hooks/use-tournament-filters.ts src/hooks/use-tournaments.ts
git commit -m "feat: wire guarantee, turbo, and start time params through client hooks"
```

---

### Task 5: Add guarantee filter section to sidebar UI

**Files:**
- Modify: `src/components/tournament-filters.tsx`

**Step 1: Add guarantee filter section**

In `src/components/tournament-filters.tsx`, add a new section between the "Format" section and the "Sort" section inside `FilterSections`:

```tsx
{/* Guarantee */}
<div className="space-y-3">
  <h4 className="text-sm font-medium text-foreground">Guarantee</h4>
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={filters.hasGuarantee || false}
      onChange={(e) => {
        setFilter('hasGuarantee', e.target.checked ? 'true' : null)
        if (!e.target.checked) {
          // Clear guarantee min/max when unchecked
          setTimeout(() => setFilter('guaranteeMin', null), 0)
          setTimeout(() => setFilter('guaranteeMax', null), 10)
        }
      }}
      className="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
    />
    <span className="text-xs">Has guarantee</span>
  </label>
  {filters.hasGuarantee && (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Min ($)</label>
        <Input
          type="number"
          min="0"
          placeholder="0"
          value={filters.guaranteeMin ?? ''}
          onChange={(e) => setFilter('guaranteeMin', e.target.value || null)}
          className="text-xs h-8"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Max ($)</label>
        <Input
          type="number"
          min="0"
          placeholder="Any"
          value={filters.guaranteeMax ?? ''}
          onChange={(e) => setFilter('guaranteeMax', e.target.value || null)}
          className="text-xs h-8"
        />
      </div>
    </div>
  )}
</div>
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tournament-filters.tsx
git commit -m "feat: add guarantee filter section to browse sidebar"
```

---

### Task 6: Add "My Preferences" toggle to browse page

**Files:**
- Modify: `src/app/browse/page.tsx`

**Step 1: Add preferences toggle UI and logic**

Replace the contents of `src/app/browse/page.tsx` with the following. Key changes:
- Import `useUser` hook and `UserPreferences` type
- Import `Tabs`, `TabsList`, `TabsTrigger` from UI
- Add state for preferences mode
- Fetch preferences and batch-set filters when toggled on

```tsx
'use client'

import { Suspense, useState, useCallback } from 'react'
import { useTournamentFilters } from '@/hooks/use-tournament-filters'
import { useTournaments } from '@/hooks/use-tournaments'
import { useUser } from '@/hooks/use-user'
import { UserPreferences } from '@/types'
import { TournamentFilters } from '@/components/tournament-filters'
import { TournamentCard } from '@/components/tournament-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw } from 'lucide-react'

function BrowseContent() {
  const { filters, resetFilters, batchSetFilters } = useTournamentFilters()
  const { tournaments, loading, error } = useTournaments(filters)
  const { user } = useUser()
  const [prefsMode, setPrefsMode] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(false)

  const applyPreferences = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const res = await fetch('/api/preferences')
      if (!res.ok) return
      const prefs: UserPreferences | null = await res.json()
      if (!prefs) return

      const newFilters: Record<string, string | string[] | null> = {}

      if (prefs.buy_in_min != null) newFilters.buyInMin = String(prefs.buy_in_min)
      if (prefs.buy_in_max != null) newFilters.buyInMax = String(prefs.buy_in_max)
      if (prefs.preferred_games?.length) newFilters.gameType = prefs.preferred_games
      if (prefs.preferred_formats?.length) newFilters.format = prefs.preferred_formats
      if (prefs.preferred_start_time_earliest) newFilters.startTimeFrom = prefs.preferred_start_time_earliest
      if (prefs.preferred_start_time_latest) newFilters.startTimeTo = prefs.preferred_start_time_latest
      if (prefs.trip_start) newFilters.dateFrom = prefs.trip_start
      if (prefs.trip_end) newFilters.dateTo = prefs.trip_end
      if (prefs.avoid_turbos) newFilters.avoidTurbos = 'true'

      batchSetFilters(newFilters)
      setPrefsMode(true)
    } catch {
      // Silently fail
    } finally {
      setPrefsLoading(false)
    }
  }, [batchSetFilters])

  const handleTabChange = (value: string) => {
    if (value === 'preferences') {
      applyPreferences()
    } else {
      resetFilters()
      setPrefsMode(false)
    }
  }

  return (
    <div className="flex gap-6 px-4 md:px-6 py-6">
      {/* Desktop sidebar */}
      <TournamentFilters />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Browse Tournaments</h1>
            {!loading && !error && (
              <p className="text-sm text-muted-foreground mt-1">
                {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>

          {/* Preferences toggle — only shown when logged in */}
          {user && (
            <Tabs
              value={prefsMode ? 'preferences' : 'all'}
              onValueChange={handleTabChange}
            >
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">
                  All
                </TabsTrigger>
                <TabsTrigger value="preferences" className="text-xs px-3" disabled={prefsLoading}>
                  {prefsLoading ? 'Loading...' : 'My Preferences'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[180px] rounded-lg bg-card border border-border animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-4">Something went wrong loading tournaments.</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tournaments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-4">No tournaments match your filters.</p>
            <Button variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        )}

        {/* Results Grid */}
        {!loading && !error && tournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex gap-6 px-4 md:px-6 py-6">
          <div className="hidden md:block w-[280px] shrink-0" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-6">Browse Tournaments</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-lg bg-card border border-border animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/browse/page.tsx
git commit -m "feat: add My Preferences toggle to browse page header"
```

---

### Task 7: Final build verification and deploy

**Step 1: Full build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next build`
Expected: Build succeeds with no errors or warnings

**Step 2: Manual smoke check**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner/.claude/worktrees/vigilant-faraday && npx next dev`
Verify in browser:
- Browse page loads
- Guarantee filter section appears in sidebar
- Checking "Has guarantee" reveals min/max inputs
- When logged in, "All | My Preferences" toggle appears
- Clicking "My Preferences" pre-fills sidebar filters from saved preferences
- Clicking "All" clears filters

**Step 3: Deploy**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && vercel --prod`
Expected: Deployment succeeds
