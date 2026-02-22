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
  startTimeFrom?: string
  startTimeTo?: string
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

export const SERIES_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  WSOP: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'WSOP' },
  Venetian: { bg: 'bg-red-600/20', text: 'text-red-500', label: 'Venetian' },
  Wynn: { bg: 'bg-green-600/20', text: 'text-green-500', label: 'Wynn' },
  Aria: { bg: 'bg-blue-600/20', text: 'text-blue-500', label: 'Aria' },
  default: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Other' },
}
