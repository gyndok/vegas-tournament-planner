/**
 * Cron API route: Daily schedule change monitoring.
 *
 * Scrapes all 6 casinos from PokerAtlas, compares against the database,
 * and sends an email notification if new or changed tournaments are detected.
 * Does NOT auto-import — just detects and notifies.
 *
 * Triggered by Vercel Cron (see vercel.json) or manually via:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" /api/cron/monitor-schedules
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeToMarkdown, searchAndScrape } from '@/lib/scraper/firecrawl'
import { normalizeScrapedMarkdown } from '@/lib/scraper/pipeline'
import { CASINO_CONFIGS } from '@/lib/scraper/casino-configs'
import {
  diffTournaments,
  hasChanges,
  type CasinoDiff,
  type ExistingTournament,
} from '@/lib/schedule-differ'
import {
  sendScheduleChangeEmail,
  type ScheduleChangeReport,
} from '@/lib/email'
import { processPoolStrikes } from '@/lib/pool-utils'

export const maxDuration = 300 // 5 minutes — needed for scraping all 6 casinos

export async function GET(request: NextRequest) {
  // 1. Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const diffs: CasinoDiff[] = []
  const errors: string[] = []

  // 2. Process each casino
  for (const config of CASINO_CONFIGS) {
    try {
      // 2a. Scrape (primary URL → fallback URL → search fallback)
      let markdown: string
      try {
        markdown = await scrapeToMarkdown(config.pokerAtlasUrl)
      } catch (scrapeErr) {
        if (config.fallbackUrl) {
          try {
            markdown = await scrapeToMarkdown(config.fallbackUrl)
          } catch {
            // Fall through to search fallback
          }
        }

        // @ts-expect-error — markdown may not be assigned yet
        if (!markdown) {
          try {
            markdown = await searchAndScrape(config.seriesName, config.venue)
          } catch {
            errors.push(
              `${config.colorKey}: all scrape methods failed — ${scrapeErr instanceof Error ? scrapeErr.message : 'Unknown'}`
            )
            continue
          }
        }
      }

      if (!markdown || markdown.length < 100) {
        errors.push(`${config.colorKey}: scraped content too short (${markdown?.length ?? 0} chars)`)
        continue
      }

      // 2b. Parse and normalize
      const { tournaments: normalized, parseErrors, normalizeErrors } =
        normalizeScrapedMarkdown(markdown, config)

      if (parseErrors.length > 0) {
        errors.push(`${config.colorKey}: ${parseErrors.length} parse warning(s)`)
      }
      if (normalizeErrors.length > 0) {
        errors.push(`${config.colorKey}: ${normalizeErrors.length} normalize warning(s)`)
      }

      if (normalized.length === 0) {
        errors.push(`${config.colorKey}: no tournaments found after normalization`)
        continue
      }

      // 2c. Fetch existing tournaments for this series
      const { data: existingSeries } = await supabase
        .from('series')
        .select('id')
        .eq('name', config.seriesName)
        .eq('venue', config.venue)
        .maybeSingle()

      let existing: ExistingTournament[] = []

      if (existingSeries) {
        const { data } = await supabase
          .from('tournaments')
          .select('id, date, start_time, buy_in, name, game_type, format, guaranteed_prize')
          .eq('series_id', existingSeries.id)

        existing = (data ?? []) as ExistingTournament[]
      }

      // 2d. Diff
      const diff = diffTournaments(normalized, existing, config.colorKey)
      diffs.push(diff)

      // 2e. Process pool strikes for this casino. Bump the cancel-strike
      // counter on pools whose tournament went missing this run; reset to
      // zero on pools whose tournament reappeared. Only pools that hit the
      // consecutive-misses threshold get cancelled, which absorbs transient
      // scrape failures. We do this per casino (not aggregated post-loop)
      // so a casino that fails to scrape leaves its pools untouched.
      const removedIdSet = new Set(diff.removedTournaments.map(t => t.id))
      const missingIds = Array.from(removedIdSet)
      const presentIds = existing
        .filter(e => !removedIdSet.has(e.id))
        .map(e => e.id)
      if (missingIds.length > 0 || presentIds.length > 0) {
        try {
          const result = await processPoolStrikes(supabase, {
            presentTournamentIds: presentIds,
            missingTournamentIds: missingIds,
          })
          if (result.cancelled.length > 0) {
            errors.push(
              `${config.colorKey}: cancelled ${result.cancelled.length} pool(s) after consecutive misses`
            )
          }
        } catch (strikeErr) {
          errors.push(
            `${config.colorKey}: pool-strike processing failed — ${strikeErr instanceof Error ? strikeErr.message : 'Unknown'}`
          )
        }
      }
    } catch (err) {
      errors.push(
        `${config.colorKey}: unexpected error — ${err instanceof Error ? err.message : 'Unknown'}`
      )
    }
  }

  // 3. Check if anything changed
  const changedDiffs = diffs.filter(hasChanges)

  if (changedDiffs.length === 0) {
    return NextResponse.json({
      status: 'no_changes',
      message: 'All schedules match database. No notification sent.',
      casinosScanned: diffs.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  }

  // 4. Build change report and send email
  const reports: ScheduleChangeReport[] = changedDiffs.map((d) => ({
    casinoName: d.casinoName,
    newCount: d.newTournaments.length,
    changedCount: d.changedTournaments.length,
    removedCount: d.removedTournaments.length,
  }))

  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  if (!adminEmail) {
    return NextResponse.json({
      status: 'changes_detected_no_email',
      message: 'ADMIN_EMAILS not configured. Changes detected but no notification sent.',
      changes: reports,
      errors,
    })
  }

  try {
    await sendScheduleChangeEmail(adminEmail, reports, new Date().toISOString())
  } catch (emailErr) {
    errors.push(
      `Email send failed: ${emailErr instanceof Error ? emailErr.message : 'Unknown'}`
    )
  }

  return NextResponse.json({
    status: 'changes_detected',
    notifiedEmail: adminEmail,
    changes: reports,
    casinosScanned: diffs.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
