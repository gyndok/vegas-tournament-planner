import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // Look up the user by share token
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('user_id, share_enabled, trip_start, trip_end')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  if (prefsError || !prefs) {
    return NextResponse.json(
      { error: 'Schedule not found or sharing is disabled' },
      { status: 404 }
    )
  }

  // Fetch the user's schedule entries (without notes)
  const { data: entries, error: entriesError } = await supabase
    .from('user_schedule')
    .select('id, user_id, tournament_id, entry_number, priority, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', prefs.user_id)
    .order('created_at', { ascending: true })

  if (entriesError) {
    return NextResponse.json(
      { error: 'Failed to load schedule' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    entries: entries ?? [],
    tripDates: {
      from: prefs.trip_start,
      to: prefs.trip_end,
    },
  })
}
