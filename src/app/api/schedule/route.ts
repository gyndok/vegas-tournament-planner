import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_schedule')
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sort by tournament date and start time
  const sorted = (data ?? []).sort((a, b) => {
    const dateA = a.tournament?.date ?? ''
    const dateB = b.tournament?.date ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    const timeA = a.tournament?.start_time ?? ''
    const timeB = b.tournament?.start_time ?? ''
    return timeA.localeCompare(timeB)
  })

  return NextResponse.json(sorted)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { tournament_id, priority, notes } = body

  if (!tournament_id || !priority) {
    return NextResponse.json(
      { error: 'tournament_id and priority are required' },
      { status: 400 }
    )
  }

  if (!['target', 'backup', 'maybe'].includes(priority)) {
    return NextResponse.json(
      { error: 'priority must be target, backup, or maybe' },
      { status: 400 }
    )
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from('user_schedule')
    .select('id')
    .eq('user_id', user.id)
    .eq('tournament_id', tournament_id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Tournament already in schedule' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('user_schedule')
    .insert({
      user_id: user.id,
      tournament_id,
      priority,
      notes: notes ?? null,
    })
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, priority, notes } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (priority !== undefined) {
    if (!['target', 'backup', 'maybe'].includes(priority)) {
      return NextResponse.json(
        { error: 'priority must be target, backup, or maybe' },
        { status: 400 }
      )
    }
    updates.priority = priority
  }
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('user_schedule')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_schedule')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
