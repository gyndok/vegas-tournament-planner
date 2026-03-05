import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'

// ---------------------------------------------------------------------------
// GET — List tournaments with search, filters, and offset pagination
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const seriesId = searchParams.get('series_id')
    const gameType = searchParams.get('game_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const sortBy = searchParams.get('sort_by') || 'date'
    const sortDir = searchParams.get('sort_dir') || 'desc'
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    const ascending = sortDir === 'asc'

    // ----- Build data query -----
    let query = supabase
      .from('tournaments')
      .select('*, series:series_id(id, name, venue)')

    // Filters
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }
    if (seriesId) {
      query = query.eq('series_id', seriesId)
    }
    if (gameType) {
      query = query.eq('game_type', gameType)
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('date', dateTo)
    }

    // Sorting
    switch (sortBy) {
      case 'buy_in':
        query = query.order('buy_in', { ascending }).order('date').order('start_time')
        break
      case 'name':
        query = query.order('name', { ascending }).order('date')
        break
      case 'start_time':
        query = query.order('start_time', { ascending }).order('date')
        break
      case 'game_type':
        query = query.order('game_type', { ascending }).order('date').order('start_time')
        break
      case 'format':
        query = query.order('format', { ascending }).order('date').order('start_time')
        break
      case 'guaranteed_prize':
        query = query.order('guaranteed_prize', { ascending, nullsFirst: false }).order('date').order('start_time')
        break
      default:
        // date
        query = query.order('date', { ascending }).order('start_time', { ascending })
        break
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ----- Count query (same filters, no pagination) -----
    let countQuery = supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })

    if (search) {
      countQuery = countQuery.ilike('name', `%${search}%`)
    }
    if (seriesId) {
      countQuery = countQuery.eq('series_id', seriesId)
    }
    if (gameType) {
      countQuery = countQuery.eq('game_type', gameType)
    }
    if (dateFrom) {
      countQuery = countQuery.gte('date', dateFrom)
    }
    if (dateTo) {
      countQuery = countQuery.lte('date', dateTo)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      totalCount: count ?? 0,
      offset,
      limit,
    })
  } catch (err) {
    console.error('Admin tournaments GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — Create a single tournament
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { tournament, new_series } = body as {
      tournament: Record<string, unknown>
      new_series?: {
        name: string
        venue: string
        start_date: string
        end_date: string
        website_url?: string
      }
    }

    if (!tournament) {
      return NextResponse.json({ error: 'Missing tournament data' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let seriesId = tournament.series_id as string | undefined

    // Create new series if provided
    if (new_series) {
      if (!new_series.name || !new_series.venue || !new_series.start_date || !new_series.end_date) {
        return NextResponse.json(
          { error: 'New series requires name, venue, start_date, end_date' },
          { status: 400 },
        )
      }

      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .insert({
          name: new_series.name,
          venue: new_series.venue,
          start_date: new_series.start_date,
          end_date: new_series.end_date,
          website_url: new_series.website_url || null,
        })
        .select('id')
        .single()

      if (seriesError) {
        return NextResponse.json(
          { error: `Failed to create series: ${seriesError.message}` },
          { status: 500 },
        )
      }

      seriesId = seriesData.id
    }

    if (!seriesId) {
      return NextResponse.json({ error: 'Must provide series_id or new_series' }, { status: 400 })
    }

    // Validate required fields
    const { name, date, start_time, buy_in, game_type } = tournament as Record<string, unknown>
    if (!name || !date || !start_time || buy_in === undefined || !game_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, date, start_time, buy_in, game_type' },
        { status: 400 },
      )
    }

    // Insert tournament
    const { data: created, error: insertError } = await supabase
      .from('tournaments')
      .insert({ ...tournament, series_id: seriesId })
      .select('*, series:series_id(id, name, venue)')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create tournament: ${insertError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ tournament: created })
  } catch (err) {
    console.error('Admin tournaments POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update a single tournament
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    // Auth check
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...fields } = body as { id: string; [key: string]: unknown }

    if (!id) {
      return NextResponse.json({ error: 'Missing tournament id' }, { status: 400 })
    }

    // Strip fields that should not be updated
    delete fields.created_at
    delete fields.series

    const supabase = createAdminClient()

    const { data: updated, error } = await supabase
      .from('tournaments')
      .update(fields)
      .eq('id', id)
      .select('*, series:series_id(id, name, venue)')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to update tournament: ${error.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ tournament: updated })
  } catch (err) {
    console.error('Admin tournaments PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a single tournament (and related user data)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    // Auth check
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body as { id: string }

    if (!id) {
      return NextResponse.json({ error: 'Missing tournament id' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Delete related rows first to avoid FK constraint violations
    const { error: scheduleError } = await supabase
      .from('user_schedule')
      .delete()
      .eq('tournament_id', id)

    if (scheduleError) {
      return NextResponse.json(
        { error: `Failed to delete schedule entries: ${scheduleError.message}` },
        { status: 500 },
      )
    }

    const { error: favoritesError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('tournament_id', id)

    if (favoritesError) {
      return NextResponse.json(
        { error: `Failed to delete favorites: ${favoritesError.message}` },
        { status: 500 },
      )
    }

    const { error: tournamentError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id)

    if (tournamentError) {
      return NextResponse.json(
        { error: `Failed to delete tournament: ${tournamentError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('Admin tournaments DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
