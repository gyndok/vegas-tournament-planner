import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { SharedScheduleView } from '@/components/shared-schedule-view'

interface SharedPageProps {
  params: Promise<{ token: string }>
}

export default async function SharedSchedulePage({ params }: SharedPageProps) {
  const { token } = await params
  const supabase = createServiceClient()

  // Look up user by share token
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('user_id, share_enabled, trip_start, trip_end')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  if (!prefs) {
    notFound()
  }

  // Fetch schedule entries (without notes)
  const { data: entries } = await supabase
    .from('user_schedule')
    .select('id, user_id, tournament_id, priority, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', prefs.user_id)
    .order('created_at', { ascending: true })

  // Strip notes for privacy, add null placeholder to satisfy type
  const sanitized = (entries ?? []).map((e) => ({ ...e, notes: null }))

  return (
    <SharedScheduleView
      entries={sanitized as any}
      tripDates={{ from: prefs.trip_start, to: prefs.trip_end }}
    />
  )
}
