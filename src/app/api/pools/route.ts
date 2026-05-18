import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateInviteToken, writeAuditLog } from '@/lib/pool-utils'
import type { MultiFlightOutRule, PoolType } from '@/types'

interface CreatePoolBody {
  name: string
  pool_type: PoolType
  tournament_id?: string | null
  custom_tournament_id?: string | null
  reentries_keep_alive?: boolean
  start_after_reentry_period?: boolean
  multiflight_out_rule?: MultiFlightOutRule
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreatePoolBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (body.pool_type !== 'official' && body.pool_type !== 'home_game') {
    return NextResponse.json({ error: 'pool_type must be official or home_game' }, { status: 400 })
  }
  const hasTournament = !!body.tournament_id
  const hasCustom = !!body.custom_tournament_id
  if (hasTournament === hasCustom) {
    return NextResponse.json({ error: 'Supply exactly one of tournament_id or custom_tournament_id' }, { status: 400 })
  }
  if (body.pool_type === 'official' && !hasTournament) {
    return NextResponse.json({ error: 'official pools require tournament_id' }, { status: 400 })
  }
  if (body.pool_type === 'home_game' && !hasCustom) {
    return NextResponse.json({ error: 'home_game pools require custom_tournament_id' }, { status: 400 })
  }

  // Home game ownership check: organizer must own the custom_tournament.
  if (body.pool_type === 'home_game') {
    const { data: ct } = await supabase
      .from('custom_tournaments')
      .select('created_by')
      .eq('id', body.custom_tournament_id!)
      .maybeSingle()
    if (!ct) return NextResponse.json({ error: 'Custom tournament not found' }, { status: 404 })
    if (ct.created_by !== user.id) {
      return NextResponse.json({ error: 'You do not own this home game' }, { status: 403 })
    }
  }

  // Reject continuation rows (Day 2 Restart, $0 buy-in, name pattern).
  if (body.pool_type === 'official') {
    const { data: t } = await supabase
      .from('tournaments')
      .select('buy_in, name')
      .eq('id', body.tournament_id!)
      .maybeSingle()
    if (!t) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    const nameLower = t.name.toLowerCase()
    if (t.buy_in === 0 || nameLower.includes('restart') || nameLower.includes('day 2')) {
      return NextResponse.json({ error: 'Pools must attach to a parent event, not a continuation row' }, { status: 400 })
    }
  }

  const invite_token = generateInviteToken()
  const insertRow = {
    organizer_id: user.id,
    tournament_id: body.tournament_id ?? null,
    custom_tournament_id: body.custom_tournament_id ?? null,
    pool_type: body.pool_type,
    name: body.name.trim().slice(0, 200),
    status: 'open' as const,
    reentries_keep_alive: body.reentries_keep_alive ?? true,
    start_after_reentry_period: body.start_after_reentry_period ?? false,
    multiflight_out_rule: body.multiflight_out_rule ?? 'last_flight',
    invite_token,
  }

  const { data: pool, error } = await supabase
    .from('pools')
    .insert(insertRow)
    .select()
    .single()
  if (error || !pool) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  const svc = createServiceClient()
  await writeAuditLog(svc, {
    pool_id: pool.id,
    actor_id: user.id,
    action: 'joined',
    metadata: { reason: 'pool_created', organizer: true },
  })

  return NextResponse.json(pool, { status: 201 })
}
