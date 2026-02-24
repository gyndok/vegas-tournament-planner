'use client'

import { useState, useMemo } from 'react'
import { UserScheduleEntry } from '@/types'
import { CalendarMonthView } from '@/components/calendar-month-view'
import { CalendarWeekView } from '@/components/calendar-week-view'
import { CalendarDayView } from '@/components/calendar-day-view'
import { ScheduleView } from '@/components/schedule-view'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPeriodLabel, navigatePeriod } from '@/lib/calendar-utils'

type ViewMode = 'month' | 'week' | 'day' | 'list'

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

interface ScheduleCalendarProps {
  entries: UserScheduleEntry[]
  onUpdateEntry?: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry?: (entryId: string) => Promise<void>
  readOnly?: boolean
}

export function ScheduleCalendar({
  entries,
  onUpdateEntry,
  onRemoveEntry,
  readOnly = false,
}: ScheduleCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const conflicts = useMemo(() => getConflicts(entries), [entries])
  const handleUpdate = onUpdateEntry ?? (async () => {})
  const handleRemove = onRemoveEntry ?? (async () => {})

  function handlePrev() {
    if (viewMode === 'list') return
    setCurrentDate(navigatePeriod(currentDate, viewMode, -1))
  }

  function handleNext() {
    if (viewMode === 'list') return
    setCurrentDate(navigatePeriod(currentDate, viewMode, 1))
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date)
    setViewMode('day')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Navigation — hidden in list mode */}
        {viewMode !== 'list' ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              {formatPeriodLabel(currentDate, viewMode)}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* View mode tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
            <TabsTrigger value="day" className="text-xs px-3">Day</TabsTrigger>
            {/* List only on md+ */}
            <TabsTrigger value="list" className="text-xs px-3 hidden md:inline-flex">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar views */}
      {viewMode === 'month' && (
        <CalendarMonthView
          currentDate={currentDate}
          entries={entries}
          conflicts={conflicts}
          onUpdateEntry={handleUpdate}
          onRemoveEntry={handleRemove}
          onDayClick={handleDayClick}
        />
      )}

      {viewMode === 'week' && (
        <CalendarWeekView
          currentDate={currentDate}
          entries={entries}
          conflicts={conflicts}
          onUpdateEntry={handleUpdate}
          onRemoveEntry={handleRemove}
        />
      )}

      {viewMode === 'day' && (
        <CalendarDayView
          currentDate={currentDate}
          entries={entries}
          conflicts={conflicts}
          onUpdateEntry={handleUpdate}
          onRemoveEntry={handleRemove}
        />
      )}

      {viewMode === 'list' && (
        <ScheduleView
          entries={entries}
          onUpdateEntry={handleUpdate}
          onRemoveEntry={handleRemove}
        />
      )}
    </div>
  )
}
