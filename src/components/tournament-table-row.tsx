'use client'

import { useRouter } from 'next/navigation'
import { Tournament } from '@/types'
import { getSeriesColor, formatBuyIn, formatTime, formatDate } from '@/lib/utils'
import { QuickAddButton } from './quick-add-button'

interface TournamentTableRowProps {
  tournament: Tournament
}

function hasStarted(tournament: Tournament): boolean {
  const nowPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const [hours, minutes] = tournament.start_time.split(':').map(Number)
  const tournamentDate = new Date(tournament.date + 'T12:00:00')
  tournamentDate.setHours(hours, minutes, 0, 0)
  return nowPT > tournamentDate
}

export function TournamentTableRow({ tournament }: TournamentTableRowProps) {
  const router = useRouter()
  const seriesColor = getSeriesColor(
    tournament.series?.name || '',
    tournament.series?.venue,
    tournament.name
  )
  const started = hasStarted(tournament)

  return (
    <tr
      className="border-b border-white/20 hover:bg-accent transition-colors cursor-pointer text-xs even:bg-muted/20"
      onClick={() => router.push(`/tournament/${tournament.id}`)}
    >
      <td className="px-3 py-2 whitespace-nowrap text-white/80">
        {formatDate(tournament.date)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-white/80">
        {formatTime(tournament.start_time)}
      </td>
      <td className="px-3 py-2 max-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block size-2 rounded-full shrink-0 ${seriesColor.dot}`} />
          <span className={`truncate font-medium ${started ? 'text-red-400' : 'text-emerald-400'}`}>
            {tournament.name}
          </span>
          {tournament.event_category === 'bracelet' && (
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30"
              title="WSOP bracelet event"
            >
              Bracelet
            </span>
          )}
          {tournament.is_flight && tournament.flight_label && (
            <span className="shrink-0 text-[10px] px-1 rounded bg-muted text-muted-foreground">
              F{tournament.flight_label}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-white/80 truncate overflow-hidden">
        {tournament.series?.venue || '—'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-white">
        {tournament.buy_in != null ? formatBuyIn(tournament.buy_in) : '—'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        {tournament.guaranteed_prize && tournament.guaranteed_prize > 0 ? (
          <span style={{ color: 'var(--acr-guarantee)' }}>
            {formatBuyIn(tournament.guaranteed_prize)}
          </span>
        ) : (
          <span className="text-white/40">—</span>
        )}
      </td>
      <td className="px-1 py-1 text-center">
        <QuickAddButton tournamentId={tournament.id} />
      </td>
    </tr>
  )
}
