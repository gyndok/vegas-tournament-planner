'use client'

import { Tournament } from '@/types'
import { TournamentTableRow } from './tournament-table-row'

interface TournamentTableProps {
  tournaments: Tournament[]
}

export function TournamentTable({ tournaments }: TournamentTableProps) {
  return (
    <div className="acr-lobby rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm bg-card">
          <thead>
            <tr
              className="text-xs text-muted-foreground uppercase tracking-wider"
              style={{ backgroundColor: 'var(--acr-header-bg)' }}
            >
              <th className="px-3 py-2 text-left font-medium">Start</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Tournament Name</th>
              <th className="px-3 py-2 text-right font-medium">Buy-In</th>
              <th className="px-3 py-2 text-center font-medium">Game</th>
              <th className="px-3 py-2 text-center font-medium">Format</th>
              <th className="px-3 py-2 text-right font-medium">GTD</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => (
              <TournamentTableRow key={tournament.id} tournament={tournament} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
