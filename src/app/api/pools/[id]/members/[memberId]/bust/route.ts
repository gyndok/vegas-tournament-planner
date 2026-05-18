import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/pool-utils'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('organizer_id, status').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  if (pool.status === 'ended' || pool.status === 'cancelled') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 409 })
  }

  const { data: member } = await supabase
    .from('pool_members')
    .select('user_id, status')
    .eq('id', memberId)
    .eq('pool_id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status === 'busted') return NextResponse.json({ error: 'Already busted' }, { status: 409 })

  const isSelf = member.user_id === user.id
  const isOrganizer = pool.organizer_id === user.id
  if (!isSelf && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('pool_members')
    .update({ status: 'busted', busted_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: memberId, actor_id: user.id, action: 'busted',
    metadata: { reported_by: isSelf ? 'self' : 'organizer' },
  })
  return NextResponse.json(data)
}
