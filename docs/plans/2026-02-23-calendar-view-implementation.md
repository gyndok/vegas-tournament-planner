# Schedule Calendar View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Month/Week/Day calendar views to the My Schedule page, with event popovers, priority color-coding, and responsive behavior. Also hide past tournaments from browse.

**Architecture:** Custom CSS Grid calendar with no external libraries. A `ScheduleCalendar` wrapper manages view mode and date navigation, delegating to `CalendarMonthView`, `CalendarWeekView`, and `CalendarDayView` components. Shared `CalendarEventBlock` and `CalendarEventPopover` components handle event display and interaction. The existing `ScheduleView` list component is preserved for tablet/desktop.

**Tech Stack:** Next.js 16, React 19, CSS Grid, Tailwind CSS 4, shadcn/ui (Popover, Tabs), Radix UI primitives

---

### Task 1: Hide past tournaments from browse page

**Files:**
- Modify: `src/app/api/tournaments/route.ts`

**Step 1: Default dateFrom to today when not specified**

In `src/app/api/tournaments/route.ts`, change the `dateFrom` line from:

```typescript
dateFrom: searchParams.get('dateFrom') || undefined,
```

to:

```typescript
dateFrom: searchParams.get('dateFrom') || new Date().toISOString().split('T')[0],
```

This ensures the browse page never shows past tournaments unless the user explicitly sets a date filter.

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/tournaments/route.ts
git commit -m "feat: default browse to hide past tournaments

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add shadcn Popover component

**Files:**
- Create: `src/components/ui/popover.tsx`

**Step 1: Install popover component**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx shadcn@latest add popover`

This creates `src/components/ui/popover.tsx` with `Popover`, `PopoverTrigger`, `PopoverContent` exports.

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/ui/popover.tsx
git commit -m "feat: add shadcn Popover component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create CalendarEventPopover component

**Files:**
- Create: `src/components/calendar-event-popover.tsx`

**Step 1: Create the popover component**

This component wraps any trigger element and shows a popover with tournament details + actions on click.

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserScheduleEntry } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatBuyIn, formatTime, formatDate } from '@/lib/utils'
import { ChevronDown, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'

const PRIORITY_CONFIG = {
  target: { label: 'Target', className: 'bg-primary hover:bg-primary/90 text-primary-foreground' },
  backup: { label: 'Backup', className: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
  maybe: { label: 'Maybe', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
}

interface CalendarEventPopoverProps {
  entry: UserScheduleEntry
  hasConflict: boolean
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
  children: React.ReactNode
}

export function CalendarEventPopover({
  entry,
  hasConflict,
  onUpdateEntry,
  onRemoveEntry,
  children,
}: CalendarEventPopoverProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const t = entry.tournament
  if (!t) return <>{children}</>

  const priorityConfig = PRIORITY_CONFIG[entry.priority]

  async function handleDelete() {
    setDeleting(true)
    try {
      await onRemoveEntry(entry.id)
      setOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div>
            <Link
              href={`/tournament/${t.id}`}
              className="font-medium text-sm hover:text-primary transition-colors leading-tight"
              onClick={() => setOpen(false)}
            >
              {t.name}
              <ExternalLink className="size-3 inline ml-1 opacity-50" />
            </Link>
            {t.series && (
              <p className="text-xs text-muted-foreground mt-0.5">{t.series.name}</p>
            )}
          </div>

          {/* Details */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>{formatDate(t.date)} · {formatTime(t.start_time)}</span>
              <span className="font-medium text-foreground">{formatBuyIn(t.buy_in)}</span>
            </div>
            <div className="flex gap-2">
              <span>{t.game_type}</span>
              <span>·</span>
              <span>{t.format}</span>
            </div>
            {t.guaranteed_prize && t.guaranteed_prize > 0 && (
              <div>GTD {formatBuyIn(t.guaranteed_prize)}</div>
            )}
          </div>

          {/* Conflict warning */}
          {hasConflict && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="size-3 mr-1" />
              Schedule conflict
            </Badge>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn('h-7 text-xs px-2 gap-1', priorityConfig.className)}
                >
                  {priorityConfig.label}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(PRIORITY_CONFIG) as Array<'target' | 'backup' | 'maybe'>).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => onUpdateEntry(entry.id, { priority: p })}
                    className={cn(entry.priority === p && 'font-bold')}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-3.5 mr-1" />
              {deleting ? '...' : 'Remove'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/calendar-event-popover.tsx
git commit -m "feat: add CalendarEventPopover component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Create CalendarEventBlock component

**Files:**
- Create: `src/components/calendar-event-block.tsx`

**Step 1: Create the shared event block component**

This is the colored pill/block used in all calendar views. It wraps itself in the popover.

```tsx
'use client'

import { UserScheduleEntry } from '@/types'
import { CalendarEventPopover } from '@/components/calendar-event-popover'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'

const PRIORITY_COLORS = {
  target: 'bg-primary/20 border-primary/40 text-primary hover:bg-primary/30',
  backup: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30',
  maybe: 'bg-gray-500/20 border-gray-500/40 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30',
}

interface CalendarEventBlockProps {
  entry: UserScheduleEntry
  hasConflict: boolean
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
  /** 'compact' for month cells, 'normal' for week/day */
  variant?: 'compact' | 'normal'
}

export function CalendarEventBlock({
  entry,
  hasConflict,
  onUpdateEntry,
  onRemoveEntry,
  variant = 'normal',
}: CalendarEventBlockProps) {
  const t = entry.tournament
  if (!t) return null

  const colorClass = PRIORITY_COLORS[entry.priority]

  return (
    <CalendarEventPopover
      entry={entry}
      hasConflict={hasConflict}
      onUpdateEntry={onUpdateEntry}
      onRemoveEntry={onRemoveEntry}
    >
      <button
        className={cn(
          'w-full text-left rounded border px-1.5 py-0.5 cursor-pointer transition-colors text-xs leading-tight truncate',
          colorClass,
          hasConflict && 'ring-1 ring-red-500',
          variant === 'compact' && 'text-[10px] py-0 px-1',
        )}
      >
        {variant === 'compact' ? (
          <span className="truncate">{formatTime(t.start_time)} {t.name.split(':')[0]}</span>
        ) : (
          <>
            <div className="font-medium truncate">{formatTime(t.start_time)}</div>
            <div className="truncate opacity-80">{t.name}</div>
          </>
        )}
      </button>
    </CalendarEventPopover>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/calendar-event-block.tsx
git commit -m "feat: add CalendarEventBlock component with priority colors

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Create calendar utility functions

**Files:**
- Create: `src/lib/calendar-utils.ts`

**Step 1: Create date utility functions for the calendar**

```typescript
/**
 * Calendar utility functions for date navigation and grid building.
 */

/** Get the start of the week (Sunday) for a given date */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get the end of the week (Saturday) for a given date */
export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

/** Get all dates in a month grid (includes padding days from prev/next month) */
export function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const start = startOfWeek(firstDay)
  const dates: Date[] = []

  const current = new Date(start)
  // Always show 6 weeks for consistent grid height
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/** Get all 7 dates in a week */
export function getWeekDates(date: Date): Date[] {
  const start = startOfWeek(date)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

/** Format a Date to YYYY-MM-DD (matching tournament.date format) */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b)
}

/** Check if a date is today */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/** Format period label for each view mode */
export function formatPeriodLabel(date: Date, view: 'month' | 'week' | 'day'): string {
  if (view === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (view === 'day') {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  }
  // Week
  const start = startOfWeek(date)
  const end = endOfWeek(date)
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

/** Navigate to previous/next period */
export function navigatePeriod(date: Date, view: 'month' | 'week' | 'day', direction: -1 | 1): Date {
  const d = new Date(date)
  if (view === 'month') {
    d.setMonth(d.getMonth() + direction)
  } else if (view === 'week') {
    d.setDate(d.getDate() + direction * 7)
  } else {
    d.setDate(d.getDate() + direction)
  }
  return d
}

/** Time axis hours for week/day view (8am to midnight) */
export const TIME_AXIS_HOURS = Array.from({ length: 17 }, (_, i) => i + 8) // 8, 9, ..., 24

/** Convert a time string "HH:MM" to minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Convert a time string to a top-offset percentage within the time axis (8am-midnight) */
export function timeToPosition(time: string): number {
  const minutes = timeToMinutes(time)
  const startMinutes = 8 * 60 // 8am
  const totalMinutes = 16 * 60 // 8am to midnight = 16 hours
  return Math.max(0, Math.min(100, ((minutes - startMinutes) / totalMinutes) * 100))
}

/** Convert duration in hours to a height percentage within the time axis */
export function durationToHeight(hours: number): number {
  const totalMinutes = 16 * 60
  return Math.min(100, (hours * 60 / totalMinutes) * 100)
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/calendar-utils.ts
git commit -m "feat: add calendar date utility functions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Create CalendarMonthView component

**Files:**
- Create: `src/components/calendar-month-view.tsx`

**Step 1: Create the month grid component**

```tsx
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
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/calendar-month-view.tsx
git commit -m "feat: add CalendarMonthView component with CSS Grid

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Create CalendarWeekView component

**Files:**
- Create: `src/components/calendar-week-view.tsx`

**Step 1: Create the week view with time axis**

```tsx
'use client'

import { useMemo } from 'react'
import { UserScheduleEntry } from '@/types'
import { CalendarEventBlock } from '@/components/calendar-event-block'
import { cn } from '@/lib/utils'
import { getWeekDates, toDateString, isToday, TIME_AXIS_HOURS, timeToPosition, durationToHeight } from '@/lib/calendar-utils'
import { formatTime } from '@/lib/utils'

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
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/calendar-week-view.tsx
git commit -m "feat: add CalendarWeekView component with time axis and now indicator

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Create CalendarDayView component

**Files:**
- Create: `src/components/calendar-day-view.tsx`

**Step 1: Create the day view with expanded event blocks**

```tsx
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
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/calendar-day-view.tsx
git commit -m "feat: add CalendarDayView component with expanded event blocks

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Create ScheduleCalendar wrapper component

**Files:**
- Create: `src/components/schedule-calendar.tsx`

**Step 1: Create the main calendar wrapper with view switching and navigation**

```tsx
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
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
}

export function ScheduleCalendar({
  entries,
  onUpdateEntry,
  onRemoveEntry,
}: ScheduleCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const conflicts = useMemo(() => getConflicts(entries), [entries])

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
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
          onDayClick={handleDayClick}
        />
      )}

      {viewMode === 'week' && (
        <CalendarWeekView
          currentDate={currentDate}
          entries={entries}
          conflicts={conflicts}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )}

      {viewMode === 'day' && (
        <CalendarDayView
          currentDate={currentDate}
          entries={entries}
          conflicts={conflicts}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )}

      {viewMode === 'list' && (
        <ScheduleView
          entries={entries}
          onUpdateEntry={onUpdateEntry}
          onRemoveEntry={onRemoveEntry}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/schedule-calendar.tsx
git commit -m "feat: add ScheduleCalendar wrapper with view switching and navigation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Update schedule page to use ScheduleCalendar

**Files:**
- Modify: `src/app/schedule/page.tsx`

**Step 1: Replace ScheduleView with ScheduleCalendar**

In `src/app/schedule/page.tsx`, make these changes:

1. Replace the `ScheduleView` import with `ScheduleCalendar`:

```typescript
import { ScheduleCalendar } from '@/components/schedule-calendar'
```

Remove:
```typescript
import { ScheduleView } from '@/components/schedule-view'
```

2. Replace the `<ScheduleView ... />` usage with `<ScheduleCalendar ... />`:

Replace:
```tsx
<ScheduleView
  entries={entries}
  onUpdateEntry={updateEntry}
  onRemoveEntry={removeFromSchedule}
/>
```

With:
```tsx
<ScheduleCalendar
  entries={entries}
  onUpdateEntry={updateEntry}
  onRemoveEntry={removeFromSchedule}
/>
```

3. Remove the `max-w-4xl` constraint from the outer div since the calendar needs more width:

Replace:
```tsx
<div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
```

With:
```tsx
<div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/schedule/page.tsx
git commit -m "feat: replace schedule list view with calendar as default view

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Final build verification and deploy

**Step 1: Full build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Build succeeds with no errors

**Step 2: Manual smoke check**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next dev`
Verify in browser:
- Schedule page loads with Week view by default
- Month/Week/Day/List tabs work
- Navigation (← Today →) works
- Events show as colored blocks by priority
- Clicking an event shows popover with details
- Priority can be changed from popover
- Events can be removed from popover
- Conflicts highlighted with red ring
- List tab only visible on tablet/desktop
- Browse page no longer shows past tournaments

**Step 3: Deploy**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && vercel --prod`
Expected: Deployment succeeds, aliased to nextrebuy.com
