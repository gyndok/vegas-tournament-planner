'use client'
import { useState, useEffect, useMemo } from 'react'
import { Tournament, TournamentFilters, PaginatedTournamentsResponse } from '@/types'

export function useTournaments(filters: TournamentFilters) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilise array deps so the effect dependency list stays simple
  const gameTypes = useMemo(() => JSON.stringify(filters.gameTypes), [filters.gameTypes])
  const formats = useMemo(() => JSON.stringify(filters.formats), [filters.formats])
  const tableSizes = useMemo(() => JSON.stringify(filters.tableSizes), [filters.tableSizes])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchTournaments() {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.buyInMin !== undefined) params.set('buyInMin', String(filters.buyInMin))
      if (filters.buyInMax !== undefined) params.set('buyInMax', String(filters.buyInMax))
      filters.gameTypes?.forEach(g => params.append('gameType', g))
      filters.formats?.forEach(f => params.append('format', f))
      filters.tableSizes?.forEach(t => params.append('tableSize', String(t)))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.startTimeFrom) params.set('startTimeFrom', filters.startTimeFrom)
      if (filters.startTimeTo) params.set('startTimeTo', filters.startTimeTo)
      if (filters.avoidTurbos) params.set('avoidTurbos', 'true')
      if (filters.hasGuarantee) params.set('hasGuarantee', 'true')
      if (filters.guaranteeMin !== undefined) params.set('guaranteeMin', String(filters.guaranteeMin))
      if (filters.guaranteeMax !== undefined) params.set('guaranteeMax', String(filters.guaranteeMax))
      params.set('limit', '100')

      try {
        const res = await fetch(`/api/tournaments?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load')
        const result: PaginatedTournamentsResponse = await res.json()
        if (!controller.signal.aborted) {
          setTournaments(result.data)
          setError(null)
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(String(e))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    setLoading(true)
    fetchTournaments()

    return () => controller.abort()
  }, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
      filters.gameTypes, filters.formats, filters.tableSizes, filters.sortBy,
      filters.startTimeFrom, filters.startTimeTo, filters.avoidTurbos,
      filters.hasGuarantee, filters.guaranteeMin, filters.guaranteeMax,
      gameTypes, formats, tableSizes])

  return { tournaments, loading, error }
}
