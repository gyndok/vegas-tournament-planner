'use client'

import Link from 'next/link'
import { Tournament } from '@/types'
import { getSeriesColor, formatBuyIn, formatTime, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QuickAddButton } from '@/components/quick-add-button'

interface TournamentCardProps {
  tournament: Tournament
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const seriesName = tournament.series?.name || 'WSOP'
  const seriesColor = getSeriesColor(seriesName)

  return (
    <Link href={`/tournament/${tournament.id}`} className="block group">
      <Card className="border-border bg-card py-0 gap-0 transition-colors hover:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="p-4 space-y-3">
          {/* Top row: Series badge + Event number + Quick add */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${seriesColor.bg} ${seriesColor.text}`}
            >
              {seriesColor.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                #{tournament.event_number}
              </span>
              <QuickAddButton tournamentId={tournament.id} />
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-sm leading-snug line-clamp-2">
            {tournament.name}
          </h3>

          {/* Info row 1: Date + Day | Start time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatDate(tournament.date)} ({tournament.day_of_week})
            </span>
            <span className="text-border">|</span>
            <span>{formatTime(tournament.start_time)}</span>
          </div>

          {/* Info row 2: Buy-in | Game type | Format */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">
              {formatBuyIn(tournament.buy_in)}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tournament.game_type}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {tournament.format}
            </Badge>
          </div>

          {/* Info row 3 (conditional): Table size | Guarantee | Flight */}
          {(tournament.table_size !== 9 ||
            (tournament.guaranteed_prize && tournament.guaranteed_prize > 0) ||
            (tournament.is_flight && tournament.flight_label)) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {tournament.table_size !== 9 && (
                <span>{tournament.table_size}-max</span>
              )}
              {tournament.guaranteed_prize && tournament.guaranteed_prize > 0 && (
                <>
                  {tournament.table_size !== 9 && (
                    <span className="text-border">|</span>
                  )}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    GTD {formatBuyIn(tournament.guaranteed_prize)}
                  </span>
                </>
              )}
              {tournament.is_flight && tournament.flight_label && (
                <>
                  <span className="text-border">|</span>
                  <span>Flight {tournament.flight_label}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
