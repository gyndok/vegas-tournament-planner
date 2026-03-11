'use client'

import { useState } from 'react'
import { Tournament } from '@/types'
import { TournamentTableRow } from './tournament-table-row'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortKey = 'date' | 'time' | 'name' | 'location' | 'buy_in' | 'gtd'
type SortDir = 'asc' | 'desc'

interface TournamentTableProps {
  tournaments: Tournament[]
}

function sortTournaments(tournaments: Tournament[], sortKey: SortKey, sortDir: SortDir): Tournament[] {
  return [...tournaments].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'date':
        cmp = a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
        break
      case 'time':
        cmp = a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
        break
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'location':
        cmp = (a.series?.venue || '').localeCompare(b.series?.venue || '')
        break
      case 'buy_in':
        cmp = (a.buy_in || 0) - (b.buy_in || 0)
        break
      case 'gtd':
        cmp = (a.guaranteed_prize || 0) - (b.guaranteed_prize || 0)
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

function SortIcon({ columnKey, activeKey, activeDir }: { columnKey: SortKey; activeKey: SortKey | null; activeDir: SortDir }) {
  if (activeKey !== columnKey) {
    return <ChevronsUpDown className="size-3 text-muted-foreground/50" />
  }
  return activeDir === 'asc'
    ? <ChevronUp className="size-3" />
    : <ChevronDown className="size-3" />
}

export function TournamentTable({ tournaments }: TournamentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey ? sortTournaments(tournaments, sortKey, sortDir) : tournaments

  const thClass = "px-3 py-2.5 font-medium cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"

  return (
    <div className="acr-lobby rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm bg-card table-fixed">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[40%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead>
            <tr
              className="text-xs text-white/80 uppercase tracking-wider"
              style={{ backgroundColor: 'var(--acr-header-bg)' }}
            >
              <th className={`${thClass} text-left`} onClick={() => handleSort('date')}>
                <span className="inline-flex items-center gap-1">
                  Date <SortIcon columnKey="date" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className={`${thClass} text-left`} onClick={() => handleSort('time')}>
                <span className="inline-flex items-center gap-1">
                  Time <SortIcon columnKey="time" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className={`${thClass} text-left`} onClick={() => handleSort('name')}>
                <span className="inline-flex items-center gap-1">
                  Name <SortIcon columnKey="name" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className={`${thClass} text-left`} onClick={() => handleSort('location')}>
                <span className="inline-flex items-center gap-1">
                  Location <SortIcon columnKey="location" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className={`${thClass} text-right`} onClick={() => handleSort('buy_in')}>
                <span className="inline-flex items-center gap-1 justify-end">
                  Buy-In <SortIcon columnKey="buy_in" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className={`${thClass} text-right`} onClick={() => handleSort('gtd')}>
                <span className="inline-flex items-center gap-1 justify-end">
                  GTD <SortIcon columnKey="gtd" activeKey={sortKey} activeDir={sortDir} />
                </span>
              </th>
              <th className="w-[44px] px-1 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((tournament) => (
              <TournamentTableRow key={tournament.id} tournament={tournament} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
