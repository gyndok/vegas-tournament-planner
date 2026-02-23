import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split('\n').filter((line) => line.trim() !== '')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header.trim()] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

interface ImportRow {
  event_number?: number
  name: string
  date: string
  day_of_week?: string
  start_time: string
  buy_in: number
  game_type: string
  format?: string
  table_size?: number
  starting_stack?: number | null
  blind_levels_minutes?: number | null
  late_reg_levels?: number | null
  late_reg_end_time?: string | null
  guaranteed_prize?: number | null
  is_flight?: boolean
  flight_label?: string | null
  parent_event_number?: number | null
  estimated_duration_hours?: number | null
  notes?: string | null
}

function validateRow(
  row: Record<string, unknown>,
  index: number
): { valid: true; data: ImportRow } | { valid: false; error: string } {
  const name = row.name as string | undefined
  const date = row.date as string | undefined
  const start_time = row.start_time as string | undefined
  const buy_in = row.buy_in
  const game_type = row.game_type as string | undefined

  if (!name || !date || !start_time || buy_in === undefined || buy_in === '' || !game_type) {
    const missing: string[] = []
    if (!name) missing.push('name')
    if (!date) missing.push('date')
    if (!start_time) missing.push('start_time')
    if (buy_in === undefined || buy_in === '') missing.push('buy_in')
    if (!game_type) missing.push('game_type')
    return { valid: false, error: `Row ${index + 1}: missing required fields: ${missing.join(', ')}` }
  }

  const parsedBuyIn = typeof buy_in === 'number' ? buy_in : Number(buy_in)
  if (isNaN(parsedBuyIn)) {
    return { valid: false, error: `Row ${index + 1}: buy_in is not a valid number` }
  }

  return {
    valid: true,
    data: {
      event_number: row.event_number ? Number(row.event_number) : undefined,
      name: String(name),
      date: String(date),
      day_of_week: row.day_of_week ? String(row.day_of_week) : undefined,
      start_time: String(start_time),
      buy_in: parsedBuyIn,
      game_type: String(game_type),
      format: row.format ? String(row.format) : undefined,
      table_size: row.table_size ? Number(row.table_size) : undefined,
      starting_stack: row.starting_stack ? Number(row.starting_stack) : null,
      blind_levels_minutes: row.blind_levels_minutes ? Number(row.blind_levels_minutes) : null,
      late_reg_levels: row.late_reg_levels ? Number(row.late_reg_levels) : null,
      late_reg_end_time: row.late_reg_end_time ? String(row.late_reg_end_time) : null,
      guaranteed_prize: row.guaranteed_prize ? Number(row.guaranteed_prize) : null,
      is_flight: row.is_flight === true || row.is_flight === 'true',
      flight_label: row.flight_label ? String(row.flight_label) : null,
      parent_event_number: row.parent_event_number ? Number(row.parent_event_number) : null,
      estimated_duration_hours: row.estimated_duration_hours ? Number(row.estimated_duration_hours) : null,
      notes: row.notes ? String(row.notes) : null,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check — use server-side Supabase cookies
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { format, data, series_id, new_series } = body as {
      format: 'json' | 'csv'
      data: string
      series_id?: string
      new_series?: {
        name: string
        venue: string
        start_date: string
        end_date: string
        website_url?: string
      }
    }

    if (!format || !data) {
      return NextResponse.json({ error: 'Missing format or data' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let targetSeriesId = series_id

    // Create new series if requested
    if (new_series) {
      if (!new_series.name || !new_series.venue || !new_series.start_date || !new_series.end_date) {
        return NextResponse.json({ error: 'New series requires name, venue, start_date, end_date' }, { status: 400 })
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
        return NextResponse.json({ error: `Failed to create series: ${seriesError.message}` }, { status: 500 })
      }

      targetSeriesId = seriesData.id
    }

    if (!targetSeriesId) {
      return NextResponse.json({ error: 'Must provide series_id or new_series' }, { status: 400 })
    }

    // Parse data
    let rows: Record<string, unknown>[]
    try {
      if (format === 'json') {
        rows = JSON.parse(data)
        if (!Array.isArray(rows)) {
          return NextResponse.json({ error: 'JSON data must be an array' }, { status: 400 })
        }
      } else {
        rows = parseCSV(data)
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: `Failed to parse ${format.toUpperCase()} data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 })
    }

    // Validate and collect rows
    const validRows: ImportRow[] = []
    const errors: string[] = []
    let skipped = 0

    for (let i = 0; i < rows.length; i++) {
      const result = validateRow(rows[i], i)
      if (result.valid) {
        validRows.push(result.data)
      } else {
        errors.push(result.error)
        skipped++
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json({ inserted: 0, skipped, errors }, { status: 200 })
    }

    // Build insert payloads
    const insertPayloads = validRows.map((row) => ({
      series_id: targetSeriesId!,
      event_number: row.event_number || 0,
      name: row.name,
      date: row.date,
      day_of_week: row.day_of_week || '',
      start_time: row.start_time,
      buy_in: row.buy_in,
      game_type: row.game_type,
      format: row.format || '',
      table_size: row.table_size || 9,
      starting_stack: row.starting_stack,
      blind_levels_minutes: row.blind_levels_minutes,
      late_reg_levels: row.late_reg_levels,
      late_reg_end_time: row.late_reg_end_time,
      guaranteed_prize: row.guaranteed_prize,
      is_flight: row.is_flight || false,
      flight_label: row.flight_label,
      parent_event_number: row.parent_event_number,
      estimated_duration_hours: row.estimated_duration_hours,
      notes: row.notes,
    }))

    const { error: insertError, data: insertedData } = await supabase
      .from('tournaments')
      .insert(insertPayloads)
      .select('id')

    if (insertError) {
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}`, inserted: 0, skipped, errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      inserted: insertedData?.length || 0,
      skipped,
      errors,
      series_id: targetSeriesId,
    })
  } catch (error) {
    console.error('Admin import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
