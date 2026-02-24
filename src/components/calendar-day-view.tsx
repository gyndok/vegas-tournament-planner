'use client'

import { useMemo } from 'react'
import { UserScheduleEntry } from '@/types'
import { CalendarEventPopover } from '@/components/calendar-event-popover'
import { cn } from '@/lib/utils'
import { formatBuyIn, formatTime } from '@/lib/utils'
import { toDateString, isToday, TIME_AXIS_HOURS, timeToPosition, durationToHeight } from '@/lib/calendar-utils'

const PRIORITY_COLORS = {
  target: 'bg-primary/20 border-primary/40 text-primary',
  backup: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-400',
  maybe: 'bg-gray-500/20 border-gray-500/40 text-gray-600 dark:text-gray-400',
}

interface CalendarDayViewProps {
  currentDate: Date
  entries: UserScheduleEntry[]
  conflicts: Set<string>
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
}

export function CalendarDayView({
  currentDate,
  entries,
  conflicts,
  onUpdateEntry,
  onRemoveEntry,
}: CalendarDayViewProps) {
  const dateStr = toDateString(currentDate)
  const today = isToday(currentDate)

  const dayEntries = useMemo(
    () => entries.filter((e) => e.tournament?.date === dateStr),
    [entries, dateStr]
  )

  return (
    <div className="flex">
      {/* Time axis */}
      <div className="w-16 shrink-0 border-r border-border">
        <div className="relative" style={{ height: `${TIME_AXIS_HOURS.length * 60}px` }}>
          {TIME_AXIS_HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute w-full text-right pr-2 text-xs text-muted-foreground -translate-y-1/2"
              style={{ top: `${((hour - 8) / 16) * 100}%` }}
            >
              {hour === 0 || hour === 24 ? '12am' : hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
            </div>
          ))}
        </div>
      </div>

      {/* Day column */}
      <div className="flex-1 relative" style={{ height: `${TIME_AXIS_HOURS.length * 60}px` }}>
        {/* Hour lines */}
        {TIME_AXIS_HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute w-full border-t border-border/50"
            style={{ top: `${((hour - 8) / 16) * 100}%` }}
          />
        ))}

        {/* Events — wider blocks with more details */}
        {dayEntries.map((entry) => {
          const t = entry.tournament
          if (!t) return null
          const top = timeToPosition(t.start_time)
          const height = durationToHeight(t.estimated_duration_hours ?? 5)
          const colorClass = PRIORITY_COLORS[entry.priority]
          const hasConflict = conflicts.has(entry.id)

          return (
            <CalendarEventPopover
              key={entry.id}
              entry={entry}
              hasConflict={hasConflict}
              onUpdateEntry={onUpdateEntry}
              onRemoveEntry={onRemoveEntry}
            >
              <button
                className={cn(
                  'absolute left-1 right-1 md:left-2 md:right-2 z-10 rounded-md border px-3 py-2 text-left cursor-pointer transition-colors overflow-hidden',
                  colorClass,
                  hasConflict && 'ring-2 ring-red-500',
                )}
                style={{ top: `${top}%`, height: `${Math.max(height, 4)}%` }}
              >
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {formatTime(t.start_time)} · {formatBuyIn(t.buy_in)} · {t.game_type} · {t.format}
                </div>
                {t.guaranteed_prize && t.guaranteed_prize > 0 && (
                  <div className="text-xs opacity-70 mt-0.5">
                    GTD {formatBuyIn(t.guaranteed_prize)}
                  </div>
                )}
              </button>
            </CalendarEventPopover>
          )
        })}

        {/* Now indicator */}
        {today && <NowIndicator />}
      </div>
    </div>
  )
}

function NowIndicator() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = 8 * 60
  const totalMinutes = 16 * 60
  const position = ((minutes - startMinutes) / totalMinutes) * 100

  if (position < 0 || position > 100) return null

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${position}%` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-px bg-red-500" />
      </div>
    </div>
  )
}
