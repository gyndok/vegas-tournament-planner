'use client'

import { UserScheduleEntry } from '@/types'
import { ScheduleCalendar } from '@/components/schedule-calendar'
import { CalendarDays } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface SharedScheduleViewProps {
  entries: UserScheduleEntry[]
  tripDates: { from: string | null; to: string | null }
}

export function SharedScheduleView({ entries, tripDates }: SharedScheduleViewProps) {
  const dateRange = tripDates.from && tripDates.to
    ? `${format(parseISO(tripDates.from), 'MMM d')} – ${format(parseISO(tripDates.to), 'MMM d, yyyy')}`
    : null

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <CalendarDays className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">No tournaments scheduled yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            This schedule is empty.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared Schedule</h1>
        {dateRange && (
          <p className="text-muted-foreground text-sm mt-1">{dateRange}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {entries.length} tournament{entries.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <ScheduleCalendar entries={entries} readOnly />
    </div>
  )
}
