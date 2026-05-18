import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPoolWinnerEmail } from '@/lib/email'
import { canTransition, writeAuditLog, gatherPoolMemberEmails, resolveDisplayName } from '@/lib/pool-utils'

interface Body { member_id: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'ended')) {
    return NextResponse.json({ error: `Cannot declare winner from status ${pool.status}` }, { status: 409 })
  }

  // Confirm the member belongs to this pool.
  const { data: member } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', id)
    .eq('id', body.member_id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not in this pool' }, { status: 400 })

  const { data, error } = await supabase
    .from('pools')
    .update({
      status: 'ended',
      winner_member_id: body.member_id,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: body.member_id, actor_id: user.id, action: 'winner_declared',
  })

  // Send winner notification email (best-effort).
  const svc = createServiceClient()
  const emails = await gatherPoolMemberEmails(svc, id)
  let winnerName = 'A pool member'
  const { data: winnerMember } = await svc
    .from('pool_members')
    .select('display_name, user_id')
    .eq('id', body.member_id)
    .single()
  if (winnerMember) {
    if (winnerMember.user_id) {
      const { data: u } = await svc.auth.admin.getUserById(winnerMember.user_id)
      winnerName = resolveDisplayName(winnerMember, u?.user ? {
        email: u.user.email ?? null,
        raw_user_meta_data: (u.user.user_metadata as Record<string, unknown>) ?? null,
      } : null)
    } else {
      winnerName = winnerMember.display_name ?? 'Former player'
    }
  }
  if (emails.length > 0) {
    await sendPoolWinnerEmail({
      toEmails: emails,
      poolName: data.name,
      winnerDisplayName: winnerName,
    }).catch(e => console.error('[pools] winner email failed', e))
  }

  return NextResponse.json(data)
}
