import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pools where I'm a member.
  const { data: memberships } = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('user_id', user.id)
  const poolIds = (memberships ?? []).map(m => m.pool_id)
  if (poolIds.length === 0) return NextResponse.json([])

  const { data: pools } = await supabase
    .from('pools')
    .select('*')
    .in('id', poolIds)
    .order('created_at', { ascending: false })

  // Annotate counts.
  const annotated = await Promise.all((pools ?? []).map(async p => {
    const { count: total } = await supabase
      .from('pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', p.id)
    const { count: alive } = await supabase
      .from('pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', p.id)
      .eq('status', 'alive')
    return { ...p, is_organizer: p.organizer_id === user.id, member_count: total ?? 0, alive_count: alive ?? 0 }
  }))
  return NextResponse.json(annotated)
}
