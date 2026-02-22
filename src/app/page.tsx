import Link from "next/link"
import { Search, MessageSquare, Calendar } from "lucide-react"

function getTodayStr() {
  const d = new Date()
  return d.toISOString().split("T")[0]
}

function getWeekEndStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split("T")[0]
}

export default function Home() {
  const today = getTodayStr()
  const weekEnd = getWeekEndStr()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-12 text-center md:pt-32 md:pb-20">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          Vegas Tournament
          <span className="block text-primary"> Planner</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          AI-powered tournament scheduling for Las Vegas poker festivals.
          Find your next game, plan your week, maximize your time.
        </p>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/browse?dateFrom=${today}&dateTo=${today}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Calendar className="h-4 w-4" />
            Today&apos;s Tournaments
          </Link>
          <Link
            href={`/browse?dateFrom=${today}&dateTo=${weekEnd}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            This Week
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Browse All
          </Link>
        </div>
      </section>

      {/* Active Series */}
      <section className="mx-auto max-w-2xl px-4 pb-12">
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Active Series</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-500">
                WSOP
              </span>
              <h3 className="mt-2 text-xl font-bold">2026 World Series of Poker</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Horseshoe &amp; Paris Las Vegas
              </p>
              <p className="text-sm text-muted-foreground">May 26 – Jul 15, 2026</p>
              <p className="mt-2 text-sm font-medium text-primary">100 bracelet events</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Chat CTA */}
      <section className="mx-auto max-w-2xl px-4 pb-20">
        <Link
          href="/chat"
          className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-6 transition-colors hover:bg-primary/10"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Plan with AI</h3>
            <p className="text-sm text-muted-foreground">
              Ask our AI planner to build your perfect tournament schedule.
              &ldquo;Plan my week — NLH and PLO, under $1,500.&rdquo;
            </p>
          </div>
        </Link>
      </section>
    </div>
  )
}
