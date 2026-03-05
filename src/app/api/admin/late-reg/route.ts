import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails) return false
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const missingOnly = searchParams.get('missing') === 'true'
  const seriesId = searchParams.get('series_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = supabase
    .from('tournaments')
    .select('id, name, date, start_time, buy_in, game_type, starting_stack, blind_levels_minutes, late_reg_levels, late_reg_end_time, series:series_id(id, name, venue)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (missingOnly) {
    query = query.is('late_reg_levels', null)
  }
  if (seriesId) {
    query = query.eq('series_id', seriesId)
  }
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Array<{
    id: string
    blind_levels_minutes?: number | null
    late_reg_levels?: number | null
    late_reg_end_time?: string | null
    starting_stack?: number | null
  }> = body.updates

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  let successCount = 0
  const errors: string[] = []

  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase
      .from('tournaments')
      .update(fields)
      .eq('id', id)

    if (error) {
      errors.push(`${id}: ${error.message}`)
    } else {
      successCount++
    }
  }

  return NextResponse.json({ updated: successCount, errors })
}
