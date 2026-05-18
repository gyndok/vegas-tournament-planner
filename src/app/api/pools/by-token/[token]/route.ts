import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const svc = createServiceClient()
  const { data: pool } = await svc
    .from('pools')
    .select('id, name, pool_type, status, tournament:tournament_id(name, date, venue:series_id(venue)), custom_tournament:custom_tournament_id(name, date)')
    .eq('invite_token', token)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'cancelled' || pool.status === 'ended') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 410 })
  }

  const { count: memberCount } = await svc
    .from('pool_members')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', pool.id)

  return NextResponse.json({
    id: pool.id,
    name: pool.name,
    pool_type: pool.pool_type,
    status: pool.status,
    tournament: pool.tournament,
    custom_tournament: pool.custom_tournament,
    member_count: memberCount ?? 0,
  })
}
