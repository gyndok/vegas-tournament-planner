export interface Series {
  id: string
  name: string
  venue: string
  start_date: string
  end_date: string
  website_url: string | null
  created_at: string
}

export interface Tournament {
  id: string
  series_id: string
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
  created_at: string
  series?: Series
}

export interface UserPreferences {
  id: string
  user_id: string
  buy_in_min: number | null
  buy_in_max: number | null
  preferred_games: string[]
  preferred_formats: string[]
  preferred_start_time_earliest: string | null
  preferred_start_time_latest: string | null
  preferred_table_size: number[]
  avoid_turbos: boolean
  trip_start: string | null
  trip_end: string | null
  created_at: string
  updated_at: string
}

export interface UserScheduleEntry {
  id: string
  user_id: string
  tournament_id: string
  priority: 'target' | 'backup' | 'maybe'
  notes: string | null
  created_at: string
  tournament?: Tournament
}

export interface TournamentFilters {
  dateFrom?: string
  dateTo?: string
  seriesIds?: string[]
  buyInMin?: number
  buyInMax?: number
  gameTypes?: string[]
  formats?: string[]
  tableSizes?: number[]
  startTimeFrom?: string    // e.g. "10:00"
  startTimeTo?: string      // e.g. "20:00"
  avoidTurbos?: boolean
  hasGuarantee?: boolean
  guaranteeMin?: number
  guaranteeMax?: number
  sortBy?: 'date' | 'buy_in_asc' | 'buy_in_desc' | 'guarantee_desc'
  limit?: number
  offset?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tournaments?: Tournament[]
  timestamp: Date
}

export const SERIES_COLORS: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  WSOP: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'WSOP', dot: 'bg-amber-500' },
  Venetian: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Venetian', dot: 'bg-red-500' },
  Wynn: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Wynn', dot: 'bg-emerald-500' },
  Aria: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'Aria', dot: 'bg-blue-500' },
  'Golden Nugget': { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', label: 'Golden Nugget', dot: 'bg-orange-500' },
  MGM: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', label: 'MGM Grand', dot: 'bg-purple-500' },
  Orleans: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', label: 'Orleans', dot: 'bg-cyan-500' },
  default: { bg: 'bg-gray-100 dark:bg-gray-500/20', text: 'text-gray-700 dark:text-gray-400', label: 'Other', dot: 'bg-gray-400' },
}
