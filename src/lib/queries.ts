import { SupabaseClient } from '@supabase/supabase-js'
import { TournamentFilters } from '@/types'

export function decodeCursor(cursor: string): { date: string; startTime: string; id: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
  const [date, startTime, id] = decoded.split('|')
  return { date, startTime, id }
}

export function encodeCursor(date: string, startTime: string, id: string): string {
  return Buffer.from(`${date}|${startTime}|${id}`).toString('base64')
}

export function buildTournamentQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.seriesIds?.length) query = query.in('series_id', filters.seriesIds)
  if (filters.buyInMin !== undefined) query = query.gte('buy_in', filters.buyInMin)
  if (filters.buyInMax !== undefined) query = query.lte('buy_in', filters.buyInMax)
  if (filters.gameTypes?.length) query = query.in('game_type', filters.gameTypes)
  if (filters.formats?.length) query = query.in('format', filters.formats)
  if (filters.tableSizes?.length) query = query.in('table_size', filters.tableSizes)
  if (filters.startTimeFrom) query = query.gte('start_time', filters.startTimeFrom)
  if (filters.startTimeTo) query = query.lte('start_time', filters.startTimeTo)

  // Turbo exclusion
  if (filters.avoidTurbos) {
    query = query.not('format', 'ilike', '%turbo%')
  }

  // Guarantee filters
  if (filters.hasGuarantee) {
    query = query.gt('guaranteed_prize', 0)
    if (filters.guaranteeMin !== undefined) query = query.gte('guaranteed_prize', filters.guaranteeMin)
    if (filters.guaranteeMax !== undefined) query = query.lte('guaranteed_prize', filters.guaranteeMax)
  }

  // Sorting
  if (filters.hasGuarantee) {
    query = query.order('date').order('guaranteed_prize', { ascending: false })
  } else {
    switch (filters.sortBy) {
      case 'buy_in_asc':
        query = query.order('buy_in', { ascending: true })
        break
      case 'buy_in_desc':
        query = query.order('buy_in', { ascending: false })
        break
      case 'guarantee_desc':
        query = query.order('guaranteed_prize', { ascending: false, nullsFirst: false })
        break
      default:
        query = query.order('date').order('start_time')
    }
  }

  // Always add tiebreaker sort by id for stable pagination
  query = query.order('id')

  if (filters.limit) query = query.limit(filters.limit)

  return query
}

export function buildCountQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.seriesIds?.length) query = query.in('series_id', filters.seriesIds)
  if (filters.buyInMin !== undefined) query = query.gte('buy_in', filters.buyInMin)
  if (filters.buyInMax !== undefined) query = query.lte('buy_in', filters.buyInMax)
  if (filters.gameTypes?.length) query = query.in('game_type', filters.gameTypes)
  if (filters.formats?.length) query = query.in('format', filters.formats)
  if (filters.tableSizes?.length) query = query.in('table_size', filters.tableSizes)
  if (filters.startTimeFrom) query = query.gte('start_time', filters.startTimeFrom)
  if (filters.startTimeTo) query = query.lte('start_time', filters.startTimeTo)
  if (filters.avoidTurbos) {
    query = query.not('format', 'ilike', '%turbo%')
  }
  if (filters.hasGuarantee) {
    query = query.gt('guaranteed_prize', 0)
    if (filters.guaranteeMin !== undefined) query = query.gte('guaranteed_prize', filters.guaranteeMin)
    if (filters.guaranteeMax !== undefined) query = query.lte('guaranteed_prize', filters.guaranteeMax)
  }

  return query
}

export async function getSimilarTournaments(
  supabase: SupabaseClient,
  tournament: {
    id: string
    date: string
    buy_in: number
    game_type: string
  },
  limit: number = 6
) {
  // Buy-in range: +/- 30%
  const buyInMin = Math.floor(tournament.buy_in * 0.7)
  const buyInMax = Math.ceil(tournament.buy_in * 1.3)

  // Find tournaments matching at least one criterion, ordered by relevance
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')
    .neq('id', tournament.id)
    .or(
      `date.eq.${tournament.date},` +
      `and(buy_in.gte.${buyInMin},buy_in.lte.${buyInMax}),` +
      `game_type.eq.${tournament.game_type}`
    )
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date')
    .order('start_time')
    .limit(limit * 3)  // Fetch extra to score and rank

  if (error || !data) return { data: [], error }

  // Score each by number of matching attributes
  const scored = data.map(t => {
    let score = 0
    if (t.date === tournament.date) score += 1
    if (t.buy_in >= buyInMin && t.buy_in <= buyInMax) score += 1
    if (t.game_type === tournament.game_type) score += 1
    return { ...t, _score: score }
  })

  // Sort by score descending, then by date
  scored.sort((a, b) => b._score - a._score || a.date.localeCompare(b.date))

  // Take top N, remove the score field
  const result = scored.slice(0, limit).map(({ _score, ...rest }) => rest)

  return { data: result, error: null }
}
