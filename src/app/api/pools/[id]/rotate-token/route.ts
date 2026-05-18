import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken } from '@/lib/pool-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pools')
    .update({ invite_token: generateInviteToken(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organizer_id', user.id)
    .select('invite_token')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found or not organizer' }, { status: 404 })
  return NextResponse.json({ invite_token: data.invite_token })
}
