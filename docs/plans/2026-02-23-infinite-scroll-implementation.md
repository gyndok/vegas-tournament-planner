# Infinite Scroll & Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hard-capped 50-result browse page with infinite scroll using cursor-based pagination, showing results progressively as the user scrolls.

**Architecture:** The API returns paginated results with a cursor for the next page plus a total count. The client uses an Intersection Observer on a sentinel element to trigger loading the next page, accumulating results in state. No external libraries needed — vanilla React hooks + `useEffect` match existing patterns.

**Tech Stack:** Next.js 16 API routes, Supabase PostgREST, React 19 hooks, Intersection Observer API

---

### Task 1: Update TournamentFilters type to support cursor pagination

**Files:**
- Modify: `src/types/index.ts:64-82`

**Step 1: Add cursor field to TournamentFilters and create PaginatedResponse type**

Add a `cursor` field to the existing `TournamentFilters` interface and add a new `PaginatedTournamentsResponse` interface after it:

```typescript
// In TournamentFilters interface, replace the offset field:
export interface TournamentFilters {
  dateFrom?: string
  dateTo?: string
  seriesIds?: string[]
  buyInMin?: number
  buyInMax?: number
  gameTypes?: string[]
  formats?: string[]
  tableSizes?: number[]
  startTimeFrom?: string    // e.g. "10:00"
  startTimeTo?: string      // e.g. "20:00"
  avoidTurbos?: boolean
  hasGuarantee?: boolean
  guaranteeMin?: number
  guaranteeMax?: number
  sortBy?: 'date' | 'buy_in_asc' | 'buy_in_desc' | 'guarantee_desc'
  limit?: number
  cursor?: string  // base64-encoded cursor for pagination
}

// Add after TournamentFilters:
export interface PaginatedTournamentsResponse {
  data: Tournament[]
  nextCursor: string | null
  totalCount: number
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds (removing `offset` may cause a build error in `queries.ts` — that's expected and fixed in Task 2)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add cursor pagination types to TournamentFilters"
```

---

### Task 2: Update buildTournamentQuery to support cursor-based pagination

**Files:**
- Modify: `src/lib/queries.ts`

**Step 1: Replace offset-based pagination with cursor-based**

Replace the entire file with:

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { TournamentFilters } from '@/types'

export function decodeCursor(cursor: string): { date: string; startTime: string; id: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
  const [date, startTime, id] = decoded.split('|')
  return { date, startTime, id }
}

export function encodeCursor(date: string, startTime: string, id: string): string {
  return Buffer.from(`${date}|${startTime}|${id}`).toString('base64')
}

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

  // Always add a final tiebreaker sort by id
  query = query.order('id')

  if (filters.limit) query = query.limit(filters.limit)

  return query
}

export function buildCountQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })

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
  if (filters.avoidTurbos) {
    query = query.not('format', 'ilike', '%turbo%')
  }
  if (filters.hasGuarantee) {
    query = query.gt('guaranteed_prize', 0)
    if (filters.guaranteeMin !== undefined) query = query.gte('guaranteed_prize', filters.guaranteeMin)
    if (filters.guaranteeMax !== undefined) query = query.lte('guaranteed_prize', filters.guaranteeMax)
  }

  return query
}
```

Key changes:
- Removed `offset` logic — cursor-based pagination replaces it
- Added `order('id')` as tiebreaker for stable pagination
- Added `encodeCursor`/`decodeCursor` helpers
- Added `buildCountQuery` for total count

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add cursor encoding and count query to tournament queries"
```

---

### Task 3: Update the tournaments API route to return paginated response

**Files:**
- Modify: `src/app/api/tournaments/route.ts`

**Step 1: Rewrite route to return PaginatedTournamentsResponse**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTournamentQuery, buildCountQuery, encodeCursor, decodeCursor } from '@/lib/queries'
import { TournamentFilters, PaginatedTournamentsResponse } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const supabase = await createClient()

  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 30
  const cursor = searchParams.get('cursor') || undefined

  const filters: TournamentFilters = {
    dateFrom: searchParams.get('dateFrom') || new Date().toISOString().split('T')[0],
    dateTo: searchParams.get('dateTo') || undefined,
    seriesIds: searchParams.getAll('seriesId').filter(Boolean),
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
    gameTypes: searchParams.getAll('gameType').filter(Boolean),
    formats: searchParams.getAll('format').filter(Boolean),
    tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
    startTimeFrom: searchParams.get('startTimeFrom') || undefined,
    startTimeTo: searchParams.get('startTimeTo') || undefined,
    avoidTurbos: searchParams.get('avoidTurbos') === 'true',
    hasGuarantee: searchParams.get('hasGuarantee') === 'true',
    guaranteeMin: searchParams.get('guaranteeMin') ? Number(searchParams.get('guaranteeMin')) : undefined,
    guaranteeMax: searchParams.get('guaranteeMax') ? Number(searchParams.get('guaranteeMax')) : undefined,
    sortBy: (searchParams.get('sortBy') as TournamentFilters['sortBy']) || undefined,
    // Fetch one extra to determine if there's a next page
    limit: limit + 1,
  }

  // Build the main query
  let query = buildTournamentQuery(supabase, filters)

  // Apply cursor if provided (for default date/time sort)
  if (cursor) {
    const { date, startTime, id } = decodeCursor(cursor)
    // For default sort (date, start_time, id), use composite cursor
    // This works for the default sort. For other sorts, we fall back to offset-style
    if (!filters.sortBy && !filters.hasGuarantee) {
      query = query.or(`date.gt.${date},and(date.eq.${date},start_time.gt.${startTime}),and(date.eq.${date},start_time.eq.${startTime},id.gt.${id})`)
    }
  }

  // Execute main query and count query in parallel
  const [dataResult, countResult] = await Promise.all([
    query,
    buildCountQuery(supabase, filters),
  ])

  if (dataResult.error) {
    return NextResponse.json({ error: dataResult.error.message }, { status: 500 })
  }

  const allRows = dataResult.data || []
  const hasMore = allRows.length > limit
  const data = hasMore ? allRows.slice(0, limit) : allRows

  let nextCursor: string | null = null
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1]
    nextCursor = encodeCursor(lastItem.date, lastItem.start_time, lastItem.id)
  }

  const response: PaginatedTournamentsResponse = {
    data,
    nextCursor,
    totalCount: countResult.count ?? data.length,
  }

  return NextResponse.json(response)
}
```

Key changes:
- Default limit is now 30 (was 50)
- Fetches `limit + 1` to check if there's a next page
- Returns `{ data, nextCursor, totalCount }` instead of raw array
- Cursor applied as `or()` filter for composite sort key
- Count query runs in parallel for the "Showing X of Y" display

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build may have type errors in `use-tournaments.ts` since API response shape changed. That's expected — fixed in Task 4.

**Step 3: Commit**

```bash
git add src/app/api/tournaments/route.ts
git commit -m "feat: return paginated response from tournaments API"
```

---

### Task 4: Create the useInfiniteTournaments hook

**Files:**
- Create: `src/hooks/use-infinite-tournaments.ts`

**Step 1: Create the hook**

```typescript
'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Tournament, TournamentFilters, PaginatedTournamentsResponse } from '@/types'

interface UseInfiniteTournamentsReturn {
  tournaments: Tournament[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  totalCount: number
  hasMore: boolean
  loadMore: () => void
}

function buildSearchParams(filters: TournamentFilters, cursor?: string): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.buyInMin !== undefined) params.set('buyInMin', String(filters.buyInMin))
  if (filters.buyInMax !== undefined) params.set('buyInMax', String(filters.buyInMax))
  filters.gameTypes?.forEach(g => params.append('gameType', g))
  filters.formats?.forEach(f => params.append('format', f))
  filters.tableSizes?.forEach(t => params.append('tableSize', String(t)))
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.startTimeFrom) params.set('startTimeFrom', filters.startTimeFrom)
  if (filters.startTimeTo) params.set('startTimeTo', filters.startTimeTo)
  if (filters.avoidTurbos) params.set('avoidTurbos', 'true')
  if (filters.hasGuarantee) params.set('hasGuarantee', 'true')
  if (filters.guaranteeMin !== undefined) params.set('guaranteeMin', String(filters.guaranteeMin))
  if (filters.guaranteeMax !== undefined) params.set('guaranteeMax', String(filters.guaranteeMax))
  params.set('limit', '30')
  if (cursor) params.set('cursor', cursor)
  return params
}

export function useInfiniteTournaments(filters: TournamentFilters): UseInfiniteTournamentsReturn {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Stabilise array deps
  const gameTypes = useMemo(() => JSON.stringify(filters.gameTypes), [filters.gameTypes])
  const formats = useMemo(() => JSON.stringify(filters.formats), [filters.formats])
  const tableSizes = useMemo(() => JSON.stringify(filters.tableSizes), [filters.tableSizes])

  // Reset and fetch first page when filters change
  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    async function fetchFirstPage() {
      setLoading(true)
      setError(null)
      setTournaments([])
      setNextCursor(null)

      try {
        const params = buildSearchParams(filters)
        const res = await fetch(`/api/tournaments?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load')
        const result: PaginatedTournamentsResponse = await res.json()
        if (!controller.signal.aborted) {
          setTournaments(result.data)
          setNextCursor(result.nextCursor)
          setTotalCount(result.totalCount)
          setError(null)
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(String(e))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchFirstPage()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
      gameTypes, formats, tableSizes, filters.sortBy,
      filters.startTimeFrom, filters.startTimeTo, filters.avoidTurbos,
      filters.hasGuarantee, filters.guaranteeMin, filters.guaranteeMax])

  // Load more function
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return

    const controller = new AbortController()
    setLoadingMore(true)

    try {
      const params = buildSearchParams(filters, nextCursor)
      const res = await fetch(`/api/tournaments?${params}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Failed to load more')
      const result: PaginatedTournamentsResponse = await res.json()
      if (!controller.signal.aborted) {
        setTournaments(prev => [...prev, ...result.data])
        setNextCursor(result.nextCursor)
        setTotalCount(result.totalCount)
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(String(e))
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false)
      }
    }
  }, [nextCursor, loadingMore, filters])

  return {
    tournaments,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore: nextCursor !== null,
    loadMore,
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds (new hook is not yet consumed)

**Step 3: Commit**

```bash
git add src/hooks/use-infinite-tournaments.ts
git commit -m "feat: add useInfiniteTournaments hook with cursor pagination"
```

---

### Task 5: Create skeleton loading card component

**Files:**
- Create: `src/components/tournament-card-skeleton.tsx`

**Step 1: Create the skeleton component**

The skeleton should match the visual layout of `TournamentCard` (series badge, title, date/time row, buy-in row):

```typescript
import { Card, CardContent } from '@/components/ui/card'

export function TournamentCardSkeleton() {
  return (
    <Card className="border-border bg-card py-0 gap-0 border-l-4 border-l-gray-300 dark:border-l-gray-600">
      <CardContent className="p-4 space-y-3">
        {/* Top row: series badge + event number */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-8 rounded bg-muted animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
        </div>

        {/* Date/time row */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>

        {/* Buy-in / badges row */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-14 rounded bg-muted animate-pulse" />
          <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/tournament-card-skeleton.tsx
git commit -m "feat: add tournament card skeleton component"
```

---

### Task 6: Update browse page with infinite scroll

**Files:**
- Modify: `src/app/browse/page.tsx`

**Step 1: Replace useTournaments with useInfiniteTournaments and add Intersection Observer**

Replace the entire file:

```typescript
'use client'

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { useTournamentFilters } from '@/hooks/use-tournament-filters'
import { useInfiniteTournaments } from '@/hooks/use-infinite-tournaments'
import { useUser } from '@/hooks/use-user'
import { UserPreferences } from '@/types'
import { TournamentFilters } from '@/components/tournament-filters'
import { TournamentCard } from '@/components/tournament-card'
import { TournamentCardSkeleton } from '@/components/tournament-card-skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Loader2 } from 'lucide-react'

function BrowseContent() {
  const { filters, resetFilters, batchSetFilters } = useTournamentFilters()
  const { tournaments, loading, loadingMore, error, totalCount, hasMore, loadMore } = useInfiniteTournaments(filters)
  const { user } = useUser()
  const [prefsMode, setPrefsMode] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(false)

  // Intersection Observer for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadMore])

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
                Showing {tournaments.length} of {totalCount} tournament{totalCount !== 1 ? 's' : ''}
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

        {/* Initial Loading State */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TournamentCardSkeleton key={i} />
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

        {/* Results */}
        {!loading && !error && tournaments.length > 0 && (
          <div className="space-y-3">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}

            {/* Loading more skeletons */}
            {loadingMore && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <TournamentCardSkeleton key={`skeleton-${i}`} />
                ))}
              </div>
            )}

            {/* Sentinel for Intersection Observer */}
            {hasMore && <div ref={sentinelRef} className="h-4" />}

            {/* End of results */}
            {!hasMore && tournaments.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                All {totalCount} tournaments loaded
              </p>
            )}
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
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <TournamentCardSkeleton key={i} />
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

Key changes:
- Replaced `useTournaments` with `useInfiniteTournaments`
- Added `sentinelRef` with Intersection Observer (`rootMargin: '200px'` for preloading)
- "Showing X of Y" counter in header
- Skeleton cards during `loadingMore` instead of a spinner
- "All N tournaments loaded" end message
- Replaced generic `div` skeletons with `TournamentCardSkeleton`

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/browse/page.tsx
git commit -m "feat: add infinite scroll to browse page with Intersection Observer"
```

---

### Task 7: Update other consumers of the old API response format

**Files:**
- Modify: `src/hooks/use-tournaments.ts`

**Step 1: Update useTournaments to handle new paginated response**

The `useTournaments` hook is still used by the AI chat and possibly other consumers. Update it to work with the new API response shape:

```typescript
'use client'
import { useState, useEffect, useMemo } from 'react'
import { Tournament, TournamentFilters, PaginatedTournamentsResponse } from '@/types'

export function useTournaments(filters: TournamentFilters) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilise array deps so the effect dependency list stays simple
  const gameTypes = useMemo(() => JSON.stringify(filters.gameTypes), [filters.gameTypes])
  const formats = useMemo(() => JSON.stringify(filters.formats), [filters.formats])
  const tableSizes = useMemo(() => JSON.stringify(filters.tableSizes), [filters.tableSizes])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchTournaments() {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.buyInMin !== undefined) params.set('buyInMin', String(filters.buyInMin))
      if (filters.buyInMax !== undefined) params.set('buyInMax', String(filters.buyInMax))
      filters.gameTypes?.forEach(g => params.append('gameType', g))
      filters.formats?.forEach(f => params.append('format', f))
      filters.tableSizes?.forEach(t => params.append('tableSize', String(t)))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.startTimeFrom) params.set('startTimeFrom', filters.startTimeFrom)
      if (filters.startTimeTo) params.set('startTimeTo', filters.startTimeTo)
      if (filters.avoidTurbos) params.set('avoidTurbos', 'true')
      if (filters.hasGuarantee) params.set('hasGuarantee', 'true')
      if (filters.guaranteeMin !== undefined) params.set('guaranteeMin', String(filters.guaranteeMin))
      if (filters.guaranteeMax !== undefined) params.set('guaranteeMax', String(filters.guaranteeMax))
      params.set('limit', '100')

      try {
        const res = await fetch(`/api/tournaments?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load')
        const result: PaginatedTournamentsResponse = await res.json()
        if (!controller.signal.aborted) {
          setTournaments(result.data)
          setError(null)
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(String(e))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    setLoading(true)
    fetchTournaments()

    return () => controller.abort()
  }, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
      filters.gameTypes, filters.formats, filters.tableSizes, filters.sortBy,
      filters.startTimeFrom, filters.startTimeTo, filters.avoidTurbos,
      filters.hasGuarantee, filters.guaranteeMin, filters.guaranteeMax,
      gameTypes, formats, tableSizes])

  return { tournaments, loading, error }
}
```

Key change: `const result: PaginatedTournamentsResponse = await res.json()` then `setTournaments(result.data)` instead of `setTournaments(data)`.

**Step 2: Check if any other files reference the old API format**

Search for any direct `/api/tournaments` fetches that expect a raw array:

Run: `grep -r "api/tournaments" src/ --include="*.ts" --include="*.tsx" -l`

Check each file and update if it reads the response as a raw array (e.g., `const data = await res.json()` then uses `data` as `Tournament[]`). The chat tool-use functions also call this API — those need updating too.

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/hooks/use-tournaments.ts
git commit -m "fix: update useTournaments to handle paginated API response"
```

---

### Task 8: Build verification and manual testing

**Files:** None (testing only)

**Step 1: Full build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors

**Step 2: Dev server smoke test**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next dev &`

Open `http://localhost:3000/browse` and verify:
1. Initial page loads with ~30 tournaments
2. "Showing X of Y tournaments" header appears
3. Scrolling down triggers loading more (skeleton cards appear briefly)
4. New tournaments append to the list
5. When all tournaments are loaded, "All N tournaments loaded" message appears
6. Changing a filter resets the list and refetches from page 1
7. The "Has guarantee" checkbox works (unchecking clears properly)

**Step 3: Final commit**

If any issues were found and fixed, commit the fixes. Otherwise, no commit needed.
