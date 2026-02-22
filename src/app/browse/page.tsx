'use client'

import { Suspense } from 'react'
import { useTournamentFilters } from '@/hooks/use-tournament-filters'
import { useTournaments } from '@/hooks/use-tournaments'
import { TournamentFilters } from '@/components/tournament-filters'
import { TournamentCard } from '@/components/tournament-card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

function BrowseContent() {
  const { filters, resetFilters } = useTournamentFilters()
  const { tournaments, loading, error } = useTournaments(filters)

  return (
    <div className="flex gap-8 px-4 md:px-6 py-6 max-w-7xl mx-auto">
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
          {/* Mobile filter trigger is inside TournamentFilters component */}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[180px] rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse"
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
        <div className="flex gap-8 px-4 md:px-6 py-6 max-w-7xl mx-auto">
          <div className="hidden md:block w-[280px] shrink-0" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-6">Browse Tournaments</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse"
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
