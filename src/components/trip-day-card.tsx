'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tournament, UserScheduleEntry, TournamentResult } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogResultDialog } from '@/components/log-result-dialog'
import { getSeriesColor, formatBuyIn, formatTime } from '@/lib/utils'
import { ChevronDown, ChevronUp, CalendarPlus, Trash2, Search, Trophy, Pencil, RotateCcw } from 'lucide-react'

const PRIORITY_CONFIG = {
  target: { label: 'Target', className: 'bg-primary text-primary-foreground' },
  backup: { label: 'Backup', className: 'bg-yellow-600 text-white' },
  maybe: { label: 'Maybe', className: 'bg-gray-600 text-white' },
}

interface TripDayCardProps {
  date: string
  dayLabel: string
  dayNumber: number
  scheduledEntries: UserScheduleEntry[]
  availableTournaments: Tournament[]
  onQuickAdd: (tournamentId: string) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
  onReenter: (tournamentId: string) => Promise<void>
  getResultForEntry: (scheduleEntryId: string) => TournamentResult | null
  onLogResult: (scheduleEntryId: string, data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onUpdateResult: (resultId: string, data: { result_amount?: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onDeleteResult: (resultId: string) => Promise<void>
}

export function TripDayCard({
  date,
  dayLabel,
  dayNumber,
  scheduledEntries,
  availableTournaments,
  onQuickAdd,
  onRemove,
  onReenter,
  getResultForEntry,
  onLogResult,
  onUpdateResult,
  onDeleteResult,
}: TripDayCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [dialogEntry, setDialogEntry] = useState<UserScheduleEntry | null>(null)

  const handleQuickAdd = async (tournamentId: string) => {
    setAddingId(tournamentId)
    try {
      await onQuickAdd(tournamentId)
    } finally {
      setAddingId(null)
    }
  }

  const handleRemove = async (entryId: string) => {
    setRemovingId(entryId)
    try {
      await onRemove(entryId)
    } finally {
      setRemovingId(null)
    }
  }

  const totalBuyIn = scheduledEntries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0)

  const dialogResult = dialogEntry ? getResultForEntry(dialogEntry.id) : null

  return (
    <Card>
      <CardContent className="p-4">
        {/* Day header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
              {dayNumber}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{dayLabel}</h3>
              <p className="text-xs text-muted-foreground">{date}</p>
            </div>
          </div>
          {scheduledEntries.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {scheduledEntries.length} tournament{scheduledEntries.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs font-medium">{formatBuyIn(totalBuyIn)}</p>
            </div>
          )}
        </div>

        {/* Scheduled tournaments */}
        {scheduledEntries.length > 0 ? (
          <div className="space-y-2 mb-3">
            {scheduledEntries.map((entry) => {
              const t = entry.tournament
              if (!t) return null
              const colors = getSeriesColor(t.series?.name || '', t.series?.venue, t.name)
              const priority = PRIORITY_CONFIG[entry.priority]
              const result = getResultForEntry(entry.id)
              const profit = result ? result.result_amount - t.buy_in : null
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-lg border-l-4 ${colors.border} bg-muted/50 p-3`}
                >
                  <Link href={`/tournament/${t.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{formatTime(t.start_time)}</span>
                      <Badge variant="outline" className={`text-[10px] ${colors.bg} ${colors.text} border-transparent`}>
                        {colors.label}
                      </Badge>
                      <Badge className={`text-[10px] ${priority.className}`}>
                        {priority.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate mt-1">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {scheduledEntries.filter(e => e.tournament_id === t.id).length > 1
                        ? `Entry ${entry.entry_number} · ${formatBuyIn(t.buy_in)}`
                        : formatBuyIn(t.buy_in)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {result ? (
                      <button
                        onClick={() => setDialogEntry(entry)}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 ${
                          profit !== null && profit >= 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        <Trophy className="size-3" />
                        {profit !== null && profit >= 0 ? '+' : ''}
                        {formatBuyIn(profit ?? 0)}
                        <Pencil className="size-3 ml-0.5 opacity-60" />
                      </button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogEntry(entry)}
                        className="text-xs h-7"
                      >
                        <Trophy className="size-3 mr-1" />
                        Log
                      </Button>
                    )}
                    {t.format?.toLowerCase().includes('re-entry') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReenter(t.id)}
                        className="text-muted-foreground hover:text-primary"
                        title="Re-enter"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(entry.id)}
                      disabled={removingId === entry.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 mb-3">
            <Search className="size-4" />
            <span>Free day — </span>
            <Link href={`/browse?dateFrom=${date}&dateTo=${date}`} className="text-primary hover:underline">
              browse tournaments
            </Link>
          </div>
        )}

        {/* Available tournaments (collapsible) */}
        {availableTournaments.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {availableTournaments.length} more tournament{availableTournaments.length !== 1 ? 's' : ''} available
            </button>

            {expanded && (
              <div className="space-y-1.5 mt-2">
                {availableTournaments.map((t) => {
                  const colors = getSeriesColor(t.series?.name || '', t.series?.venue, t.name)
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md bg-muted/30 p-2"
                    >
                      <Link href={`/tournament/${t.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatTime(t.start_time)}</span>
                          <Badge variant="outline" className={`text-[10px] ${colors.bg} ${colors.text} border-transparent`}>
                            {colors.label}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium truncate mt-0.5">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBuyIn(t.buy_in)}</p>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAdd(t.id)}
                        disabled={addingId === t.id}
                        className="shrink-0 ml-2 text-xs h-7"
                      >
                        <CalendarPlus className="size-3 mr-1" />
                        {addingId === t.id ? '...' : 'Add'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Log Result Dialog */}
      {dialogEntry && dialogEntry.tournament && (
        <LogResultDialog
          open={!!dialogEntry}
          onOpenChange={(open) => { if (!open) setDialogEntry(null) }}
          tournamentName={dialogEntry.tournament.name}
          buyIn={dialogEntry.tournament.buy_in}
          existingResult={dialogResult}
          onSave={async (data) => {
            if (dialogResult) {
              await onUpdateResult(dialogResult.id, data)
            } else {
              await onLogResult(dialogEntry.id, data)
            }
          }}
          onDelete={dialogResult ? async () => {
            await onDeleteResult(dialogResult.id)
          } : undefined}
        />
      )}
    </Card>
  )
}
