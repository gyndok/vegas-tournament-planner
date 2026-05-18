import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canTransition, writeAuditLog } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pool } = await supabase.from('pools').select('status, organizer_id').eq('id', id).maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pool.organizer_id !== user.id) return NextResponse.json({ error: 'Not organizer' }, { status: 403 })
  if (!canTransition(pool.status, 'locked')) {
    return NextResponse.json({ error: `Cannot lock from status ${pool.status}` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('pools')
    .update({ status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(createServiceClient(), {
    pool_id: id, actor_id: user.id, action: 'pool_locked',
  })
  return NextResponse.json(data)
}
