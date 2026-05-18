import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppPromoBanner } from '@/components/app-promo-banner'
import { FeaturedSeriesGrid } from '@/components/featured-series-grid'
import {
  Search,
  Calendar,
  TrendingUp,
  MessageSquare,
  Zap,
  ArrowRight,
  Trophy,
  Users,
  Link as LinkIcon,
  DollarSign,
  Sparkles,
} from 'lucide-react'

interface LandingPageProps {
  tournamentCount: number
  seriesCount: number
}

const features = [
  {
    icon: Search,
    title: 'Browse Tournaments',
    description:
      'Search and filter thousands of upcoming poker tournaments across every major Las Vegas venue.',
  },
  {
    icon: Calendar,
    title: 'Build Your Schedule',
    description:
      'Drag, drop, and organize your ideal tournament lineup into a personal calendar.',
  },
  {
    icon: TrendingUp,
    title: 'Track Results',
    description:
      'Log buy-ins, cashes, and ROI to see how your trip is shaping up in real time.',
  },
  {
    icon: MessageSquare,
    title: 'AI Advisor',
    description:
      'Get personalized recommendations on which events fit your bankroll and play style.',
  },
  {
    icon: Trophy,
    title: 'Last Longer Pools',
    description:
      'Run side bets with your crew. We keep the live leaderboard — money stays between you.',
  },
]

const steps = [
  { number: 1, label: 'Browse', description: 'Explore upcoming events' },
  { number: 2, label: 'Schedule', description: 'Build your personal lineup' },
  { number: 3, label: 'Play', description: 'Hit the felt prepared' },
]

export function LandingPage({ tournamentCount, seriesCount }: LandingPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-20">
      {/* ── Hero ── */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Plan Your Vegas{' '}
          <span className="text-primary">Poker Trip</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Browse WSOP, Wynn, Venetian, and every major series in one place.
          Build your schedule, track results, and run Last Longer Pools with
          your crew — all free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Get Started Free</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/browse">Browse Tournaments</Link>
          </Button>
        </div>
      </section>

      {/* ── Live Stats Bar ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold">{tournamentCount.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">Tournaments</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold">{seriesCount}</p>
          <p className="text-sm text-muted-foreground mt-1">Active Series</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold">Free</p>
          <p className="text-sm text-muted-foreground mt-1">Always</p>
        </div>
      </section>

      {/* ── Featured Summer Series ── */}
      <FeaturedSeriesGrid />

      {/* ── Last Longer Pools promo ── */}
      <section>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
          <CardContent className="grid md:grid-cols-2 gap-8 p-6 md:p-8 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="size-3.5" />
                New
              </div>
              <h2 className="text-3xl font-bold tracking-tight">
                Last Longer Pools
              </h2>
              <p className="text-muted-foreground">
                Side bets with your crew, organized in one place. Create a pool
                for any tournament, share an invite link, and we&apos;ll keep
                the live leaderboard updated as players bust out. NextRebuy
                never touches money — the organizer collects buy-ins and pays
                out the winner outside the app.
              </p>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2.5">
                  <LinkIcon className="size-4 mt-0.5 shrink-0 text-primary" />
                  <span>Invite by link — joiners click, sign in, and they&apos;re in</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Users className="size-4 mt-0.5 shrink-0 text-primary" />
                  <span>Live leaderboard with chip counts and bust order, private to your group</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <DollarSign className="size-4 mt-0.5 shrink-0 text-primary" />
                  <span>Zero money handling — organizer settles buy-ins and payouts off-platform</span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <Link href="/login">
                    Sign in to create
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/faq#last-longer-pools">How it works</Link>
                </Button>
              </div>
            </div>

            {/* Mock leaderboard preview */}
            <div className="hidden md:block">
              <div className="rounded-xl border border-border bg-background/80 backdrop-blur p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <p className="text-sm font-semibold">Crew @ Aria $1k</p>
                    <p className="text-xs text-muted-foreground">4 of 6 alive · Day 1</p>
                  </div>
                  <Trophy className="size-4 text-primary" />
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">1</span>
                      <span>Alice</span>
                    </span>
                    <span className="font-mono text-xs">145,000</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">2</span>
                      <span>Bob</span>
                    </span>
                    <span className="font-mono text-xs">98,500</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">3</span>
                      <span>Carol</span>
                    </span>
                    <span className="font-mono text-xs">42,000</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">4</span>
                      <span>You</span>
                    </span>
                    <span className="font-mono text-xs">22,500</span>
                  </li>
                  <li className="flex items-center justify-between text-muted-foreground line-through">
                    <span className="flex items-center gap-2">
                      <span className="text-xs w-4">—</span>
                      <span>Eve</span>
                    </span>
                    <span className="text-xs">out #2</span>
                  </li>
                  <li className="flex items-center justify-between text-muted-foreground line-through">
                    <span className="flex items-center gap-2">
                      <span className="text-xs w-4">—</span>
                      <span>Frank</span>
                    </span>
                    <span className="text-xs">out #1</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Feature Cards ── */}
      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          Everything You Need
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border bg-card">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          How It Works
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center gap-8 sm:gap-16">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                  {step.number}
                </div>
                <div>
                  <p className="font-semibold">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="hidden sm:block size-5 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── App Promo ── */}
      <section>
        <AppPromoBanner variant="inline" />
      </section>

      {/* ── Final CTA ── */}
      <section>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center text-center gap-4 p-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Zap className="size-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to Plan Your Grind?
            </h2>
            <p className="text-muted-foreground max-w-lg">
              Join thousands of players who use NextRebuy to build the perfect
              Vegas tournament schedule.
            </p>
            <Button asChild size="lg">
              <Link href="/login">
                Get Started Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
