/**
 * Normalizes raw scraped tournament data to match the canonical
 * values used in the database schema and filter UI.
 *
 * Game types from tournament-filters.tsx:
 *   NLH, PLO, PLO8, Mixed, Stud, Razz, Limit Hold'em, Big O, Badugi
 *
 * Formats from tournament-filters.tsx:
 *   Re-entry, Freezeout, Deepstack, Mystery Bounty, Bounty, Turbo
 */

// ---------------------------------------------------------------------------
// Game Type Normalization
// ---------------------------------------------------------------------------

const GAME_TYPE_MAP: Record<string, string> = {
  // No-Limit Hold'em variants
  'nl hold\'em': 'NLH',
  'nl holdem': 'NLH',
  'no limit hold\'em': 'NLH',
  'no-limit hold\'em': 'NLH',
  'no limit holdem': 'NLH',
  'no-limit holdem': 'NLH',
  'nlh': 'NLH',
  'no limit texas hold\'em': 'NLH',

  // Pot Limit Omaha
  'pot limit omaha': 'PLO',
  'pot-limit omaha': 'PLO',
  'plo': 'PLO',
  'pl omaha': 'PLO',

  // Omaha Hi-Lo
  'omaha hi-lo': 'PLO8',
  'omaha hi/lo': 'PLO8',
  'omaha 8': 'PLO8',
  'plo hi-lo': 'PLO8',
  'plo hi/lo': 'PLO8',
  'plo8': 'PLO8',
  'o8': 'PLO8',
  'limit omaha hi/lo': 'PLO8',
  'limit omaha hi-lo': 'PLO8',

  // Big O (5-card PLO8)
  'big o': 'Big O',

  // Mixed games
  'mixed': 'Mixed',
  'horse': 'Mixed',
  'heros': 'Mixed',
  'torse': 'Mixed',
  'toe': 'Mixed',
  '8-game': 'Mixed',
  '10-game': 'Mixed',
  'dealer\'s choice': 'Mixed',
  'dealers choice': 'Mixed',

  // Stud
  'stud': 'Stud',
  'seven card stud': 'Stud',
  '7 card stud': 'Stud',
  'stud hi': 'Stud',

  // Stud Hi-Lo
  'stud hi-lo': 'Mixed',
  'stud hi/lo': 'Mixed',
  'mixed seven card stud': 'Mixed',

  // Razz
  'razz': 'Razz',

  // Limit Hold'em
  'limit hold\'em': "Limit Hold'em",
  'limit holdem': "Limit Hold'em",
  'lh': "Limit Hold'em",

  // Badugi
  'badugi': 'Badugi',

  // Draw games
  '2-7 triple draw': 'Mixed',
  '2-7 draw': 'Mixed',
  'triple draw': 'Mixed',
}

export function normalizeGameType(raw: string): string {
  const lower = raw.toLowerCase().trim()

  // Exact match first
  if (GAME_TYPE_MAP[lower]) return GAME_TYPE_MAP[lower]

  // Substring matching (order matters — check specific before general)
  for (const [pattern, canonical] of Object.entries(GAME_TYPE_MAP)) {
    if (lower.includes(pattern)) return canonical
  }

  // Common abbreviation fallback
  if (/hold.?em/i.test(lower) && /no.?limit/i.test(lower)) return 'NLH'
  if (/hold.?em/i.test(lower) && /limit/i.test(lower)) return "Limit Hold'em"
  if (/hold.?em/i.test(lower)) return 'NLH' // Default hold'em to NLH
  if (/omaha/i.test(lower) && /hi.?lo/i.test(lower)) return 'PLO8'
  if (/omaha/i.test(lower)) return 'PLO'

  // Fallback: return raw trimmed
  return raw.trim() || 'NLH'
}

// ---------------------------------------------------------------------------
// Format Normalization
// ---------------------------------------------------------------------------

const FORMAT_MAP: Record<string, string> = {
  're-entry': 'Re-entry',
  'reentry': 'Re-entry',
  're entry': 'Re-entry',
  'unlimited re-entry': 'Re-entry',
  'freezeout': 'Freezeout',
  'freeze out': 'Freezeout',
  'freeze-out': 'Freezeout',
  'deepstack': 'Deepstack',
  'deep stack': 'Deepstack',
  'deep-stack': 'Deepstack',
  'mystery bounty': 'Mystery Bounty',
  'bounty': 'Bounty',
  'knockout': 'Bounty',
  'turbo': 'Turbo',
  'super turbo': 'Turbo',
  'hyper turbo': 'Turbo',
  'hyper-turbo': 'Turbo',
}

export function normalizeFormat(raw: string, eventName?: string): string {
  const lower = raw.toLowerCase().trim()

  // Exact match
  if (FORMAT_MAP[lower]) return FORMAT_MAP[lower]

  // Substring matching
  for (const [pattern, canonical] of Object.entries(FORMAT_MAP)) {
    if (lower.includes(pattern)) return canonical
  }

  // Check event name for format hints
  if (eventName) {
    const nameLower = eventName.toLowerCase()
    if (nameLower.includes('mystery bounty')) return 'Mystery Bounty'
    if (nameLower.includes('bounty') || nameLower.includes('knockout')) return 'Bounty'
    if (nameLower.includes('freezeout') || nameLower.includes('freeze out')) return 'Freezeout'
    if (nameLower.includes('turbo')) return 'Turbo'
    if (nameLower.includes('deepstack') || nameLower.includes('deep stack')) return 'Deepstack'
  }

  // Default
  return 'Re-entry'
}

// ---------------------------------------------------------------------------
// Table Size Detection
// ---------------------------------------------------------------------------

export function normalizeTableSize(raw: string, eventName: string): number {
  const combined = `${raw} ${eventName}`.toLowerCase()

  if (/heads.?up|hu\b/i.test(combined)) return 2
  if (/6[- ]?(max|handed)/i.test(combined)) return 6
  if (/7[- ]?(max|handed)/i.test(combined)) return 7
  if (/8[- ]?(max|handed)/i.test(combined)) return 8
  if (/10[- ]?(max|handed)/i.test(combined)) return 10

  return 9 // Default standard table
}

// ---------------------------------------------------------------------------
// Flight Detection
// ---------------------------------------------------------------------------

export function detectFlight(name: string): {
  is_flight: boolean
  flight_label: string | null
} {
  // Match patterns like "Flight A", "Day 1C", "Day 1 Flight A", "- Flight B"
  const flightMatch = name.match(/flight\s*([A-Z1-9])/i)
  if (flightMatch) {
    return { is_flight: true, flight_label: `Flight ${flightMatch[1].toUpperCase()}` }
  }

  const dayMatch = name.match(/day\s*1\s*([A-Z])/i)
  if (dayMatch) {
    return { is_flight: true, flight_label: `Day 1${dayMatch[1].toUpperCase()}` }
  }

  return { is_flight: false, flight_label: null }
}

// ---------------------------------------------------------------------------
// Date & Time Helpers
// ---------------------------------------------------------------------------

export function parseDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Parse a raw date string like "Jun2", "Jun 2", "May28" into ISO format.
 * The year is provided from the casino config.
 */
export function parseDate(raw: string, year: number): string | null {
  const cleaned = raw.replace(/\n/g, ' ').trim()

  // Try to extract month and day: "Jun2", "Jun 2", "May28", "Jul13"
  const match = cleaned.match(
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i
  )
  if (!match) return null

  const monthStr = cleaned.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
  )?.[1]
  if (!monthStr) return null

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  }

  const month = monthMap[monthStr.toLowerCase()]
  const day = match[1].padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Parse a raw time string like "11:00am", "2:00p", "11:00a", "6:00pm" into HH:MM:SS format.
 */
export function parseTime(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, '').toLowerCase()

  // Match patterns: "11:00am", "2:00p", "11:00a", "6:00pm", "12:00pm"
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(am?|pm?)/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const period = match[3].toLowerCase()

  if (period.startsWith('p') && hours !== 12) {
    hours += 12
  } else if (period.startsWith('a') && hours === 12) {
    hours = 0
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}:00`
}

/**
 * Parse a raw buy-in string like "$250", "$1,500", "$10,400" into a number.
 */
export function parseBuyIn(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : num
}

/**
 * Parse a raw guarantee string like "$25,000 GTD", "$250K Gtd", "$3M GTD" into a number.
 */
export function parseGuarantee(raw: string): number | null {
  if (!raw || !raw.trim()) return null

  const cleaned = raw.replace(/[$,\s]/g, '').toUpperCase()

  // Handle "$250K", "$3M"
  const kMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*K/i)
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000)

  const mMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*M/i)
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000)

  // Handle plain numbers: "25000GTD", "250000"
  const numMatch = cleaned.match(/(\d+)/)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    return isNaN(num) || num === 0 ? null : num
  }

  return null
}
