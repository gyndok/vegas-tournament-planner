import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { annotateBustOrder, resolveDisplayName } from '@/lib/pool-utils'
import type { PoolDetail, PoolMember } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool, error } = await supabase
    .from('pools')
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue)), custom_tournament:custom_tournament_id(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members, error: memErr } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', id)
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  // Resolve display names via service role (auth.users isn't queryable by anon).
  const svc = createServiceClient()
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]
  const userMap = new Map<string, { email: string | null; raw_user_meta_data: Record<string, unknown> | null }>()
  if (userIds.length > 0) {
    const { data: authUsers } = await svc.auth.admin.listUsers({ perPage: 1000 })
    for (const u of authUsers?.users ?? []) {
      if (userIds.includes(u.id)) {
        userMap.set(u.id, { email: u.email ?? null, raw_user_meta_data: (u.user_metadata as Record<string, unknown>) ?? null })
      }
    }
  }
  const enrichedMembers: PoolMember[] = (members ?? []).map(m => ({
    ...m,
    resolved_display_name: resolveDisplayName(m, m.user_id ? userMap.get(m.user_id) : null),
  }))
  annotateBustOrder(enrichedMembers)

  const detail: PoolDetail = {
    ...pool,
    members: enrichedMembers,
    alive_count: enrichedMembers.filter(m => m.status === 'alive').length,
    total_count: enrichedMembers.length,
    is_organizer: pool.organizer_id === user.id,
  }
  return NextResponse.json(detail)
}

interface PatchBody {
  name?: string
  reentries_keep_alive?: boolean
  start_after_reentry_period?: boolean
  multiflight_out_rule?: 'first_flight' | 'last_flight'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 200)
  if (typeof body.reentries_keep_alive === 'boolean') update.reentries_keep_alive = body.reentries_keep_alive
  if (typeof body.start_after_reentry_period === 'boolean') update.start_after_reentry_period = body.start_after_reentry_period
  if (body.multiflight_out_rule === 'first_flight' || body.multiflight_out_rule === 'last_flight') {
    update.multiflight_out_rule = body.multiflight_out_rule
  }

  const { data, error } = await supabase
    .from('pools')
    .update(update)
    .eq('id', id)
    .eq('organizer_id', user.id)              // belt-and-suspenders even with RLS
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or not organizer' }, { status: 404 })
  return NextResponse.json(data)
}
