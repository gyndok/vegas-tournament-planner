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
