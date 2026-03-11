'use client'

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { useTournamentFilters } from '@/hooks/use-tournament-filters'
import { useInfiniteTournaments } from '@/hooks/use-infinite-tournaments'
import { useUser } from '@/hooks/use-user'
import { UserPreferences } from '@/types'
import { TournamentFilters } from '@/components/tournament-filters'
import { TournamentCard } from '@/components/tournament-card'
import { TournamentCardSkeleton } from '@/components/tournament-card-skeleton'
import { TournamentTable } from '@/components/tournament-table'
import { TournamentTableSkeleton } from '@/components/tournament-table-skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdUnit } from '@/components/ad-unit'
import { Input } from '@/components/ui/input'
import { RefreshCw, Info, LayoutGrid, Rows3, Search } from 'lucide-react'

function BrowseContent() {
  const { filters, resetFilters, batchSetFilters } = useTournamentFilters()
  const { tournaments, loading, loadingMore, error, totalCount, hasMore, loadMore } = useInfiniteTournaments(filters)
  const { user } = useUser()
  const [prefsMode, setPrefsMode] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'classic' | 'lobby'>('classic')
  const [searchQuery, setSearchQuery] = useState('')

  // Load view preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('browseView') as 'classic' | 'lobby' | null
    if (stored) setViewMode(stored)
  }, [])

  function handleViewChange(mode: 'classic' | 'lobby') {
    setViewMode(mode)
    localStorage.setItem('browseView', mode)
  }

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

  // Client-side name search filter
  const filteredTournaments = searchQuery.trim()
    ? tournaments.filter((t) => {
        const words = searchQuery.toLowerCase().split(/\s+/)
        const name = t.name.toLowerCase()
        return words.every((word) => name.includes(word))
      })
    : tournaments

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
    <div className="px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold">Browse Tournaments</h1>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing {filteredTournaments.length} of {totalCount} tournament{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tournament names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Filters dropdown */}
          <TournamentFilters />

          {/* View toggle — desktop only */}
          <div className="hidden md:flex items-center gap-1 border border-border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'classic' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1.5"
              onClick={() => handleViewChange('classic')}
            >
              <LayoutGrid className="size-3.5" />
              Classic
            </Button>
            <Button
              variant={viewMode === 'lobby' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1.5"
              onClick={() => handleViewChange('lobby')}
            >
              <Rows3 className="size-3.5" />
              Lobby
            </Button>
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
        viewMode === 'lobby' ? (
          <div className="hidden md:block"><TournamentTableSkeleton /></div>
        ) : null
      )}
      {loading && (
        <div className={viewMode === 'lobby' ? 'md:hidden space-y-3' : 'space-y-3'}>
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
      {!loading && !error && filteredTournaments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4">
            {searchQuery.trim() ? 'No tournaments match your search.' : 'No tournaments match your filters.'}
          </p>
          <Button variant="outline" onClick={() => { resetFilters(); setSearchQuery('') }}>
            Reset Filters
          </Button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && filteredTournaments.length > 0 && (
        <div className="space-y-3">
          {/* Lobby table view — desktop only */}
          {viewMode === 'lobby' && (
            <div className="hidden md:block">
              <TournamentTable tournaments={filteredTournaments} />
            </div>
          )}

          {/* Card view — always on mobile, on desktop when classic */}
          <div className={viewMode === 'lobby' ? 'md:hidden space-y-3' : 'space-y-3'}>
            {filteredTournaments.map((tournament, index) => (
              <div key={tournament.id}>
                <TournamentCard tournament={tournament} />
                {(index + 1) % 8 === 0 && (
                  <div className="py-2">
                    <AdUnit slot="3954139833" size="inline" channel="browse_feed" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Loading more skeletons */}
          {loadingMore && viewMode === 'lobby' && (
            <div className="hidden md:block"><TournamentTableSkeleton /></div>
          )}
          {loadingMore && (
            <div className={viewMode === 'lobby' ? 'md:hidden space-y-3' : 'space-y-3'}>
              {Array.from({ length: 3 }).map((_, i) => (
                <TournamentCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          )}

          {/* Sentinel for Intersection Observer */}
          {hasMore && <div ref={sentinelRef} className="h-4" />}

          {/* End of results */}
          {!hasMore && filteredTournaments.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              All {totalCount} tournaments loaded
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 md:px-6 py-6">
          <h1 className="text-2xl font-bold mb-6">Browse Tournaments</h1>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TournamentCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  )
}
