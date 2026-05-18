import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface PatchBody {
  display_name?: string | null
  current_chips?: number | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const update: Record<string, unknown> = {}
  if (body.display_name !== undefined) {
    update.display_name = body.display_name === null ? null : String(body.display_name).trim().slice(0, 80) || null
  }
  if (body.current_chips !== undefined) {
    if (body.current_chips !== null && (!Number.isFinite(body.current_chips) || body.current_chips < 0)) {
      return NextResponse.json({ error: 'current_chips must be a non-negative number or null' }, { status: 400 })
    }
    update.current_chips = body.current_chips
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('pool_members')
    .update(update)
    .eq('id', memberId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('id, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  // Remove the member.
  const { error: delErr } = await svc.from('pool_members').delete().eq('id', memberId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // If the schedule entry was added by this pool, remove it too.
  if (member.user_id) {
    const { data: poolForTournament } = await svc.from('pools').select('tournament_id').eq('id', id).single()
    if (poolForTournament?.tournament_id) {
      await svc.from('user_schedule')
        .delete()
        .eq('user_id', member.user_id)
        .eq('tournament_id', poolForTournament.tournament_id)
        .eq('source', `pool:${id}`)
    }
  }

  return NextResponse.json({ ok: true })
}
