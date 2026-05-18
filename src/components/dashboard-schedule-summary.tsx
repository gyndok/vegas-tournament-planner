'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { Calendar, Target, AlertTriangle, LogIn } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/utils'

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export function DashboardScheduleSummary() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading } = useSchedule()

  // Not signed in
  if (!userLoading && !user) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <LogIn className="size-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Sign in to track your schedule</p>
            <Link
              href="/login"
              className="text-sm text-primary hover:underline font-medium"
            >
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading
  if (userLoading || scheduleLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 rounded bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const today = getTodayStr()
  const todaysEntries = entries.filter((e) => e.tournament?.date === today)
  const targetEntries = entries.filter((e) => e.priority === 'target')
  const upcomingEntries = entries
    .filter((e) => e.tournament && e.tournament.date >= today)
    .sort((a, b) => {
      const dateA = a.tournament?.date ?? ''
      const dateB = b.tournament?.date ?? ''
      return dateA.localeCompare(dateB)
    })
  const nextEvent = upcomingEntries[0]

  // Check for conflicts (multiple events at same time on same day)
  const conflictCount = (() => {
    const timeSlots = new Map<string, number>()
    for (const entry of entries) {
      if (!entry.tournament) continue
      const key = `${entry.tournament.date}-${entry.tournament.start_time}`
      timeSlots.set(key, (timeSlots.get(key) ?? 0) + 1)
    }
    return [...timeSlots.values()].filter((count) => count > 1).length
  })()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          My Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground">{entries.length}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/5">
            <div className="text-2xl font-bold text-primary">{todaysEntries.length}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
              <Target className="size-4" />
              {targetEntries.length}
            </div>
            <div className="text-xs text-muted-foreground">Targets</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              {conflictCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="size-4" />
                  {conflictCount}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">0</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">Conflicts</div>
          </div>
        </div>

        {nextEvent?.tournament && (
          <div className="border-t border-border pt-3">
            <div className="text-xs text-muted-foreground mb-1">Next Up</div>
            <Link
              href={`/tournament/${nextEvent.tournament.slug ?? nextEvent.tournament.id}`}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {nextEvent.tournament.name}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDate(nextEvent.tournament.date)} at {formatTime(nextEvent.tournament.start_time)}
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href="/schedule"
            className="text-xs text-primary hover:underline font-medium"
          >
            View full schedule →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
