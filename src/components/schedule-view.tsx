'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserScheduleEntry } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatBuyIn, formatTime, formatDate, getSeriesColor } from '@/lib/utils'
import { Trash2, ChevronDown, AlertTriangle, Calendar } from 'lucide-react'

interface ScheduleViewProps {
  entries: UserScheduleEntry[]
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
}

const PRIORITY_CONFIG = {
  target: { label: 'Target', className: 'bg-primary hover:bg-primary/90 text-primary-foreground' },
  backup: { label: 'Backup', className: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
  maybe: { label: 'Maybe', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
}

function entriesOverlap(a: UserScheduleEntry, b: UserScheduleEntry): boolean {
  const tA = a.tournament
  const tB = b.tournament
  if (!tA || !tB) return false
  if (tA.date !== tB.date) return false

  const startA = tA.start_time || '10:00'
  const startB = tB.start_time || '10:00'
  const durationA = tA.estimated_duration_hours ?? 10
  const durationB = tB.estimated_duration_hours ?? 10

  const [hA, mA] = startA.split(':').map(Number)
  const [hB, mB] = startB.split(':').map(Number)
  const startMinA = hA * 60 + mA
  const startMinB = hB * 60 + mB
  const endMinA = startMinA + durationA * 60
  const endMinB = startMinB + durationB * 60

  return startMinA < endMinB && startMinB < endMinA
}

function getConflicts(entries: UserScheduleEntry[]): Set<string> {
  const conflicts = new Set<string>()
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entriesOverlap(entries[i], entries[j])) {
        conflicts.add(entries[i].id)
        conflicts.add(entries[j].id)
      }
    }
  }
  return conflicts
}

export function ScheduleView({ entries, onUpdateEntry, onRemoveEntry }: ScheduleViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Calendar className="size-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">No tournaments in your schedule yet.</p>
          <p className="text-muted-foreground text-sm mt-1">
            Browse tournaments and add them to your schedule.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/browse">Browse Tournaments</Link>
        </Button>
      </div>
    )
  }

  const conflicts = getConflicts(entries)

  // Group by date
  const grouped: Record<string, UserScheduleEntry[]> = {}
  for (const entry of entries) {
    const date = entry.tournament?.date ?? 'Unknown'
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(entry)
  }

  const sortedDates = Object.keys(grouped).sort()

  async function handleDelete(entryId: string) {
    setDeletingId(entryId)
    try {
      await onRemoveEntry(entryId)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const dateEntries = grouped[date]
        const displayDate = date !== 'Unknown' ? formatDate(date) : 'Unknown Date'
        const d = date !== 'Unknown' ? new Date(date + 'T12:00:00') : null
        const dayOfWeek = d
          ? d.toLocaleDateString('en-US', { weekday: 'long' })
          : ''

        return (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {dayOfWeek && `${dayOfWeek}, `}{displayDate}
              <span className="ml-2 text-xs font-normal lowercase">
                ({dateEntries.length} tournament{dateEntries.length !== 1 ? 's' : ''})
              </span>
            </h3>

            <div className="space-y-2">
              {dateEntries.map((entry) => {
                const t = entry.tournament
                if (!t) return null

                const hasConflict = conflicts.has(entry.id)
                const seriesColor = getSeriesColor(t.series?.name || '', t.series?.venue, t.name)
                const priorityConfig = PRIORITY_CONFIG[entry.priority]

                return (
                  <Card
                    key={entry.id}
                    className={cn(
                      'transition-colors',
                      hasConflict && 'border-red-500 border-2'
                    )}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/tournament/${t.slug ?? t.id}`}
                              className="font-medium text-sm hover:text-primary transition-colors truncate"
                            >
                              {t.name}
                            </Link>
                            {hasConflict && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                <AlertTriangle className="size-3 mr-0.5" />
                                Conflict
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            {seriesColor && (
                              <span className={cn('font-medium', seriesColor.text)}>
                                {t.series?.name}
                              </span>
                            )}
                            <span>{formatTime(t.start_time)}</span>
                            <span>{formatBuyIn(t.buy_in)}</span>
                            <span>{t.game_type}</span>
                            <span>{t.format}</span>
                          </div>

                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {entry.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  'h-7 text-xs px-2 gap-1',
                                  priorityConfig.className
                                )}
                              >
                                {priorityConfig.label}
                                <ChevronDown className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(Object.keys(PRIORITY_CONFIG) as Array<'target' | 'backup' | 'maybe'>).map(
                                (p) => (
                                  <DropdownMenuItem
                                    key={p}
                                    onClick={() => onUpdateEntry(entry.id, { priority: p })}
                                    className={cn(
                                      entry.priority === p && 'font-bold'
                                    )}
                                  >
                                    {PRIORITY_CONFIG[p].label}
                                  </DropdownMenuItem>
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {confirmDeleteId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs px-2"
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId === entry.id}
                              >
                                {deletingId === entry.id ? '...' : 'Yes'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmDeleteId(entry.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
