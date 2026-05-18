import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatBuyIn, formatTime, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Trophy, ArrowRight, Sparkles } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { SITE_URL } from '@/lib/seo'

// ISR: the WSOP schedule changes infrequently after publication; once a day
// is plenty fresh for an SEO page and lets us keep build times short.
export const revalidate = 3600

const WSOP_SERIES_ID = 'a0000000-0000-0000-0000-000000000001'

export const metadata: Metadata = {
  title: '2026 WSOP Schedule — Every Event, Buy-in, and Date',
  description:
    'The complete 2026 World Series of Poker schedule at the Horseshoe and Paris Las Vegas, May 26 – July 15. Every bracelet event and side event with buy-in, date, and structure. Build your WSOP schedule, track your bankroll, and run Last Longer Pools with your crew — free.',
  alternates: { canonical: '/guides/wsop-2026' },
  openGraph: {
    title: '2026 WSOP Schedule — Every Event, Buy-in, and Date',
    description:
      'Complete 2026 World Series of Poker schedule. Every bracelet event and side event with buy-in, date, and structure.',
    url: '/guides/wsop-2026',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: '2026 WSOP Schedule — Every Event, Buy-in, and Date',
    description:
      'Complete 2026 WSOP schedule with every event, buy-in, and date.',
  },
}

interface TournamentRow {
  id: string
  slug: string
  name: string
  event_number: number | null
  date: string
  start_time: string
  buy_in: number | null
  game_type: string | null
  format: string | null
  guaranteed_prize: number | null
  event_category: 'bracelet' | 'side' | null
  starting_stack: number | null
  blind_levels_minutes: number | null
}

function groupByWeek(rows: TournamentRow[]): Map<string, TournamentRow[]> {
  const map = new Map<string, TournamentRow[]>()
  for (const r of rows) {
    const d = new Date(`${r.date}T00:00:00`)
    // Use ISO week-of-year-ish: just bucket by Monday of that week
    const day = d.getUTCDay() // 0..6, 0=Sun
    const offset = (day + 6) % 7 // days since Monday
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() - offset)
    const key = monday.toISOString().slice(0, 10)
    const arr = map.get(key) ?? []
    arr.push(r)
    map.set(key, arr)
  }
  return map
}

function formatWeekLabel(mondayIso: string): string {
  const start = new Date(`${mondayIso}T00:00:00`)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default async function WSOP2026Page() {
  const svc = createAdminClient()
  const { data: tournaments } = await svc
    .from('tournaments')
    .select(
      'id, slug, name, event_number, date, start_time, buy_in, game_type, format, guaranteed_prize, event_category, starting_stack, blind_levels_minutes'
    )
    .eq('series_id', WSOP_SERIES_ID)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  const rows = (tournaments ?? []) as TournamentRow[]
  const bracelet = rows.filter((r) => r.event_category === 'bracelet')
  const side = rows.filter((r) => r.event_category !== 'bracelet')

  const totalGtd = bracelet.reduce((s, r) => s + Number(r.guaranteed_prize ?? 0), 0)
  const minBuy = rows.filter((r) => r.buy_in != null).reduce(
    (m, r) => Math.min(m, r.buy_in!),
    Infinity
  )
  const maxBuy = rows.reduce((m, r) => Math.max(m, r.buy_in ?? 0), 0)

  const braceletByWeek = groupByWeek(bracelet)
  const sortedWeeks = Array.from(braceletByWeek.keys()).sort()

  // JSON-LD ItemList for the bracelet schedule. Helps Google understand the
  // page as a structured list of related events.
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '2026 WSOP Bracelet Events',
    itemListElement: bracelet.slice(0, 100).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/tournament/${t.slug}`,
      name: t.name,
    })),
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-8 space-y-10">
      <JsonLd data={itemListLd} />

      {/* Hero */}
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-500">
          <Trophy className="size-3.5" />
          Definitive Guide
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          The 2026 WSOP Schedule
        </h1>
        <p className="text-lg text-muted-foreground">
          The complete 2026 World Series of Poker schedule, May 26 – July 15 at
          the Horseshoe and Paris Las Vegas. Every bracelet event and side event
          with buy-in, date, and structure. Free to browse, plan, and share —
          NextRebuy doesn&apos;t take a cut.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/browse">
              Build Your WSOP Schedule
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/faq#last-longer-pools">Run a Last Longer Pool</Link>
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Bracelet events</div>
            <div className="text-2xl font-bold mt-1">{bracelet.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Side events</div>
            <div className="text-2xl font-bold mt-1">{side.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Buy-in range</div>
            <div className="text-2xl font-bold mt-1">
              {minBuy === Infinity ? '—' : formatBuyIn(minBuy)}
              <span className="text-muted-foreground"> – </span>
              {formatBuyIn(maxBuy)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total GTD</div>
            <div className="text-2xl font-bold mt-1">
              {totalGtd > 0 ? formatBuyIn(totalGtd) : '—'}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick context */}
      <section className="prose prose-sm dark:prose-invert max-w-none">
        <h2 className="text-xl font-bold tracking-tight">What to know about WSOP 2026</h2>
        <p className="text-muted-foreground">
          The 2026 World Series of Poker runs at the Horseshoe and Paris Las
          Vegas, with bracelet events spanning 51 days from late May through
          mid-July. The schedule covers everything from the $400 Colossus to
          the $250k Super High Roller, plus daily side events, satellites, and
          mixed-game series for specialty players. The Main Event traditionally
          starts in early July with multiple Day 1 flights.
        </p>
        <p className="text-muted-foreground mt-3">
          NextRebuy keeps the entire schedule searchable and lets you build a
          personal day-by-day itinerary, log results in real time, and run{' '}
          <Link href="/faq#last-longer-pools" className="text-primary hover:underline">
            Last Longer Pools
          </Link>{' '}
          with your travel crew. Every event below links to a detail page with
          structure (starting stack, blind levels, late reg) and a one-click
          add to your schedule.
        </p>
      </section>

      {/* Bracelet events by week */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          <h2 className="text-2xl font-bold tracking-tight">Bracelet events</h2>
        </div>
        {sortedWeeks.length === 0 ? (
          <p className="text-muted-foreground">Schedule is being loaded.</p>
        ) : (
          sortedWeeks.map((weekIso) => {
            const events = braceletByWeek.get(weekIso) ?? []
            return (
              <div key={weekIso} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                  Week of {formatWeekLabel(weekIso)}
                </h3>
                <ul className="space-y-2">
                  {events.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 hover:bg-accent/50 transition-colors"
                    >
                      <Link
                        href={`/tournament/${t.slug}`}
                        className="flex-1 min-w-0 flex items-center gap-3"
                      >
                        <Badge variant="outline" className="shrink-0 font-mono text-xs">
                          {t.event_number ? `#${t.event_number}` : '—'}
                        </Badge>
                        <span className="text-sm font-medium truncate group-hover:text-primary">
                          {t.name}
                        </span>
                      </Link>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatDate(t.date)}
                        </span>
                        <span className="hidden sm:inline">{formatTime(t.start_time)}</span>
                        <span className="font-mono font-semibold text-amber-500">
                          {t.buy_in != null ? formatBuyIn(t.buy_in) : 'TBD'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </section>

      {/* Side events teaser */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">
            Side events ({side.length})
          </h2>
        </div>
        <p className="text-muted-foreground">
          The WSOP runs hundreds of side events alongside the bracelet schedule
          — deepstacks, mystery bounties, daily megasatellites, and mixed-game
          tournaments. Browse and filter them all on NextRebuy.
        </p>
        <Button asChild variant="outline">
          <Link href="/browse?series=2026+World+Series+of+Poker">
            See all WSOP side events
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      {/* Last Longer Pools promo */}
      <section>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="size-3.5" />
              New
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Heading to the WSOP with a crew? Run a Last Longer Pool.
            </h2>
            <p className="text-muted-foreground">
              Create a private pool for any WSOP event, share an invite link
              with your group, and we&apos;ll keep a live leaderboard of who&apos;s
              still alive. Money stays between you — NextRebuy never collects or
              pays out anything.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login">
                  Sign in to create
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/faq#last-longer-pools">How it works</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer link */}
      <section className="pt-2">
        <p className="text-xs text-muted-foreground text-center">
          Schedule sourced from official WSOP releases and updated continuously.
          See an error?{' '}
          <Link href="/feedback" className="text-primary hover:underline">
            Let us know
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
