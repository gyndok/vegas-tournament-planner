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

  const { data: pool } = await supabase.from('pools').select('organizer_id').eq('id', id).maybeSingle()
  if (!pool || pool.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pool_members')
    .update({ status: 'alive', busted_at: null })
    .eq('id', memberId)
    .eq('pool_id', id)
    .select()
    .single()
  if (error || !data) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, member_id: memberId, actor_id: user.id, action: 'unbusted',
  })
  return NextResponse.json(data)
}
