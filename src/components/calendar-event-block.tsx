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
