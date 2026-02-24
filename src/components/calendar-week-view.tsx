'use client'

import { useMemo } from 'react'
import { UserScheduleEntry } from '@/types'
import { CalendarEventBlock } from '@/components/calendar-event-block'
import { cn } from '@/lib/utils'
import { getWeekDates, toDateString, isToday, TIME_AXIS_HOURS, timeToPosition, durationToHeight } from '@/lib/calendar-utils'

interface CalendarWeekViewProps {
  currentDate: Date
  entries: UserScheduleEntry[]
  conflicts: Set<string>
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
}

export function CalendarWeekView({
  currentDate,
  entries,
  conflicts,
  onUpdateEntry,
  onRemoveEntry,
}: CalendarWeekViewProps) {
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

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

  return (
    <div className="flex overflow-x-auto">
      {/* Time axis */}
      <div className="w-14 shrink-0 border-r border-border">
        <div className="h-10" /> {/* Spacer for header row */}
        <div className="relative" style={{ height: `${TIME_AXIS_HOURS.length * 60}px` }}>
          {TIME_AXIS_HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute w-full text-right pr-2 text-[10px] text-muted-foreground -translate-y-1/2"
              style={{ top: `${((hour - 8) / 16) * 100}%` }}
            >
              {hour === 0 || hour === 24 ? '12am' : hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
            </div>
          ))}
        </div>
      </div>

      {/* Day columns */}
      <div className="flex-1 grid grid-cols-7 min-w-0">
        {weekDates.map((date) => {
          const dateStr = toDateString(date)
          const dayEntries = entriesByDate[dateStr] || []
          const today = isToday(date)

          return (
            <div key={dateStr} className="border-r border-border last:border-r-0 min-w-0">
              {/* Day header */}
              <div className={cn(
                'h-10 flex flex-col items-center justify-center border-b border-border text-xs',
                today && 'bg-primary/5'
              )}>
                <span className="text-muted-foreground text-[10px]">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={cn(
                  'font-medium w-6 h-6 flex items-center justify-center rounded-full text-xs',
                  today && 'bg-primary text-primary-foreground'
                )}>
                  {date.getDate()}
                </span>
              </div>

              {/* Time grid with events */}
              <div className="relative" style={{ height: `${TIME_AXIS_HOURS.length * 60}px` }}>
                {/* Hour lines */}
                {TIME_AXIS_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-border/50"
                    style={{ top: `${((hour - 8) / 16) * 100}%` }}
                  />
                ))}

                {/* Events */}
                {dayEntries.map((entry) => {
                  const t = entry.tournament
                  if (!t) return null
                  const top = timeToPosition(t.start_time)
                  const height = durationToHeight(t.estimated_duration_hours ?? 5)

                  return (
                    <div
                      key={entry.id}
                      className="absolute left-0.5 right-0.5 z-10"
                      style={{ top: `${top}%`, height: `${Math.max(height, 3)}%` }}
                    >
                      <CalendarEventBlock
                        entry={entry}
                        hasConflict={conflicts.has(entry.id)}
                        onUpdateEntry={onUpdateEntry}
                        onRemoveEntry={onRemoveEntry}
                        variant="normal"
                      />
                    </div>
                  )
                })}

                {/* Now indicator */}
                {today && <NowIndicator />}
              </div>
            </div>
          )
        })}
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
