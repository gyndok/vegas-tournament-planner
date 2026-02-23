import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatBuyIn, formatTime, formatDate, getSeriesColor } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, MessageSquare, Calendar, TrendingUp, ArrowRight } from 'lucide-react'
import { DashboardScheduleSummary } from '@/components/dashboard-schedule-summary'
import { Tournament, Series } from '@/types'

interface TournamentWithSeries extends Omit<Tournament, 'series'> {
  series: Series | null
}

function getTodayStr() {
  // Use Pacific Time for "today"
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  return pt.toISOString().split('T')[0]
}

function getWeekEndStr() {
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  pt.setDate(pt.getDate() + 7)
  return pt.toISOString().split('T')[0]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = getTodayStr()
  const weekEnd = getWeekEndStr()

  // Fetch today's tournaments
  const { data: todaysTournaments } = await supabase
    .from('tournaments')
    .select('*, series:series_id(*)')
    .eq('date', today)
    .order('start_time', { ascending: true })
    .limit(6)
    .returns<TournamentWithSeries[]>()

  // Fetch this week's tournaments (count by day)
  const { data: weekTournaments } = await supabase
    .from('tournaments')
    .select('id, date, name, start_time, buy_in, series:series_id(name)')
    .gte('date', today)
    .lte('date', weekEnd)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .returns<(Pick<Tournament, 'id' | 'date' | 'name' | 'start_time' | 'buy_in'> & { series: { name: string } | null })[]>()

  // Group week tournaments by day
  const weekByDay = new Map<string, number>()
  for (const t of weekTournaments ?? []) {
    weekByDay.set(t.date, (weekByDay.get(t.date) ?? 0) + 1)
  }

  // Get active series
  const { data: activeSeries } = await supabase
    .from('series')
    .select('*')
    .lte('start_date', weekEnd)
    .gte('end_date', today)
    .order('start_date', { ascending: true })

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your tournament command center
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href={`/browse?dateFrom=${today}&dateTo=${today}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Today&apos;s Events</div>
            <div className="text-xs text-muted-foreground">
              {todaysTournaments?.length ?? 0} tournaments
            </div>
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
          href="/browse"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Browse All</div>
            <div className="text-xs text-muted-foreground">Find tournaments</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

      {/* Main grid: Today's Tournaments + Schedule Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tournaments — takes 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Today&apos;s Tournaments
                </CardTitle>
                <Link
                  href={`/browse?dateFrom=${today}&dateTo=${today}`}
                  className="text-xs text-primary hover:underline"
                >
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(!todaysTournaments || todaysTournaments.length === 0) ? (
                <div className="text-center py-8">
                  <Calendar className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No tournaments today</p>
                  <Link
                    href="/browse"
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    Browse upcoming events
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaysTournaments.map((t) => {
                    const seriesName = t.series?.name ?? ''
                    const colors = getSeriesColor(seriesName)
                    return (
                      <Link
                        key={t.id}
                        href={`/tournament/${t.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                      >
                        <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{formatTime(t.start_time)}</span>
                            <span>·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {formatBuyIn(t.buy_in)}
                            </span>
                            <span>·</span>
                            <span>{t.game_type}</span>
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
        </div>

        {/* Schedule Summary — takes 1 column */}
        <div>
          <DashboardScheduleSummary />
        </div>
      </div>

      {/* This Week + Active Series */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Week */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">This Week</CardTitle>
              <Link
                href={`/browse?dateFrom=${today}&dateTo=${weekEnd}`}
                className="text-xs text-primary hover:underline"
              >
                Browse →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {weekByDay.size === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events this week</p>
            ) : (
              <div className="space-y-2">
                {[...weekByDay.entries()].map(([date, count]) => (
                  <Link
                    key={date}
                    href={`/browse?dateFrom=${date}&dateTo=${date}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <span className="text-sm">{formatDate(date)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {count} event{count !== 1 ? 's' : ''}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Series */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Series</CardTitle>
          </CardHeader>
          <CardContent>
            {(!activeSeries || activeSeries.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active series</p>
            ) : (
              <div className="space-y-3">
                {activeSeries.map((series) => {
                  const colors = getSeriesColor(series.name)
                  return (
                    <div key={series.id} className="flex items-start gap-3">
                      <div className={`size-3 rounded-full shrink-0 mt-1.5 ${colors.dot}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{series.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {series.venue}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(series.start_date)} – {formatDate(series.end_date)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
