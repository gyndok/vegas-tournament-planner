import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppPromoBanner } from '@/components/app-promo-banner'
import {
  Search,
  Calendar,
  TrendingUp,
  MessageSquare,
  Zap,
  ArrowRight,
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
          Build your schedule, track your results, and hit the felt prepared.
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
