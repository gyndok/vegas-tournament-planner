/**
 * Scraper type definitions for the PokerAtlas tournament scraping pipeline.
 */

/** Configuration for a single casino's poker tournament series */
export interface CasinoConfig {
  /** Short identifier: 'aria', 'venetian', 'wynn', etc. */
  key: string
  /** Full series name: "2025 Aria Poker Classic" */
  seriesName: string
  /** Casino/venue name: "Aria Resort & Casino" */
  venue: string
  /** Primary scrape URL on PokerAtlas */
  pokerAtlasUrl: string
  /** Fallback URL (casino direct site) */
  fallbackUrl?: string
  /** Series start date (ISO format) */
  startDate: string
  /** Series end date (ISO format) */
  endDate: string
  /** Official series website URL */
  websiteUrl: string
  /** Key for SERIES_COLORS lookup: "Aria", "Golden Nugget", etc. */
  colorKey: string
}

/** Raw row extracted from scraped PokerAtlas markdown before normalization */
export interface RawScrapedRow {
  /** Raw date text, e.g. "Jun 2" or "Jun2\nMonday" */
  raw_date: string
  /** Raw time text, e.g. "11:00am" or "2:00p" */
  raw_time: string
  /** Raw game type text, e.g. "NL Hold'em", "PLO" */
  raw_game: string
  /** Raw buy-in text, e.g. "$250" or "$1,500" */
  raw_buyin: string
  /** Raw guarantee text, e.g. "$25,000 GTD" or "" */
  raw_guarantee: string
  /** Raw format/type text, e.g. "Re-Entry", "Freezeout" */
  raw_format: string
  /** Event name/description */
  raw_name: string
  /** Event number if available, e.g. "5" or "" */
  raw_event_number: string
  /** Event type from PokerAtlas: "Series Event", "Side Event", "Satellite" */
  raw_event_type: string
}

/** Normalized tournament data ready for database insertion */
export interface NormalizedTournament {
  event_number: number
  name: string
  date: string
  day_of_week: string
  start_time: string
  buy_in: number
  game_type: string
  format: string
  table_size: number
  starting_stack: number | null
  blind_levels_minutes: number | null
  late_reg_levels: number | null
  late_reg_end_time: string | null
  guaranteed_prize: number | null
  is_flight: boolean
  flight_label: string | null
  parent_event_number: number | null
  estimated_duration_hours: number | null
  notes: string | null
}

/** Result of scraping a single casino */
export interface ScrapeResult {
  casinoKey: string
  seriesName: string
  tournaments: NormalizedTournament[]
  errors: string[]
  scrapedAt: string
}
