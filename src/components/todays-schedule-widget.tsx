'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { formatTime } from '@/lib/utils'
import { getSeriesColor } from '@/lib/utils'
import { Calendar, ArrowRight, LogIn } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

const priorityStyles: Record<string, string> = {
  target: 'bg-primary/10 text-primary border-primary/20',
  backup: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  maybe: 'bg-muted text-muted-foreground border-border',
}

export function TodaysScheduleWidget() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading } = useSchedule()

  const today = getTodayStr()
  const todaysEntries = entries.filter((e) => e.tournament?.date === today)

  // Not signed in
  if (!userLoading && !user) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Schedule
        </h3>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <LogIn className="size-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Sign in to see your schedule</p>
        </div>
      </div>
    )
  }

  // Loading
  if (userLoading || scheduleLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Schedule
        </h3>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Schedule
        </h3>
        <Link
          href="/schedule"
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>

      {todaysEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-4 text-center">
          <Calendar className="size-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No events today</p>
          <Link
            href="/browse"
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            Browse tournaments
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {todaysEntries.map((entry) => {
            const tournament = entry.tournament
            if (!tournament) return null
            const seriesName = tournament.series?.name ?? ''
            const colors = getSeriesColor(seriesName, tournament.series?.venue, tournament.name)

            return (
              <Link
                key={entry.id}
                href={`/tournament/${tournament.id}`}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`size-2 rounded-full ${colors.dot}`} />
                      <span className="text-xs text-muted-foreground">
                        {formatTime(tournament.start_time)}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {tournament.name}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${priorityStyles[entry.priority]}`}
                  >
                    {entry.priority}
                  </Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
