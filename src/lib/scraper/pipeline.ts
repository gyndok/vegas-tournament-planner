/**
 * Shared normalization pipeline — parses PokerAtlas markdown and normalizes
 * into structured tournament data. Used by both the admin scrape API route
 * and the cron monitoring route.
 */

import { parsePokerAtlasMarkdown } from './parser'
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
} from './normalizer'
import type { CasinoConfig, NormalizedTournament, RawScrapedRow } from './types'

export interface NormalizationResult {
  tournaments: NormalizedTournament[]
  rawRows: RawScrapedRow[]
  parseErrors: string[]
  normalizeErrors: string[]
}

/**
 * Parse scraped PokerAtlas markdown and normalize into tournament objects.
 */
export function normalizeScrapedMarkdown(
  markdown: string,
  config: CasinoConfig
): NormalizationResult {
  const year = parseInt(config.startDate.substring(0, 4))
  const { rows: rawRows, errors: parseErrors } = parsePokerAtlasMarkdown(markdown, year)

  const tournaments: NormalizedTournament[] = []
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

      let name = raw.raw_name
      if (!name) {
        name = `${config.colorKey} Event #${raw.raw_event_number || (i + 1)}`
      }

      tournaments.push({
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

  return { tournaments, rawRows, parseErrors, normalizeErrors }
}
