# Dashboard Polish, SEO Landing Page & Mobile UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an SEO landing page for non-logged-in visitors, polish the logged-in dashboard to be trip-focused, and improve mobile touch targets and spacing.

**Architecture:** The homepage (`/`) becomes a conditional render: landing page for anonymous visitors, trip-focused dashboard for authenticated users. The landing page is a server component with semantic HTML for SEO. The dashboard becomes a client component that fetches personal data (schedule, results, preferences). Mobile UX changes are CSS-only tweaks across existing components.

**Tech Stack:** Next.js App Router, Supabase Auth, React, Tailwind CSS, shadcn/ui, Lucide icons

---

### Task 1: Create Landing Page Component

**Files:**
- Create: `src/components/landing-page.tsx`

**Step 1: Create the landing page component**

```tsx
import Link from 'next/link'
import { Calendar, Search, TrendingUp, MessageSquare, ArrowRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LandingPageProps {
  tournamentCount: number
  seriesCount: number
}

export function LandingPage({ tournamentCount, seriesCount }: LandingPageProps) {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <section className="text-center px-4 pt-8 md:pt-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Plan Your Vegas <span className="text-primary">Poker Trip</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Browse every tournament across WSOP, Wynn, Venetian, and more.
          Build your schedule, track your bankroll, and get AI-powered recommendations — all free.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">Get Started Free</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/browse">Browse Tournaments</Link>
          </Button>
        </div>
      </section>

      {/* Live Stats Bar */}
      <section className="flex justify-center gap-8 md:gap-16 px-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{tournamentCount.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Tournaments</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{seriesCount}</div>
          <div className="text-sm text-muted-foreground">Active Series</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">Free</div>
          <div className="text-sm text-muted-foreground">Always</div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="px-4 md:px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Everything You Need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Search, title: 'Browse Tournaments', desc: 'Filter by buy-in, game type, casino, date, and more across every Vegas series.' },
            { icon: Calendar, title: 'Build Your Schedule', desc: 'Add tournaments to your personal schedule with priorities, notes, and .ics export.' },
            { icon: TrendingUp, title: 'Track Results', desc: 'Log cash-outs, track profit/loss, and see your ROI across the entire trip.' },
            { icon: MessageSquare, title: 'AI Advisor', desc: 'Ask questions like "best $500 NLH this week" and get instant recommendations.' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 md:px-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Browse', desc: 'Explore tournaments across all major Vegas poker series.' },
            { step: '2', title: 'Schedule', desc: 'Add your picks to a personal schedule with priorities.' },
            { step: '3', title: 'Play', desc: 'Track results and manage your trip from one dashboard.' },
          ].map((item) => (
            <div key={item.step} className="text-center space-y-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg mx-auto">
                {item.step}
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center px-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 max-w-2xl mx-auto">
          <Zap className="size-8 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Ready to Plan Your Grind?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Join NextRebuy and start building your perfect Vegas tournament schedule.
          </p>
          <Button asChild size="lg">
            <Link href="/login">
              Get Started Free <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/landing-page.tsx
git commit -m "feat: add SEO landing page component"
```

---

### Task 2: Create Trip-Focused Dashboard Component

**Files:**
- Create: `src/components/dashboard-authenticated.tsx`

**Step 1: Create the authenticated dashboard component**

This is a client component that fetches user's schedule, preferences, and results to show a trip-focused dashboard.

```tsx
'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { useResults } from '@/hooks/use-results'
import { usePreferences } from '@/hooks/use-preferences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdUnit } from '@/components/ad-unit'
import {
  Calendar, Plane, DollarSign, TrendingUp, Search,
  MessageSquare, MapPin, ArrowRight, Settings
} from 'lucide-react'
import { formatDate, formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'

function getTodayStr() {
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  return pt.toISOString().split('T')[0]
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  pt.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - pt.getTime()) / (1000 * 60 * 60 * 24))
}

function getDayOfTrip(startStr: string): number {
  const start = new Date(startStr + 'T00:00:00')
  const now = new Date()
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  pt.setHours(0, 0, 0, 0)
  return Math.floor((pt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function getTripLength(startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function DashboardAuthenticated() {
  const { loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading } = useSchedule()
  const { results, loading: resultsLoading } = useResults()
  const { preferences, loading: prefsLoading } = usePreferences()

  const loading = userLoading || scheduleLoading || resultsLoading || prefsLoading

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  const today = getTodayStr()
  const hasTrip = preferences?.trip_start && preferences?.trip_end
  const tripStart = preferences?.trip_start ?? ''
  const tripEnd = preferences?.trip_end ?? ''
  const tripBudget = preferences?.trip_budget ?? 0

  // Trip status
  const daysUntil = hasTrip ? getDaysUntil(tripStart) : 0
  const tripInProgress = hasTrip && daysUntil <= 0 && getDaysUntil(tripEnd) >= 0
  const tripCompleted = hasTrip && getDaysUntil(tripEnd) < 0
  const dayOfTrip = tripInProgress ? getDayOfTrip(tripStart) : 0
  const tripLength = hasTrip ? getTripLength(tripStart, tripEnd) : 0

  // Today's scheduled entries
  const todaysEntries = entries.filter((e) => e.tournament?.date === today)

  // This week's entries (next 7 days)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  const weekEntries = entries
    .filter((e) => e.tournament && e.tournament.date >= today && e.tournament.date <= weekEndStr)
    .sort((a, b) => {
      const dateA = a.tournament?.date ?? ''
      const dateB = b.tournament?.date ?? ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      const timeA = a.tournament?.start_time ?? ''
      const timeB = b.tournament?.start_time ?? ''
      return timeA.localeCompare(timeB)
    })

  // Stats
  const totalBuyIns = entries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0)
  const budgetRemaining = tripBudget ? tripBudget - totalBuyIns : null
  const totalCashOut = results.reduce((sum, r) => sum + r.result_amount, 0)
  const playedBuyIns = results.reduce((sum, r) => {
    const entry = entries.find((e) => e.id === r.schedule_entry_id)
    return sum + (entry?.tournament?.buy_in ?? 0)
  }, 0)
  const netPL = totalCashOut - playedBuyIns

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your trip at a glance</p>
      </div>

      {/* Trip Countdown / Status */}
      {!hasTrip ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Plane className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Set Up Your Trip</h2>
              <p className="text-sm text-muted-foreground">
                Add your arrival and departure dates to unlock the full dashboard.
              </p>
            </div>
            <Link
              href="/settings"
              className="shrink-0 inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Settings className="size-4" /> Settings
            </Link>
          </CardContent>
        </Card>
      ) : tripCompleted ? (
        <Card className="bg-muted/50">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Trip Complete</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(tripStart)} – {formatDate(tripEnd)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : tripInProgress ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/20">
              <MapPin className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-primary">
                Day {dayOfTrip} of {tripLength}
              </h2>
              <p className="text-sm text-muted-foreground">
                Your Vegas trip is underway!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Plane className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">
                {daysUntil === 1 ? 'Tomorrow!' : `${daysUntil} days to go`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(tripStart)} – {formatDate(tripEnd)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Today&apos;s Schedule
            </CardTitle>
            <Link href="/schedule" className="text-xs text-primary hover:underline">
              Full schedule →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todaysEntries.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No tournaments scheduled today</p>
              <Link href="/browse" className="text-xs text-primary hover:underline mt-1 inline-block">
                Browse upcoming events
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysEntries.map((entry) => {
                const t = entry.tournament
                if (!t) return null
                const colors = getSeriesColor(t.series?.name ?? '', t.series?.venue, t.name)
                return (
                  <Link
                    key={entry.id}
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
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${colors.bg} ${colors.text} border-0`}>
                      {colors.label}
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-4 text-muted-foreground mx-auto mb-1" />
            <div className={`text-xl font-bold ${budgetRemaining !== null && budgetRemaining < 0 ? 'text-red-500' : 'text-foreground'}`}>
              {budgetRemaining !== null ? `$${Math.abs(budgetRemaining).toLocaleString()}` : '--'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {budgetRemaining !== null && budgetRemaining < 0 ? 'Over budget' : 'Budget left'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="size-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-xl font-bold">{entries.length}</div>
            <div className="text-[10px] text-muted-foreground">Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="size-4 text-muted-foreground mx-auto mb-1" />
            <div className={`text-xl font-bold ${results.length > 0 ? (netPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-foreground'}`}>
              {results.length > 0 ? `${netPL >= 0 ? '+' : '-'}$${Math.abs(netPL).toLocaleString()}` : '--'}
            </div>
            <div className="text-[10px] text-muted-foreground">Net P&L</div>
          </CardContent>
        </Card>
      </div>

      {/* Ad unit */}
      <AdUnit slot="DASHBOARD_BANNER_SLOT" size="banner" channel="dashboard" />

      {/* This Week's Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">This Week</CardTitle>
            <Link href="/trip" className="text-xs text-primary hover:underline">
              Trip Planner →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {weekEntries.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No tournaments scheduled this week</p>
              <Link href="/browse" className="text-xs text-primary hover:underline mt-1 inline-block">
                Find tournaments →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {weekEntries.map((entry) => {
                const t = entry.tournament
                if (!t) return null
                const colors = getSeriesColor(t.series?.name ?? '', t.series?.venue, t.name)
                return (
                  <Link
                    key={entry.id}
                    href={`/tournament/${t.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(t.date)} · {formatTime(t.start_time)} · {formatBuyIn(t.buy_in)}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="text-xs text-muted-foreground">Day-by-day itinerary</div>
          </div>
          <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>
    </div>
  )
}
```

Note: This component uses `usePreferences` — check if this hook exists. If not, create a minimal one that fetches from `/api/preferences`. Pattern matches `useSchedule` and `useResults`.

**Step 2: Commit**

```bash
git add src/components/dashboard-authenticated.tsx
git commit -m "feat: add trip-focused authenticated dashboard component"
```

---

### Task 3: Check/Create usePreferences Hook

**Files:**
- Check: `src/hooks/use-preferences.ts`
- If missing, create it following the pattern of `src/hooks/use-results.ts`

**Step 1: Check if hook exists**

```bash
ls src/hooks/use-preferences*
```

If it exists, skip to Task 4. If not:

**Step 2: Create the hook**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'

export interface UserPreferences {
  trip_start: string | null
  trip_end: string | null
  trip_budget: number | null
  buy_in_min: number | null
  buy_in_max: number | null
  preferred_games: string[]
  preferred_formats: string[]
  preferred_start_time_earliest: string | null
  preferred_start_time_latest: string | null
  avoid_turbos: boolean
}

export function usePreferences() {
  const { user } = useUser()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null)
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  return { preferences, loading, refetch: fetchPreferences }
}
```

**Step 3: Commit**

```bash
git add src/hooks/use-preferences.ts
git commit -m "feat: add usePreferences hook"
```

---

### Task 4: Wire Up Conditional Homepage

**Files:**
- Modify: `src/app/page.tsx` — replace entire contents

**Step 1: Rewrite page.tsx to conditionally render landing vs dashboard**

```tsx
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing-page'
import { DashboardAuthenticated } from '@/components/dashboard-authenticated'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return <DashboardAuthenticated />
  }

  // Fetch live stats for landing page
  const { count: tournamentCount } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })

  const { count: seriesCount } = await supabase
    .from('series')
    .select('*', { count: 'exact', head: true })

  return (
    <LandingPage
      tournamentCount={tournamentCount ?? 0}
      seriesCount={seriesCount ?? 0}
    />
  )
}
```

**Step 2: Build and verify**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: conditional homepage — landing page or trip dashboard"
```

---

### Task 5: Update SEO Metadata

**Files:**
- Modify: `src/app/layout.tsx` — update metadata

**Step 1: Improve metadata for SEO**

Update the metadata object to be more keyword-rich:

```tsx
export const metadata: Metadata = {
  title: "NextRebuy — Vegas Poker Tournament Planner",
  description:
    "Plan your Vegas poker trip. Browse WSOP, Wynn, Venetian, and more. Build your schedule, track results, and get AI-powered tournament recommendations — all free.",
  manifest: "/manifest.json",
  openGraph: {
    title: "NextRebuy — Vegas Poker Tournament Planner",
    description: "Plan your Vegas poker trip. Browse tournaments, build your schedule, and track your bankroll.",
    images: [{ url: "/logo.png", width: 1248, height: 832 }],
  },
};
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: improve SEO metadata for landing page"
```

---

### Task 6: Mobile UX — Touch Targets and Spacing

**Files:**
- Modify: `src/components/mobile-bottom-nav.tsx`
- Modify: `src/components/tournament-card.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/dashboard-shell.tsx`

**Step 1: Mobile bottom nav — larger touch targets**

In `mobile-bottom-nav.tsx`, increase the touch area:

Change the link className from:
```
'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]'
```
To:
```
'flex flex-col items-center justify-center gap-1 rounded-lg transition-colors min-w-[64px] min-h-[44px] px-3 py-2'
```

Also change icon size from `size-5` to `size-6` and text from `text-[10px]` to `text-[11px]`.

**Step 2: Tournament card — larger text on mobile**

In `tournament-card.tsx`:

Change title `h3` className from:
```
"font-semibold text-sm leading-snug line-clamp-2"
```
To:
```
"font-semibold text-sm md:text-sm leading-snug line-clamp-2"
```

Change badge text from `text-[10px]` to `text-[11px]`.

Change card padding from `p-4` to `p-4 md:p-4` (no change needed, already good).

**Step 3: Login form — prevent iOS zoom**

In `login/page.tsx`, add `text-base` to both Input components to prevent iOS auto-zoom:

The email input should have className including `text-base md:text-sm`.
The password input should have className including `text-base md:text-sm`.

Wrap these as:
```tsx
<Input ... className="text-base md:text-sm" />
```

**Step 4: Dashboard shell — safe area bottom padding**

In `dashboard-shell.tsx`, change the mobile bottom padding from `pb-20` to `pb-20` and ensure the bottom nav accounts for safe area:

In `mobile-bottom-nav.tsx`, add safe area padding:
```
className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
```

**Step 5: Build and verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/components/mobile-bottom-nav.tsx src/components/tournament-card.tsx src/app/login/page.tsx src/components/dashboard-shell.tsx
git commit -m "fix: improve mobile touch targets, spacing, and iOS zoom prevention"
```

---

### Task 7: Build, Push, and Deploy

**Step 1: Final build**

```bash
npm run build
```

Expected: Clean build.

**Step 2: Push and deploy**

```bash
git push origin main
vercel --prod
```

**Step 3: Verify deployment**

Visit https://nextrebuy.com in an incognito window — should see the landing page.
Sign in — should see the trip-focused dashboard.

---

## Summary of Files

| Action | File |
|--------|------|
| Create | `src/components/landing-page.tsx` |
| Create | `src/components/dashboard-authenticated.tsx` |
| Create (if missing) | `src/hooks/use-preferences.ts` |
| Modify | `src/app/page.tsx` |
| Modify | `src/app/layout.tsx` (metadata only) |
| Modify | `src/components/mobile-bottom-nav.tsx` |
| Modify | `src/components/tournament-card.tsx` |
| Modify | `src/app/login/page.tsx` |
| Modify | `src/components/dashboard-shell.tsx` |
