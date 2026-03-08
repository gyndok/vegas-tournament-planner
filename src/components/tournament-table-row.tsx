'use client'

import { useRouter } from 'next/navigation'
import { Tournament } from '@/types'
import { getSeriesColor, formatBuyIn, formatTime, formatDate } from '@/lib/utils'

interface TournamentTableRowProps {
  tournament: Tournament
}

export function TournamentTableRow({ tournament }: TournamentTableRowProps) {
  const router = useRouter()
  const seriesColor = getSeriesColor(
    tournament.series?.name || '',
    tournament.series?.venue,
    tournament.name
  )

  return (
    <tr
      className="border-b border-border hover:bg-accent transition-colors cursor-pointer text-xs"
      onClick={() => router.push(`/tournament/${tournament.id}`)}
    >
      <td className="px-3 py-1.5 whitespace-nowrap">
        {formatTime(tournament.start_time)}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
        {formatDate(tournament.date)}
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block size-2 rounded-full shrink-0 ${seriesColor.dot}`} />
          <span className="truncate font-medium text-card-foreground">
            {tournament.name}
          </span>
          {tournament.is_flight && tournament.flight_label && (
            <span className="shrink-0 text-[10px] px-1 rounded bg-muted text-muted-foreground">
              F{tournament.flight_label}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right font-medium">
        {formatBuyIn(tournament.buy_in)}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap text-center text-muted-foreground">
        {tournament.game_type}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap text-center text-muted-foreground">
        {tournament.format}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right">
        {tournament.guaranteed_prize && tournament.guaranteed_prize > 0 ? (
          <span style={{ color: 'var(--acr-guarantee)' }}>
            {formatBuyIn(tournament.guaranteed_prize)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
