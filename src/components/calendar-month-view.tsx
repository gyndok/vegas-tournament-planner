'use client'

import { useMemo } from 'react'
import { UserScheduleEntry } from '@/types'
import { CalendarEventBlock } from '@/components/calendar-event-block'
import { cn } from '@/lib/utils'
import { getMonthGrid, toDateString, isToday } from '@/lib/calendar-utils'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarMonthViewProps {
  currentDate: Date
  entries: UserScheduleEntry[]
  conflicts: Set<string>
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
  onDayClick: (date: Date) => void
}

export function CalendarMonthView({
  currentDate,
  entries,
  conflicts,
  onUpdateEntry,
  onRemoveEntry,
  onDayClick,
}: CalendarMonthViewProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const gridDates = useMemo(() => getMonthGrid(year, month), [year, month])

  // Group entries by date string
  const entriesByDate = useMemo(() => {
    const map: Record<string, UserScheduleEntry[]> = {}
    for (const entry of entries) {
      const date = entry.tournament?.date
      if (!date) continue
      if (!map[date]) map[date] = []
      map[date].push(entry)
    }
    return map
  }, [entries])

  const MAX_VISIBLE = 2

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(80px,1fr)] md:auto-rows-[minmax(100px,1fr)]">
        {gridDates.map((date, i) => {
          const dateStr = toDateString(date)
          const isCurrentMonth = date.getMonth() === month
          const dayEntries = entriesByDate[dateStr] || []
          const visibleEntries = dayEntries.slice(0, MAX_VISIBLE)
          const remaining = dayEntries.length - MAX_VISIBLE

          return (
            <div
              key={i}
              className={cn(
                'border-b border-r border-border p-1 min-h-0 overflow-hidden',
                !isCurrentMonth && 'bg-muted/30',
                i % 7 === 0 && 'border-l',
              )}
            >
              <button
                onClick={() => onDayClick(date)}
                className={cn(
                  'text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center mb-0.5 hover:bg-accent transition-colors',
                  isToday(date) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  !isCurrentMonth && 'text-muted-foreground',
                )}
              >
                {date.getDate()}
              </button>

              <div className="space-y-0.5">
                {visibleEntries.map((entry) => (
                  <CalendarEventBlock
                    key={entry.id}
                    entry={entry}
                    hasConflict={conflicts.has(entry.id)}
                    onUpdateEntry={onUpdateEntry}
                    onRemoveEntry={onRemoveEntry}
                    variant="compact"
                  />
                ))}
                {remaining > 0 && (
                  <button
                    onClick={() => onDayClick(date)}
                    className="text-[10px] text-muted-foreground hover:text-foreground w-full text-left px-1"
                  >
                    +{remaining} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
