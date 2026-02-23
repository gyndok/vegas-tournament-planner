/**
 * Compare scraped tournament data against existing database records
 * to detect new, changed, and removed tournaments.
 */

import type { NormalizedTournament } from '@/lib/scraper/types'

export interface ExistingTournament {
  id: string
  date: string
  start_time: string
  buy_in: number
  name: string
  game_type: string
  format: string
  guaranteed_prize: number | null
}

export interface CasinoDiff {
  casinoName: string
  newTournaments: NormalizedTournament[]
  changedTournaments: {
    scraped: NormalizedTournament
    existing: ExistingTournament
  }[]
  removedTournaments: ExistingTournament[]
}

function tournamentKey(t: {
  date: string
  start_time: string
  buy_in: number
  name: string
}): string {
  return `${t.date}|${t.start_time}|${t.buy_in}|${t.name}`
}

/**
 * Diff scraped tournaments against existing ones for a single casino.
 * Uses the same composite key (date|start_time|buy_in|name) as the
 * dedup logic in the scrape API route.
 */
export function diffTournaments(
  scraped: NormalizedTournament[],
  existing: ExistingTournament[],
  casinoName: string
): CasinoDiff {
  const existingByKey = new Map<string, ExistingTournament>()
  for (const t of existing) {
    existingByKey.set(tournamentKey(t), t)
  }

  const scrapedByKey = new Map<string, NormalizedTournament>()
  for (const t of scraped) {
    scrapedByKey.set(tournamentKey(t), t)
  }

  const newTournaments: NormalizedTournament[] = []
  const changedTournaments: CasinoDiff['changedTournaments'] = []

  for (const [key, scrapedT] of scrapedByKey) {
    const existingT = existingByKey.get(key)
    if (!existingT) {
      newTournaments.push(scrapedT)
    } else {
      // Check for meaningful field changes
      const changed =
        scrapedT.game_type !== existingT.game_type ||
        scrapedT.format !== existingT.format ||
        scrapedT.guaranteed_prize !== existingT.guaranteed_prize
      if (changed) {
        changedTournaments.push({ scraped: scrapedT, existing: existingT })
      }
    }
  }

  // Detect removed tournaments (in DB but not in scrape)
  const removedTournaments: ExistingTournament[] = []
  for (const [key, existingT] of existingByKey) {
    if (!scrapedByKey.has(key)) {
      removedTournaments.push(existingT)
    }
  }

  return { casinoName, newTournaments, changedTournaments, removedTournaments }
}

export function hasChanges(diff: CasinoDiff): boolean {
  return (
    diff.newTournaments.length > 0 ||
    diff.changedTournaments.length > 0 ||
    diff.removedTournaments.length > 0
  )
}
