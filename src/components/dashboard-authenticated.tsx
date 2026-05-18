'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { useResults } from '@/hooks/use-results'
import { usePreferences } from '@/hooks/use-preferences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdUnit } from '@/components/ad-unit'
import { ClosingSoonWidget } from '@/components/closing-soon-widget'
import { FeaturedSeriesGrid } from '@/components/featured-series-grid'
import {
  Calendar,
  Plane,
  DollarSign,
  TrendingUp,
  Search,
  MessageSquare,
  MapPin,
  ArrowRight,
  Settings,
  Trophy,
} from 'lucide-react'
import { formatDate, formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Returns today's date in Pacific Time as YYYY-MM-DD */
function getTodayStr(): string {
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  return pt.toISOString().split('T')[0]
}

/** Days from today (PT) to the target date string (YYYY-MM-DD). Negative = past. */
function getDaysUntil(dateStr: string): number {
  const today = new Date(getTodayStr() + 'T12:00:00')
  const target = new Date(dateStr + 'T12:00:00')
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** Which day of the trip it is (1-indexed). */
function getDayOfTrip(startStr: string): number {
  return getDaysUntil(startStr) * -1 + 1
}

/** Total trip length in days (inclusive of start and end). */
function getTripLength(startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T12:00:00')
  const end = new Date(endStr + 'T12:00:00')
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-56 rounded bg-muted animate-pulse mt-2" />
      </div>

      {/* Trip status card */}
      <div className="h-28 rounded-xl bg-muted animate-pulse" />

      {/* Today's schedule */}
      <div className="h-48 rounded-xl bg-muted animate-pulse" />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>

      {/* Week schedule */}
      <div className="h-48 rounded-xl bg-muted animate-pulse" />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardAuthenticated() {
  const { loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading } = useSchedule()
  const { results, loading: resultsLoading } = useResults()
  const { preferences, loading: prefsLoading } = usePreferences()

  const isLoading = userLoading || scheduleLoading || resultsLoading || prefsLoading

  if (isLoading) {
    return <DashboardSkeleton />
  }

  const today = getTodayStr()
  const tripStart = preferences?.trip_start ?? null
  const tripEnd = preferences?.trip_end ?? null
  const tripBudget = preferences?.trip_budget ?? null

  // ---- Schedule filtering ----
  const todayEntries = entries.filter((e) => e.tournament?.date === today)

  const weekEnd = (() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()

  const weekEntries = entries
    .filter((e) => {
      const date = e.tournament?.date
      return date && date >= today && date <= weekEnd
    })
    .sort((a, b) => {
      const dateA = a.tournament?.date ?? ''
      const dateB = b.tournament?.date ?? ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      const timeA = a.tournament?.start_time ?? ''
      const timeB = b.tournament?.start_time ?? ''
      return timeA.localeCompare(timeB)
    })

  // ---- Stats ----
  const totalBuyIns = entries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0)
  const budgetRemaining = tripBudget != null ? tripBudget - totalBuyIns : null

  // Net P&L: only from entries that have a result
  const resultByEntryId = new Map(results.map((r) => [r.schedule_entry_id, r]))
  let totalCashOut = 0
  let playedBuyIns = 0
  for (const entry of entries) {
    const result = resultByEntryId.get(entry.id)
    if (result) {
      totalCashOut += result.result_amount
      playedBuyIns += entry.tournament?.buy_in ?? 0
    }
  }
  const hasResults = results.length > 0
  const netPnL = totalCashOut - playedBuyIns

  // ---- Trip state ----
  type TripState = 'none' | 'upcoming' | 'in_progress' | 'completed'
  let tripState: TripState = 'none'
  if (tripStart && tripEnd) {
    const daysUntilStart = getDaysUntil(tripStart)
    const daysUntilEnd = getDaysUntil(tripEnd)
    if (daysUntilEnd < 0) {
      tripState = 'completed'
    } else if (daysUntilStart <= 0) {
      tripState = 'in_progress'
    } else {
      tripState = 'upcoming'
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 1. Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your trip at a glance</p>
      </div>

      {/* 2. Trip Countdown / Status Card */}
      <TripStatusCard
        tripState={tripState}
        tripStart={tripStart}
        tripEnd={tripEnd}
      />

      {/* 3. Today's Schedule */}
      <TodayScheduleCard entries={todayEntries} today={today} />

      {/* 3b. Late Reg Closing Soon */}
      <ClosingSoonWidget />

      {/* 4. Trip Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Budget remaining */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="size-4" />
              Budget Remaining
            </div>
            <div className="text-2xl font-bold">
              {budgetRemaining != null ? formatBuyIn(budgetRemaining) : '--'}
            </div>
          </CardContent>
        </Card>

        {/* Tournaments scheduled */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="size-4" />
              Tournaments Scheduled
            </div>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>

        {/* Net P&L */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="size-4" />
              Net P&amp;L
            </div>
            <div
              className={`text-2xl font-bold ${
                hasResults
                  ? netPnL >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                  : ''
              }`}
            >
              {hasResults
                ? `${netPnL >= 0 ? '+' : ''}${formatBuyIn(netPnL)}`
                : '--'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Ad unit */}
      <AdUnit slot="8176455870" size="banner" channel="dashboard" />

      {/* 6. This Week's Schedule */}
      <WeekScheduleCard entries={weekEntries} />

      {/* 6b. Featured Summer Series */}
      <FeaturedSeriesGrid />

      {/* 7. Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/browse"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Browse</div>
            <div className="text-xs text-muted-foreground">Find tournaments</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>

        <Link
          href="/pools"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Trophy className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">My Pools</div>
            <div className="text-xs text-muted-foreground">Last-longer pools</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>

        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10 group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Advisor</div>
            <div className="text-xs text-muted-foreground">Plan your grind</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>

        <Link
          href="/trip"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <MapPin className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Trip Planner</div>
            <div className="text-xs text-muted-foreground">Manage your trip</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trip Status Card
// ---------------------------------------------------------------------------

function TripStatusCard({
  tripState,
  tripStart,
  tripEnd,
}: {
  tripState: 'none' | 'upcoming' | 'in_progress' | 'completed'
  tripStart: string | null
  tripEnd: string | null
}) {
  if (tripState === 'none') {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Plane className="size-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Set Up Your Trip</h2>
              <p className="text-sm text-muted-foreground">
                Configure your trip dates and budget to get started.
              </p>
            </div>
            <Link
              href="/settings"
              className="flex items-center gap-1 text-sm text-primary hover:underline font-medium shrink-0"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tripState === 'upcoming' && tripStart && tripEnd) {
    const daysUntil = getDaysUntil(tripStart)
    const countdownText = daysUntil === 1 ? 'Tomorrow!' : `${daysUntil} days to go`
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Plane className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{countdownText}</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(tripStart)} &ndash; {formatDate(tripEnd)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tripState === 'in_progress' && tripStart && tripEnd) {
    const dayOfTrip = getDayOfTrip(tripStart)
    const totalDays = getTripLength(tripStart, tripEnd)
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <MapPin className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Day {dayOfTrip} of {totalDays}
              </h2>
              <p className="text-sm text-muted-foreground">
                Your Vegas trip is underway!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // completed
  if (tripStart && tripEnd) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="size-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Trip Complete</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(tripStart)} &ndash; {formatDate(tripEnd)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Today's Schedule Card
// ---------------------------------------------------------------------------

function TodayScheduleCard({
  entries,
  today,
}: {
  entries: ReturnType<typeof useSchedule>['entries']
  today: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Today&apos;s Schedule
          </CardTitle>
          <Link href="/schedule" className="text-xs text-primary hover:underline">
            Full schedule &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No tournaments scheduled today</p>
            <Link
              href="/browse"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Browse upcoming events
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const t = entry.tournament
              if (!t) return null
              const seriesName = t.series?.name ?? ''
              const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
              return (
                <Link
                  key={entry.id}
                  href={`/tournament/${t.slug ?? t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatTime(t.start_time)}</span>
                      <span>&middot;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatBuyIn(t.buy_in)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${colors.bg} ${colors.text} border-0`}
                  >
                    {colors.label}
                  </Badge>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// This Week's Schedule Card
// ---------------------------------------------------------------------------

function WeekScheduleCard({
  entries,
}: {
  entries: ReturnType<typeof useSchedule>['entries']
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            This Week&apos;s Schedule
          </CardTitle>
          <Link href="/schedule" className="text-xs text-primary hover:underline">
            Trip Planner &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No tournaments this week</p>
            <Link
              href="/browse"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Browse upcoming events
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const t = entry.tournament
              if (!t) return null
              const seriesName = t.series?.name ?? ''
              const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
              return (
                <Link
                  key={entry.id}
                  href={`/tournament/${t.slug ?? t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatDate(t.date)}</span>
                      <span>&middot;</span>
                      <span>{formatTime(t.start_time)}</span>
                      <span>&middot;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatBuyIn(t.buy_in)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${colors.bg} ${colors.text} border-0`}
                  >
                    {colors.label}
                  </Badge>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
