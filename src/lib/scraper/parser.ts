/**
 * Parses PokerAtlas markdown output into structured tournament rows.
 *
 * PokerAtlas tournament series pages render as numbered blocks in markdown:
 *
 * ```
 * 01. [May27\\
 *     \\
 *     Tuesday5:00pm](https://www.pokeratlas.com/...)
 *
 *     Satellite
 *
 *     Satellite to Event 1 $1100 Mystery Bounty
 *
 *     $160
 *
 *     NL Holdem
 *
 *     NLH
 *
 *     - 20,000 chips
 *     - 20 min levels
 *     - $250K Gtd
 *
 * 02. [Jun2\\
 *     ...
 * ```
 */

import { RawScrapedRow } from './types'

/**
 * Parse PokerAtlas markdown into an array of raw scraped rows.
 * Each tournament block starts with a numbered line like "01. [May27\\"
 */
export function parsePokerAtlasMarkdown(
  markdown: string,
  year: number
): { rows: RawScrapedRow[]; errors: string[] } {
  const rows: RawScrapedRow[] = []
  const errors: string[] = []

  // Split into tournament blocks by detecting numbered entries: "01. [", "02. [", etc.
  const blockPattern = /^(\d{1,3})\.\s*\[/m
  const lines = markdown.split('\n')

  // Find all block start indices
  const blockStarts: { lineIndex: number; eventNum: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\d{1,3})\.\s*\[/)
    if (match) {
      blockStarts.push({ lineIndex: i, eventNum: match[1] })
    }
  }

  if (blockStarts.length === 0) {
    errors.push('No tournament blocks found in markdown')
    return { rows, errors }
  }

  // Process each block
  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b].lineIndex
    const end = b + 1 < blockStarts.length ? blockStarts[b + 1].lineIndex : lines.length
    const blockLines = lines.slice(start, end)
    const blockText = blockLines.join('\n')
    const eventNum = blockStarts[b].eventNum

    try {
      const parsed = parseBlock(blockText, eventNum, year)
      if (parsed) {
        rows.push(parsed)
      }
    } catch (err) {
      errors.push(
        `Error parsing event #${eventNum}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  return { rows, errors }
}

/**
 * Parse a single tournament block into a RawScrapedRow.
 */
function parseBlock(
  blockText: string,
  eventNum: string,
  year: number
): RawScrapedRow | null {
  // ---- Extract date and time from the link line ----
  // Pattern: "01. [May27\\\n\\\nTuesday5:00pm](url)"
  // or: "01. [May27\\\nTuesday5:00pm](url)"
  const linkMatch = blockText.match(
    /\d+\.\s*\[((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{1,2})[\s\\]*(?:\n[\s\\]*)*(\w+?)(\d{1,2}:\d{2}\s*(?:am?|pm?))\]\(([^)]+)\)/i
  )

  if (!linkMatch) {
    // Try alternate pattern where day of week is separate
    return parseBlockAlternate(blockText, eventNum, year)
  }

  const rawDate = linkMatch[1] // e.g. "May27"
  const rawDayOfWeek = linkMatch[2] // e.g. "Tuesday"
  const rawTime = linkMatch[3] // e.g. "5:00pm"
  const url = linkMatch[4] // e.g. "https://www.pokeratlas.com/poker-tournament/..."

  // ---- Extract non-empty content lines after the link ----
  const contentLines = extractContentLines(blockText)

  // ---- Identify fields from content lines ----
  let { eventType, eventName, buyIn, gameType, guarantee, details, startingStack, blindLevelsMinutes, lateRegLevels } =
    identifyFields(contentLines)

  // ---- Fallback: extract buy-in and game type from URL if not found in content ----
  if (!buyIn || !gameType) {
    const urlData = extractFromUrl(url)
    if (!buyIn && urlData.buyIn) buyIn = urlData.buyIn
    if (!gameType && urlData.gameType) gameType = urlData.gameType
  }

  // Skip cancelled events
  if (eventName.toLowerCase().includes('cancelled') || eventName.toLowerCase().includes('canceled')) {
    return null
  }

  // Skip Day 2 / Restart / Final Table continuation events (not new tournaments)
  const nameLower = eventName.toLowerCase()
  if (
    nameLower.includes('day 2') || nameLower.includes('day2') ||
    nameLower.includes('final table') ||
    eventType === 'Restart'
  ) {
    return null
  }

  return {
    raw_date: rawDate,
    raw_time: rawTime,
    raw_game: gameType,
    raw_buyin: buyIn,
    raw_guarantee: guarantee,
    raw_format: '', // Derived from event name during normalization
    raw_name: eventName,
    raw_event_number: eventNum,
    raw_event_type: eventType,
    raw_starting_stack: startingStack,
    raw_blind_levels_minutes: blindLevelsMinutes,
    raw_late_reg_levels: lateRegLevels,
  }
}

/**
 * Alternate parser for when the primary regex doesn't match.
 * Handles varied markdown formatting from different PokerAtlas pages.
 */
function parseBlockAlternate(
  blockText: string,
  eventNum: string,
  year: number
): RawScrapedRow | null {
  // Try to find date anywhere in the first few lines
  const dateMatch = blockText.match(
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2})/i
  )
  if (!dateMatch) return null

  // Try to find time
  const timeMatch = blockText.match(/(\d{1,2}:\d{2}\s*(?:am?|pm?))/i)
  const rawTime = timeMatch ? timeMatch[1] : '12:00pm'

  const contentLines = extractContentLines(blockText)
  let { eventType, eventName, buyIn, gameType, guarantee, startingStack, blindLevelsMinutes, lateRegLevels } =
    identifyFields(contentLines)

  // ---- Fallback: extract buy-in and game type from URL if not found in content ----
  const urlMatch = blockText.match(/\(https?:\/\/[^)]+\)/)
  if (urlMatch && (!buyIn || !gameType)) {
    const url = urlMatch[0].slice(1, -1) // Remove parens
    const urlData = extractFromUrl(url)
    if (!buyIn && urlData.buyIn) buyIn = urlData.buyIn
    if (!gameType && urlData.gameType) gameType = urlData.gameType
  }

  if (!eventName && !buyIn) return null

  // Skip Day 2 / Restart / Final Table continuation events
  const nameLower = (eventName || '').toLowerCase()
  if (
    nameLower.includes('day 2') || nameLower.includes('day2') ||
    nameLower.includes('final table') ||
    eventType === 'Restart'
  ) {
    return null
  }

  return {
    raw_date: dateMatch[1].replace(/\s+/, ''),
    raw_time: rawTime,
    raw_game: gameType,
    raw_buyin: buyIn,
    raw_guarantee: guarantee,
    raw_format: '',
    raw_name: eventName || `Event #${eventNum}`,
    raw_event_number: eventNum,
    raw_event_type: eventType,
    raw_starting_stack: startingStack,
    raw_blind_levels_minutes: blindLevelsMinutes,
    raw_late_reg_levels: lateRegLevels,
  }
}

/**
 * Extract buy-in and game type from a PokerAtlas tournament URL.
 * URL patterns:
 *   .../{buy_in}-nl-holdem-{event_name}-{venue}?topid=...
 *   .../{buy_in}-pl-omaha-{event_name}-{venue}?topid=...
 *   .../{buy_in}-fl-mixed-{event_name}-{venue}?topid=...
 *
 * The buy-in is always the last number before the game type slug.
 */
function extractFromUrl(url: string): { buyIn: string; gameType: string } {
  let buyIn = ''
  let gameType = ''

  try {
    // Strip query params and get the path
    const path = url.split('?')[0]
    const slug = path.split('/').pop() || ''

    // Game type patterns in PokerAtlas URL slugs
    const gameTypeSlugs: [RegExp, string][] = [
      [/\b(\d+)-nl-holdem\b/, 'NLH'],
      [/\b(\d+)-pl-omaha-hi-lo\b/, 'PLO8'],
      [/\b(\d+)-pl-omaha\b/, 'PLO'],
      [/\b(\d+)-pl-big-o-hi-lo\b/, 'Big O'],
      [/\b(\d+)-pl-big-o\b/, 'Big O'],
      [/\b(\d+)-fl-omaha-8\b/, 'PLO8'],
      [/\b(\d+)-fl-omaha\b/, 'PLO'],
      [/\b(\d+)-fl-holdem\b/, "Limit Hold'em"],
      [/\b(\d+)-fl-mixed\b/, 'Mixed'],
      [/\b(\d+)-fl-stud\b/, 'Stud'],
      [/\b(\d+)-fl-razz\b/, 'Razz'],
      [/\b(\d+)-nl-badugi\b/, 'Badugi'],
      [/\b(\d+)-mixed\b/, 'Mixed'],
    ]

    for (const [pattern, game] of gameTypeSlugs) {
      const match = slug.match(pattern)
      if (match) {
        buyIn = `$${match[1]}`
        gameType = game
        break
      }
    }

    // Fallback: look for any number followed by a game type keyword
    if (!buyIn) {
      const fallbackMatch = slug.match(/\b(\d+)-(nl|pl|fl|no-limit|pot-limit|fixed-limit)-/)
      if (fallbackMatch) {
        buyIn = `$${fallbackMatch[1]}`
      }
    }
  } catch {
    // URL parsing failed — return empty
  }

  return { buyIn, gameType }
}

/**
 * Extract meaningful content lines from a block, stripping markdown artifacts.
 */
function extractContentLines(blockText: string): string[] {
  return blockText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      // Skip the numbered link line
      if (/^\d+\.\s*\[/.test(line)) return false
      // Skip pure markdown artifacts
      if (line === '\\' || line === '\\\\') return false
      // Skip lines that are just URLs in parens
      if (/^\]\(https?:/.test(line)) return false
      // Skip lines containing markdown link URL continuations (e.g., "Wednesday1:00pm](url)")
      if (/\]\(https?:\/\//.test(line)) return false
      // Skip lines that are just brackets/parens
      if (/^[\[\]\(\)]+$/.test(line)) return false
      // Skip "View Live Info" links from PokerAtlas
      if (/^view live info$/i.test(line)) return false
      // Skip scraped widget/iframe artifacts
      if (/widget|iframe/i.test(line) && line.length < 30) return false
      return true
    })
}

/**
 * Identify tournament fields from the ordered content lines.
 * PokerAtlas blocks have a predictable structure:
 *   1. Event type ("Series Event", "Satellite", "Side Event")
 *   2. Event name/description
 *   3. Buy-in amount ("$1,100")
 *   4. Game type full ("NL Holdem")
 *   5. Game type abbreviated ("NLH")
 *   6. Details list (- chips, - levels, - guarantee)
 */
function identifyFields(lines: string[]): {
  eventType: string
  eventName: string
  buyIn: string
  gameType: string
  guarantee: string
  details: string[]
  startingStack: string
  blindLevelsMinutes: string
  lateRegLevels: string
} {
  let eventType = ''
  let eventName = ''
  let buyIn = ''
  let gameType = ''
  let guarantee = ''
  const details: string[] = []
  let startingStack = ''
  let blindLevelsMinutes = ''
  let lateRegLevels = ''

  // Known event types
  const eventTypes = ['series event', 'satellite', 'side event']
  // Known game types (abbreviated)
  const gameTypeAbbrevs = [
    'nlh', 'plo', 'plo8', 'mixed', 'horse', 'stud', 'razz',
    'o8', 'big o', 'badugi', 'heros', 'torse', 'toe',
  ]

  let foundEventType = false
  let foundBuyIn = false
  let foundGameType = false

  for (const line of lines) {
    const lower = line.toLowerCase().trim()

    // Check for detail list items (- chips, - levels, - guarantee)
    if (line.startsWith('- ')) {
      const detail = line.substring(2).trim()
      // "Restart" in details marks a Day 2 / continuation event — not a real detail
      if (/^restart$/i.test(detail)) {
        // Tag as restart event type so pipeline can handle it
        if (!eventType) eventType = 'Restart'
        continue
      }
      details.push(detail)
      // Check for guarantee in details
      if (/\$[\d,]+\s*(?:k|m)?\s*(?:gtd|guaranteed)/i.test(line)) {
        const gMatch = line.match(/(\$[\d,]+\s*(?:k|m)?)\s*(?:gtd|guaranteed)/i)
        if (gMatch) guarantee = gMatch[1]
      }
      // Extract starting stack: "20,000 chips", "50000 Chips", "25,000 starting chips"
      if (/[\d,]+\s*(?:chips|starting)/i.test(detail) && !startingStack) {
        const stackMatch = detail.match(/([\d,]+)\s*(?:chips|starting)/i)
        if (stackMatch) startingStack = stackMatch[1].replace(/,/g, '')
      }
      // Extract blind level duration: "20 min levels", "30-min levels", "25 minute levels"
      if (/\d+\s*[-]?\s*min/i.test(detail) && !blindLevelsMinutes) {
        const levelMatch = detail.match(/(\d+)\s*[-]?\s*min/i)
        if (levelMatch) blindLevelsMinutes = levelMatch[1]
      }
      // Extract late reg levels: "Late entry through level 8", "Late reg through 6 levels"
      if (/late\s*(?:reg|entry|registration)/i.test(detail) && !lateRegLevels) {
        const regMatch = detail.match(/(?:level|lvl)\s*(\d+)/i) ||
                         detail.match(/(\d+)\s*level/i)
        if (regMatch) lateRegLevels = regMatch[1]
      }
      continue
    }

    // Skip "Event #X" label lines (e.g., "Event #5", "Event #45")
    if (/^event\s*#?\d+$/i.test(lower)) {
      continue
    }

    // Event type
    if (!foundEventType && eventTypes.includes(lower)) {
      eventType = line.trim()
      foundEventType = true
      continue
    }

    // Buy-in (line is purely a dollar amount, e.g. "$1,100")
    if (!foundBuyIn && /^\$[\d,]+$/.test(line.trim())) {
      buyIn = line.trim()
      foundBuyIn = true
      continue
    }

    // Combined event name + buy-in line (e.g., "$600 NLH $50K GTD", "$1,100 NLH Turbo $100K GTD")
    // These lines start with a dollar amount followed by event description
    if (!foundBuyIn && !eventName && /^\$[\d,]+\s+\S/.test(line.trim())) {
      const lineBuyInMatch = line.trim().match(/^(\$[\d,]+)/)
      if (lineBuyInMatch) {
        buyIn = lineBuyInMatch[1]
        foundBuyIn = true
        eventName = line.trim()
        continue
      }
    }

    // Game type abbreviated (short line matching known abbreviations)
    if (
      foundBuyIn &&
      !foundGameType &&
      gameTypeAbbrevs.includes(lower)
    ) {
      // We already have the full name, use abbreviated
      gameType = line.trim()
      foundGameType = true
      continue
    }

    // Game type full name (e.g., "NL Holdem", "Pot Limit Omaha")
    if (
      foundBuyIn &&
      !foundGameType &&
      /(?:holdem|hold'em|omaha|stud|razz|badugi|draw|horse|mixed)/i.test(line)
    ) {
      gameType = line.trim()
      // Don't set foundGameType yet — the next line might be the abbreviated form
      continue
    }

    // Guarantee in the event name line (e.g., "$250K Gtd. Mystery Bounty NLH")
    if (/\$[\d,]+\s*(?:k|m)?\s*gtd/i.test(line)) {
      const gMatch = line.match(/(\$[\d,]+\s*(?:k|m)?)\s*gtd/i)
      if (gMatch && !guarantee) guarantee = gMatch[1]
    }

    // Event name — anything substantive that isn't a known field type
    if (
      foundEventType &&
      !foundBuyIn &&
      line.trim().length > 2 &&
      !eventTypes.includes(lower)
    ) {
      eventName = line.trim()
      continue
    }

    // Catch-all: if we haven't found the event name and it looks like one
    if (!eventName && line.trim().length > 5 && !line.startsWith('$')) {
      // Could be the event name if it has meaningful content
      if (
        !eventTypes.includes(lower) &&
        !gameTypeAbbrevs.includes(lower) &&
        !/^(?:nl holdem|pot limit|seven card)/i.test(lower)
      ) {
        eventName = line.trim()
      }
    }
  }

  // --- Post-loop: extract buy-in from event name if not found on a dedicated line ---
  // Handles formats like "$1,100 NLH Turbo $100K GTD" or "$600 NLH $50K GTD"
  // or "$300 Milestone to $1,600 Seniors"
  if (!buyIn && eventName) {
    const nameBuyInMatch = eventName.match(/^\$[\d,]+/)
    if (nameBuyInMatch) {
      buyIn = nameBuyInMatch[0]
      foundBuyIn = true
    }
  }

  // --- Post-loop: extract game type from event name if not found ---
  if (!gameType && eventName) {
    // Try to detect game type from event name
    if (/\bnlh\b|hold.?em/i.test(eventName)) gameType = 'NLH'
    else if (/\b5[- ]?card\s*plo\b/i.test(eventName)) gameType = 'PLO'
    else if (/\bplo\s*8\b|\bomaha\s*8\b|\bomaha\s*hi.?lo\b/i.test(eventName)) gameType = 'PLO8'
    else if (/\bplo\b|\bomaha\b/i.test(eventName)) gameType = 'PLO'
    else if (/\btorse\b|\bhorse\b|\bheros\b/i.test(eventName)) gameType = 'Mixed'
    else if (/\bstud\b/i.test(eventName)) gameType = 'Stud'
    else if (/\brazz\b/i.test(eventName)) gameType = 'Razz'
    else if (/\bmixed\b/i.test(eventName)) gameType = 'Mixed'
    else if (/\bbig\s*o\b/i.test(eventName)) gameType = 'Big O'
    else if (/\bbadugi\b/i.test(eventName)) gameType = 'Badugi'
    else if (/\blimit\s+omaha\s*8\b/i.test(eventName)) gameType = 'PLO8'
  }

  // --- Post-loop: extract guarantee from event name if not found ---
  if (!guarantee && eventName) {
    // Match patterns like "$50K GTD", "$1.5M GTD", "$100K GTD", "$200K Gtd"
    const nameGtdMatch = eventName.match(/\$[\d,.]+\s*(?:k|m|mm)\s*gtd/i)
    if (nameGtdMatch) {
      const gMatch = nameGtdMatch[0].match(/(\$[\d,.]+\s*(?:k|m|mm)?)\s*gtd/i)
      if (gMatch) guarantee = gMatch[1]
    }
  }

  return { eventType, eventName, buyIn, gameType, guarantee, details, startingStack, blindLevelsMinutes, lateRegLevels }
}
