import { SupabaseClient } from '@supabase/supabase-js'
import { TournamentFilters } from '@/types'

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

  // Sorting — when hasGuarantee is active, compound sort: date ASC then guarantee DESC
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

  if (filters.limit) query = query.limit(filters.limit)
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

  return query
}
