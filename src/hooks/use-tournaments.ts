'use client'
import { useState, useEffect } from 'react'
import { Tournament, TournamentFilters } from '@/types'

export function useTournaments(filters: TournamentFilters) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.buyInMin !== undefined) params.set('buyInMin', String(filters.buyInMin))
    if (filters.buyInMax !== undefined) params.set('buyInMax', String(filters.buyInMax))
    filters.gameTypes?.forEach(g => params.append('gameType', g))
    filters.formats?.forEach(f => params.append('format', f))
    filters.tableSizes?.forEach(t => params.append('tableSize', String(t)))
    if (filters.sortBy) params.set('sortBy', filters.sortBy)
    params.set('limit', '100')

    setLoading(true)
    fetch(`/api/tournaments?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject('Failed to load'))
      .then(data => { setTournaments(data); setError(null) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
      JSON.stringify(filters.gameTypes), JSON.stringify(filters.formats),
      JSON.stringify(filters.tableSizes), filters.sortBy])

  return { tournaments, loading, error }
}
