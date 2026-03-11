import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { scrapeToMarkdown, searchAndScrape } from '@/lib/scraper/firecrawl'
import { normalizeScrapedMarkdown } from '@/lib/scraper/pipeline'
import { getCasinoConfig, CASINO_CONFIGS } from '@/lib/scraper/casino-configs'

export async function POST(request: NextRequest) {
  try {
    // Auth check — use server-side Supabase cookies
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || !isAdminEmail(user.email)) {
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

    // 1. Scrape PokerAtlas page (primary URL → fallback URL → search fallback)
    let markdown: string
    let usedSearch = false
    try {
      markdown = await scrapeToMarkdown(config.pokerAtlasUrl)
    } catch (scrapeErr) {
      // Try fallback URL if available
      if (config.fallbackUrl) {
        try {
          markdown = await scrapeToMarkdown(config.fallbackUrl)
        } catch {
          // Fall through to search fallback below
        }
      }

      // @ts-expect-error — markdown may not be assigned yet if both URLs failed
      if (!markdown) {
        try {
          markdown = await searchAndScrape(config.seriesName, config.venue)
          usedSearch = true
        } catch (searchErr) {
          return NextResponse.json(
            {
              error: `All scraping methods failed for ${config.seriesName}. ` +
                `Primary: ${scrapeErr instanceof Error ? scrapeErr.message : 'Unknown'}. ` +
                `Search: ${searchErr instanceof Error ? searchErr.message : 'Unknown'}`,
            },
            { status: 500 }
          )
        }
      }
    }

    if (!markdown || markdown.length < 100) {
      return NextResponse.json(
        { error: 'Scraped content too short — page may not have loaded properly' },
        { status: 500 }
      )
    }

    // 2. Parse and normalize via shared pipeline
    const {
      tournaments: normalizedTournaments,
      rawRows,
      parseErrors,
      normalizeErrors,
    } = normalizeScrapedMarkdown(markdown, config)

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
      usedSearch,
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
