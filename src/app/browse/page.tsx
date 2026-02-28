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
import { AdUnit } from '@/components/ad-unit'
import { RefreshCw, Info } from 'lucide-react'

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

        {/* Schedule accuracy disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 mb-4">
          <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Schedules are sourced from venue websites and may change without notice. Always confirm details directly with the venue before making travel plans.
          </p>
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
            {tournaments.map((tournament, index) => (
              <div key={tournament.id}>
                <TournamentCard tournament={tournament} />
                {/* Show an inline ad every 8 results */}
                {(index + 1) % 8 === 0 && (
                  <div className="py-2">
                    <AdUnit slot="BROWSE_INLINE_SLOT" size="inline" channel="browse_feed" />
                  </div>
                )}
              </div>
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
