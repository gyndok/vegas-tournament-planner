import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve token → pool (via service role; the route is auth-gated but the
  // pools row may not be readable by RLS yet since the user isn't a member).
  const svc = createServiceClient()
  const { data: pool } = await svc
    .from('pools')
    .select('id, pool_type, tournament_id, custom_tournament_id, status')
    .eq('invite_token', token)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'cancelled' || pool.status === 'ended') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 410 })
  }
  if (pool.status === 'locked' || pool.status === 'live') {
    // Spec: organizer manually locks to prevent late joins. We block at the API.
    return NextResponse.json({ error: 'Pool is locked — no new joins' }, { status: 409 })
  }

  // Insert pool_member (idempotent on (pool_id, user_id) unique).
  const { data: member, error: insErr } = await svc
    .from('pool_members')
    .upsert(
      { pool_id: pool.id, user_id: user.id, status: 'alive' },
      { onConflict: 'pool_id,user_id', ignoreDuplicates: false }
    )
    .select()
    .single()
  if (insErr || !member) {
    return NextResponse.json({ error: insErr?.message ?? 'Join failed' }, { status: 500 })
  }

  // Schedule auto-add (official tournaments only). Idempotent: skip if any row
  // exists. The user_schedule unique key is (user_id, tournament_id, entry_number),
  // not (user_id, tournament_id), so a plain upsert errors out.
  if (pool.pool_type === 'official' && pool.tournament_id) {
    const { data: existing } = await svc.from('user_schedule')
      .select('id')
      .eq('user_id', user.id)
      .eq('tournament_id', pool.tournament_id)
      .maybeSingle()
    if (!existing) {
      await svc.from('user_schedule').insert({
        user_id: user.id,
        tournament_id: pool.tournament_id,
        entry_number: 1,
        priority: 'target',
        source: `pool:${pool.id}`,
      })
    }
  }

  await writeAuditLog(svc, {
    pool_id: pool.id, member_id: member.id, actor_id: user.id, action: 'joined',
  })

  return NextResponse.json({ pool_id: pool.id, member_id: member.id }, { status: 201 })
}
