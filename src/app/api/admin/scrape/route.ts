import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeToMarkdown } from '@/lib/scraper/firecrawl'
import { parsePokerAtlasMarkdown } from '@/lib/scraper/parser'
import {
  normalizeGameType,
  normalizeFormat,
  normalizeTableSize,
  detectFlight,
  parseDayOfWeek,
  parseDate,
  parseTime,
  parseBuyIn,
  parseGuarantee,
} from '@/lib/scraper/normalizer'
import { getCasinoConfig, CASINO_CONFIGS } from '@/lib/scraper/casino-configs'
import type { NormalizedTournament } from '@/lib/scraper/types'

function isAdminAuthorized(email: string | null): boolean {
  const adminEmails = process.env.ADMIN_EMAILS
  if (!adminEmails) return true
  if (!email) return false
  const allowed = adminEmails.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.toLowerCase())
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const adminEmail = request.headers.get('x-admin-email')
    if (!isAdminAuthorized(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { casinoKey } = body as { casinoKey: string }

    if (!casinoKey) {
      return NextResponse.json({ error: 'Missing casinoKey' }, { status: 400 })
    }

    const config = getCasinoConfig(casinoKey)
    if (!config) {
      return NextResponse.json(
        {
          error: `Unknown casino key: "${casinoKey}". Available: ${CASINO_CONFIGS.map((c) => c.key).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 1. Scrape PokerAtlas page
    let markdown: string
    try {
      markdown = await scrapeToMarkdown(config.pokerAtlasUrl)
    } catch (scrapeErr) {
      // Try fallback URL if available
      if (config.fallbackUrl) {
        try {
          markdown = await scrapeToMarkdown(config.fallbackUrl)
        } catch {
          return NextResponse.json(
            {
              error: `Scraping failed for ${config.seriesName}. Primary: ${scrapeErr instanceof Error ? scrapeErr.message : 'Unknown'}`,
            },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          {
            error: `Scraping failed: ${scrapeErr instanceof Error ? scrapeErr.message : 'Unknown'}`,
          },
          { status: 500 }
        )
      }
    }

    if (!markdown || markdown.length < 100) {
      return NextResponse.json(
        { error: 'Scraped content too short — page may not have loaded properly' },
        { status: 500 }
      )
    }

    // 2. Parse markdown into raw rows
    const year = parseInt(config.startDate.substring(0, 4))
    const { rows: rawRows, errors: parseErrors } = parsePokerAtlasMarkdown(markdown, year)

    if (rawRows.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: 0,
        errors: [
          'No tournament rows found in scraped content.',
          ...parseErrors,
        ],
        markdownLength: markdown.length,
      })
    }

    // 3. Normalize rows
    const normalizedTournaments: NormalizedTournament[] = []
    const normalizeErrors: string[] = []

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      try {
        const date = parseDate(raw.raw_date, year)
        if (!date) {
          normalizeErrors.push(`Row ${i + 1}: Could not parse date from "${raw.raw_date}"`)
          continue
        }

        const time = parseTime(raw.raw_time)
        if (!time) {
          normalizeErrors.push(`Row ${i + 1}: Could not parse time from "${raw.raw_time}"`)
          continue
        }

        const buyIn = parseBuyIn(raw.raw_buyin)
        if (buyIn === null) {
          normalizeErrors.push(`Row ${i + 1}: Could not parse buy-in from "${raw.raw_buyin}"`)
          continue
        }

        const gameType = normalizeGameType(raw.raw_game)
        const format = normalizeFormat(raw.raw_format, raw.raw_name)
        const tableSize = normalizeTableSize('', raw.raw_name)
        const { is_flight, flight_label } = detectFlight(raw.raw_name)
        const guarantee = parseGuarantee(raw.raw_guarantee)
        const dayOfWeek = parseDayOfWeek(date)

        // Build event name — include event type context if it's a satellite
        let name = raw.raw_name
        if (!name) {
          name = `${config.colorKey} Event #${raw.raw_event_number || (i + 1)}`
        }

        normalizedTournaments.push({
          event_number: parseInt(raw.raw_event_number) || (i + 1),
          name,
          date,
          day_of_week: dayOfWeek,
          start_time: time,
          buy_in: buyIn,
          game_type: gameType,
          format,
          table_size: tableSize,
          starting_stack: null,
          blind_levels_minutes: null,
          late_reg_levels: null,
          late_reg_end_time: null,
          guaranteed_prize: guarantee,
          is_flight,
          flight_label,
          parent_event_number: null,
          estimated_duration_hours: null,
          notes: raw.raw_event_type || null,
        })
      } catch (err) {
        normalizeErrors.push(
          `Row ${i + 1}: Normalization error: ${err instanceof Error ? err.message : 'Unknown'}`
        )
      }
    }

    if (normalizedTournaments.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: 0,
        errors: [...parseErrors, ...normalizeErrors],
      })
    }

    // 4. Find or create series in Supabase
    const supabase = createAdminClient()

    const { data: existingSeries } = await supabase
      .from('series')
      .select('id')
      .eq('name', config.seriesName)
      .eq('venue', config.venue)
      .maybeSingle()

    let seriesId: string

    if (existingSeries) {
      seriesId = existingSeries.id
    } else {
      const { data: newSeries, error: seriesError } = await supabase
        .from('series')
        .insert({
          name: config.seriesName,
          venue: config.venue,
          start_date: config.startDate,
          end_date: config.endDate,
          website_url: config.websiteUrl,
        })
        .select('id')
        .single()

      if (seriesError || !newSeries) {
        return NextResponse.json(
          { error: `Failed to create series: ${seriesError?.message || 'Unknown'}` },
          { status: 500 }
        )
      }

      seriesId = newSeries.id
    }

    // 5. Deduplication — check existing tournaments for this series
    const { data: existingTournaments } = await supabase
      .from('tournaments')
      .select('id, date, start_time, buy_in, name')
      .eq('series_id', seriesId)

    const existingKeys = new Set<string>()
    if (existingTournaments) {
      for (const t of existingTournaments) {
        existingKeys.add(`${t.date}|${t.start_time}|${t.buy_in}|${t.name}`)
      }
    }

    // Filter out duplicates
    const toInsert = normalizedTournaments.filter((t) => {
      const key = `${t.date}|${t.start_time}|${t.buy_in}|${t.name}`
      return !existingKeys.has(key)
    })

    const skipped = normalizedTournaments.length - toInsert.length

    if (toInsert.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped,
        errors: [...parseErrors, ...normalizeErrors],
        series_id: seriesId,
        message: 'All tournaments already exist (dedup matched)',
      })
    }

    // 6. Insert new tournaments
    const insertPayloads = toInsert.map((t) => ({
      series_id: seriesId,
      event_number: t.event_number,
      name: t.name,
      date: t.date,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      buy_in: t.buy_in,
      game_type: t.game_type,
      format: t.format,
      table_size: t.table_size,
      starting_stack: t.starting_stack,
      blind_levels_minutes: t.blind_levels_minutes,
      late_reg_levels: t.late_reg_levels,
      late_reg_end_time: t.late_reg_end_time,
      guaranteed_prize: t.guaranteed_prize,
      is_flight: t.is_flight,
      flight_label: t.flight_label,
      parent_event_number: t.parent_event_number,
      estimated_duration_hours: t.estimated_duration_hours,
      notes: t.notes,
    }))

    const { error: insertError, data: insertedData } = await supabase
      .from('tournaments')
      .insert(insertPayloads)
      .select('id')

    if (insertError) {
      return NextResponse.json(
        {
          error: `Database insert failed: ${insertError.message}`,
          inserted: 0,
          skipped,
          errors: [...parseErrors, ...normalizeErrors],
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      inserted: insertedData?.length || 0,
      skipped,
      errors: [...parseErrors, ...normalizeErrors],
      series_id: seriesId,
      totalScraped: rawRows.length,
      totalNormalized: normalizedTournaments.length,
    })
  } catch (error) {
    console.error('Admin scrape error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}

/** GET handler returns available casino configs */
export async function GET() {
  return NextResponse.json({
    casinos: CASINO_CONFIGS.map((c) => ({
      key: c.key,
      seriesName: c.seriesName,
      venue: c.venue,
      startDate: c.startDate,
      endDate: c.endDate,
      colorKey: c.colorKey,
    })),
  })
}
