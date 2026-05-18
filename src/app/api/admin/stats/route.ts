/**
 * Admin stats endpoint. Returns site KPIs in one JSON payload for the
 * /admin Stats tab. Service-role queries — auth-gated by ADMIN_EMAILS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'

export const dynamic = 'force-dynamic'

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
  notes: {
    dauCaveat: string
    trafficLink: string
  }
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function buildDayBuckets(timestamps: string[], days: number): DayBucket[] {
  const buckets = new Map<string, number>()
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const ts of timestamps) {
    const key = dateOnly(ts)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createAdminClient()
  const now = new Date()
  const iso7 = daysAgoIso(7)
  const iso30 = daysAgoIso(30)
  const iso90 = daysAgoIso(90)
  const iso1 = daysAgoIso(1)

  // ---------- Users (via auth.admin.listUsers, paginated) ----------
  // listUsers is capped at perPage=1000. We page through to capture the full
  // user set; for a site under ~10k users this is fine.
  const allUsers: { id: string; created_at: string; last_sign_in_at: string | null; email?: string }[] = []
  let page = 1
  while (true) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    for (const u of data.users) {
      allUsers.push({
        id: u.id,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email: u.email ?? undefined,
      })
    }
    if (data.users.length < 1000) break
    page += 1
    if (page > 20) break
  }

  const totalUsers = allUsers.length
  const new7d = allUsers.filter(u => u.created_at >= iso7).length
  const new30d = allUsers.filter(u => u.created_at >= iso30).length
  const new90d = allUsers.filter(u => u.created_at >= iso90).length
  const dau = allUsers.filter(u => u.last_sign_in_at && u.last_sign_in_at >= iso1).length
  const wau = allUsers.filter(u => u.last_sign_in_at && u.last_sign_in_at >= iso7).length
  const mau = allUsers.filter(u => u.last_sign_in_at && u.last_sign_in_at >= iso30).length
  const signupsByDay = buildDayBuckets(allUsers.map(u => u.created_at), 30)

  // ---------- Pools ----------
  const { data: pools } = await svc
    .from('pools')
    .select('id, status, created_at, cancel_strikes')

  const allPools = pools ?? []
  const byStatus: Record<string, number> = {}
  for (const p of allPools) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
  const totalPools = allPools.length
  const poolsNew7d = allPools.filter(p => p.created_at >= iso7).length
  const poolsNew30d = allPools.filter(p => p.created_at >= iso30).length
  const ended = byStatus['ended'] ?? 0
  const cancelled = byStatus['cancelled'] ?? 0
  const terminalTotal = ended + cancelled
  const completionRate = terminalTotal > 0 ? ended / terminalTotal : null
  const flaggedStrikes = allPools.filter(p => (p.cancel_strikes ?? 0) > 0).length
  const poolsByDay = buildDayBuckets(allPools.map(p => p.created_at), 30)

  const { count: totalMembers } = await svc
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
  const avgMembers = totalPools > 0 ? (totalMembers ?? 0) / totalPools : 0

  // ---------- Engagement ----------
  const [
    scheduleCountRes,
    customCountRes,
    resultsCountRes,
    favoritesCountRes,
  ] = await Promise.all([
    svc.from('user_schedule').select('id', { count: 'exact', head: true }),
    svc.from('custom_tournaments').select('id', { count: 'exact', head: true }),
    svc.from('tournament_results').select('id', { count: 'exact', head: true }),
    svc.from('user_favorites').select('id', { count: 'exact', head: true }),
  ])

  // Sum of net P&L across logged results. result_amount is already the signed
  // profit/loss the user entered (cash_out - buy_in computed in the UI).
  const { data: resultsRows } = await svc
    .from('tournament_results')
    .select('result_amount')
  let netProfit = 0
  for (const r of resultsRows ?? []) {
    netProfit += Number(r.result_amount ?? 0)
  }

  // Active users last 7d: union of user_ids that appeared in schedule, results,
  // pool_members, or user_favorites in the last 7 days.
  const sevenAgo = iso7
  const [actSched, actRes, actPool, actFav] = await Promise.all([
    svc.from('user_schedule').select('user_id').gte('created_at', sevenAgo),
    svc.from('tournament_results').select('user_id').gte('created_at', sevenAgo),
    svc.from('pool_members').select('user_id').gte('joined_at', sevenAgo),
    svc.from('user_favorites').select('user_id').gte('created_at', sevenAgo),
  ])
  const active = new Set<string>()
  for (const r of actSched.data ?? []) if (r.user_id) active.add(r.user_id)
  for (const r of actRes.data ?? []) if (r.user_id) active.add(r.user_id)
  for (const r of actPool.data ?? []) if (r.user_id) active.add(r.user_id)
  for (const r of actFav.data ?? []) if (r.user_id) active.add(r.user_id)

  // ---------- Content ----------
  const [tournamentsCountRes, seriesCountRes] = await Promise.all([
    svc.from('tournaments').select('id', { count: 'exact', head: true }),
    svc.from('series').select('id', { count: 'exact', head: true }),
  ])

  // Top venues by scheduled adds — join user_schedule → tournaments → series.
  // Pull all user_schedule rows with their tournament's series.venue, then
  // aggregate in JS.
  const { data: scheduleVenueRows } = await svc
    .from('user_schedule')
    .select('tournament:tournament_id(series:series_id(venue))')

  const venueCounts = new Map<string, number>()
  for (const row of scheduleVenueRows ?? []) {
    const venue =
      (row.tournament as unknown as { series?: { venue?: string } } | null)
        ?.series?.venue
    if (!venue) continue
    venueCounts.set(venue, (venueCounts.get(venue) ?? 0) + 1)
  }
  const topVenuesByAdds: VenueAdds[] = Array.from(venueCounts.entries())
    .map(([venue, adds]) => ({ venue, adds }))
    .sort((a, b) => b.adds - a.adds)
    .slice(0, 10)

  const response: StatsResponse = {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      new7d,
      new30d,
      new90d,
      dau,
      wau,
      mau,
      signupsByDay,
    },
    pools: {
      total: totalPools,
      byStatus,
      new7d: poolsNew7d,
      new30d: poolsNew30d,
      avgMembers,
      completionRate,
      flaggedStrikes,
      poolsByDay,
    },
    engagement: {
      scheduleAdds: scheduleCountRes.count ?? 0,
      customTournaments: customCountRes.count ?? 0,
      resultsLogged: resultsCountRes.count ?? 0,
      favorites: favoritesCountRes.count ?? 0,
      netProfitLoggedUsd: Math.round(netProfit),
      activeUsers7d: active.size,
    },
    content: {
      totalTournaments: tournamentsCountRes.count ?? 0,
      totalSeries: seriesCountRes.count ?? 0,
      topVenuesByAdds,
    },
    notes: {
      dauCaveat:
        'DAU/WAU/MAU is based on auth last_sign_in_at, which only updates on token refresh (~hourly). It is a lower-bound proxy, not a true page-view metric — see Vercel Analytics for traffic.',
      trafficLink: 'https://vercel.com/dashboard',
    },
  }

  return NextResponse.json(response)
}
