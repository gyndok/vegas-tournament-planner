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
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const preferences = {
    user_id: user.id,
    buy_in_min: body.buy_in_min ?? null,
    buy_in_max: body.buy_in_max ?? null,
    preferred_games: body.preferred_games ?? [],
    preferred_formats: body.preferred_formats ?? [],
    preferred_start_time_earliest: body.preferred_start_time_earliest ?? null,
    preferred_start_time_latest: body.preferred_start_time_latest ?? null,
    preferred_table_size: body.preferred_table_size ?? [],
    avoid_turbos: body.avoid_turbos ?? false,
    trip_start: body.trip_start ?? null,
    trip_end: body.trip_end ?? null,
    trip_budget: body.trip_budget ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(preferences, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
