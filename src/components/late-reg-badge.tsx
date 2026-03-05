// src/components/late-reg-badge.tsx
'use client'

import { Tournament } from '@/types'
import { useLateRegCountdown, LateRegStatus } from '@/hooks/use-late-reg-countdown'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'

interface LateRegBadgeProps {
  tournament: Tournament
  size?: 'sm' | 'lg'
  showStatic?: boolean
}

const STATUS_STYLES: Record<LateRegStatus, { bg: string; text: string; border: string }> = {
  open: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/30',
  },
  closing: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/30',
  },
  urgent: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/30',
  },
  closed: {
    bg: 'bg-gray-100 dark:bg-gray-500/15',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-500/30',
  },
  not_started: {
    bg: 'bg-gray-50 dark:bg-gray-500/10',
    text: 'text-muted-foreground',
    border: 'border-gray-200 dark:border-gray-500/20',
  },
  no_data: {
    bg: '',
    text: '',
    border: '',
  },
}

export function LateRegBadge({ tournament, size = 'sm', showStatic = true }: LateRegBadgeProps) {
  const intervalMs = size === 'lg' ? 1_000 : 60_000
  const { status, formattedTime, lateRegEndDate, isLive } = useLateRegCountdown(tournament, intervalMs)

  if (status === 'no_data') return null

  if (status === 'not_started' && showStatic && lateRegEndDate) {
    const endTimeStr = tournament.late_reg_end_time
      ? formatTime(tournament.late_reg_end_time)
      : tournament.late_reg_levels
        ? `${tournament.late_reg_levels} levels`
        : null

    if (!endTimeStr) return null

    if (size === 'lg') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span>Late reg through {endTimeStr}</span>
        </div>
      )
    }

    return null
  }

  const styles = STATUS_STYLES[status]
  if (!styles.bg) return null

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg border px-4 py-2.5',
          styles.bg,
          styles.text,
          styles.border
        )}
      >
        <Timer className={cn('size-4 shrink-0', status === 'urgent' && 'animate-pulse')} />
        <div className="flex-1">
          {isLive ? (
            <>
              <span className="font-semibold">Late reg: {formattedTime}</span>
              {lateRegEndDate && (
                <span className="text-xs opacity-70 ml-2">
                  (closes at {lateRegEndDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/Los_Angeles',
                  })})
                </span>
              )}
            </>
          ) : (
            <span className="font-medium">Late reg closed</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
        styles.bg,
        styles.text,
        styles.border
      )}
    >
      <Timer className={cn('size-3', status === 'urgent' && 'animate-pulse')} />
      {isLive ? `Late reg: ${formattedTime}` : 'Late reg closed'}
    </span>
  )
}
