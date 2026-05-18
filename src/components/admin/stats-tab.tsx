'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DayBucket {
  date: string
  count: number
}

interface VenueAdds {
  venue: string
  adds: number
}

interface StatsResponse {
  generatedAt: string
  users: {
    total: number
    new7d: number
    new30d: number
    new90d: number
    dau: number
    wau: number
    mau: number
    signupsByDay: DayBucket[]
  }
  pools: {
    total: number
    byStatus: Record<string, number>
    new7d: number
    new30d: number
    avgMembers: number
    completionRate: number | null
    flaggedStrikes: number
    poolsByDay: DayBucket[]
  }
  engagement: {
    scheduleAdds: number
    customTournaments: number
    resultsLogged: number
    favorites: number
    netProfitLoggedUsd: number
    activeUsers7d: number
  }
  content: {
    totalTournaments: number
    totalSeries: number
    topVenuesByAdds: VenueAdds[]
  }
  ai: {
    today: {
      date: string
      requests: number
      costUsd: number
      capUsd: number
      capRemainingUsd: number
    }
    last30dCostUsd: number
    last30dRequests: number
    cacheHitRate: number | null
  }
  notes: {
    dauCaveat: string
    trafficLink: string
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${formatNumber(Math.abs(n))}`
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        )}
      </CardContent>
    </Card>
  )
}

function MiniBarChart({ data, label }: { data: DayBucket[]; label: string }) {
  const max = Math.max(1, ...data.map(d => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="text-xs text-muted-foreground">
              Last 30 days · {formatNumber(total)} total
            </div>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-20">
          {data.map(d => (
            <div
              key={d.date}
              className="flex-1 bg-primary/70 rounded-sm hover:bg-primary transition-colors"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: '1px' }}
              title={`${d.date}: ${d.count}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{data[0]?.date.slice(5)}</span>
          <span>{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StatsTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setStats(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !stats) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 text-sm">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    )
  }

  if (!stats) return null

  const generated = new Date(stats.generatedAt).toLocaleString()

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Snapshot generated {generated}
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ---- Users ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Users
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total" value={formatNumber(stats.users.total)} />
          <Kpi label="New (7d)" value={formatNumber(stats.users.new7d)} />
          <Kpi label="New (30d)" value={formatNumber(stats.users.new30d)} />
          <Kpi label="New (90d)" value={formatNumber(stats.users.new90d)} />
          <Kpi
            label="DAU"
            value={formatNumber(stats.users.dau)}
            sub="signed in last 24h"
          />
          <Kpi
            label="WAU"
            value={formatNumber(stats.users.wau)}
            sub="signed in last 7d"
          />
          <Kpi
            label="MAU"
            value={formatNumber(stats.users.mau)}
            sub="signed in last 30d"
          />
          <Kpi
            label="Active (7d)"
            value={formatNumber(stats.engagement.activeUsers7d)}
            sub="did something measurable"
          />
        </div>
        <MiniBarChart data={stats.users.signupsByDay} label="Signups / day" />
        <p className="text-xs text-muted-foreground">{stats.notes.dauCaveat}</p>
      </section>

      {/* ---- Pools ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Last Longer Pools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total pools" value={formatNumber(stats.pools.total)} />
          <Kpi label="New (7d)" value={formatNumber(stats.pools.new7d)} />
          <Kpi label="New (30d)" value={formatNumber(stats.pools.new30d)} />
          <Kpi
            label="Avg members"
            value={stats.pools.avgMembers.toFixed(1)}
          />
          <Kpi
            label="Open"
            value={formatNumber(stats.pools.byStatus.open ?? 0)}
            sub="accepting joins"
          />
          <Kpi
            label="Locked"
            value={formatNumber(stats.pools.byStatus.locked ?? 0)}
            sub="no new joins"
          />
          <Kpi
            label="Live"
            value={formatNumber(stats.pools.byStatus.live ?? 0)}
            sub="in progress"
          />
          <Kpi
            label="Ended"
            value={formatNumber(stats.pools.byStatus.ended ?? 0)}
          />
          <Kpi
            label="Cancelled"
            value={formatNumber(stats.pools.byStatus.cancelled ?? 0)}
          />
          <Kpi
            label="Draft"
            value={formatNumber(stats.pools.byStatus.draft ?? 0)}
          />
          <Kpi
            label="Completion rate"
            value={
              stats.pools.completionRate === null
                ? '—'
                : formatPercent(stats.pools.completionRate)
            }
            sub="ended / (ended+cancelled)"
          />
          <Kpi
            label="Strike flags"
            value={formatNumber(stats.pools.flaggedStrikes)}
            sub="pools with strikes > 0"
          />
        </div>
        <MiniBarChart data={stats.pools.poolsByDay} label="Pools created / day" />
      </section>

      {/* ---- Engagement ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Engagement
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi
            label="Schedule adds"
            value={formatNumber(stats.engagement.scheduleAdds)}
          />
          <Kpi
            label="Custom tournaments"
            value={formatNumber(stats.engagement.customTournaments)}
          />
          <Kpi
            label="Results logged"
            value={formatNumber(stats.engagement.resultsLogged)}
          />
          <Kpi
            label="Favorites"
            value={formatNumber(stats.engagement.favorites)}
          />
          <Kpi
            label="Net P&L logged"
            value={formatMoney(stats.engagement.netProfitLoggedUsd)}
            sub="sum across all users"
          />
        </div>
      </section>

      {/* ---- Content ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Content
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi
            label="Tournaments in DB"
            value={formatNumber(stats.content.totalTournaments)}
          />
          <Kpi
            label="Series"
            value={formatNumber(stats.content.totalSeries)}
          />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              Top venues by schedule adds
            </div>
            {stats.content.topVenuesByAdds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schedule data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {stats.content.topVenuesByAdds.map((v) => (
                    <tr key={v.venue} className="border-b last:border-b-0">
                      <td className="py-1.5">{v.venue}</td>
                      <td className="py-1.5 text-right font-mono">
                        {formatNumber(v.adds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ---- AI Advisor usage ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          AI Advisor (Claude)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi
            label="Today"
            value={formatMoney(Math.round(stats.ai.today.costUsd * 100) / 100)}
            sub={`${formatNumber(stats.ai.today.requests)} requests`}
          />
          <Kpi
            label="Daily cap"
            value={formatMoney(stats.ai.today.capUsd)}
            sub={`$${stats.ai.today.capRemainingUsd.toFixed(2)} remaining`}
          />
          <Kpi
            label="Last 30d cost"
            value={formatMoney(Math.round(stats.ai.last30dCostUsd * 100) / 100)}
          />
          <Kpi
            label="Last 30d requests"
            value={formatNumber(stats.ai.last30dRequests)}
          />
          <Kpi
            label="Cache hit rate"
            value={
              stats.ai.cacheHitRate === null
                ? '—'
                : formatPercent(stats.ai.cacheHitRate)
            }
            sub="cached / total prompt tokens (30d)"
          />
        </div>
        {stats.ai.today.costUsd >= stats.ai.today.capUsd && (
          <p className="text-sm text-destructive">
            Daily cap reached. AI Advisor is paused until tomorrow.
          </p>
        )}
      </section>

      {/* ---- Traffic stub ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Traffic
        </h2>
        <Card>
          <CardContent className="p-4 text-sm space-y-2">
            <p>
              Page views, unique visitors, top pages, and referrers are tracked by
              Vercel Analytics, not in our DB.
            </p>
            <a
              href={stats.notes.trafficLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Open Vercel Analytics
              <ExternalLink className="size-3" />
            </a>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
