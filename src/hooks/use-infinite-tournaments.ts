'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Tournament, TournamentFilters, PaginatedTournamentsResponse } from '@/types'

interface UseInfiniteTournamentsReturn {
  tournaments: Tournament[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  totalCount: number
  hasMore: boolean
  loadMore: () => void
}

function buildSearchParams(filters: TournamentFilters, cursor?: string): URLSearchParams {
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
  filters.casinos?.forEach(c => params.append('casino', c))
  params.set('limit', '30')
  if (cursor) params.set('cursor', cursor)
  return params
}

export function useInfiniteTournaments(filters: TournamentFilters): UseInfiniteTournamentsReturn {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Stabilise array deps
  const gameTypes = useMemo(() => JSON.stringify(filters.gameTypes), [filters.gameTypes])
  const formats = useMemo(() => JSON.stringify(filters.formats), [filters.formats])
  const tableSizes = useMemo(() => JSON.stringify(filters.tableSizes), [filters.tableSizes])
  const casinos = useMemo(() => JSON.stringify(filters.casinos), [filters.casinos])

  // Reset and fetch first page when filters change
  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    async function fetchFirstPage() {
      setLoading(true)
      setError(null)
      setTournaments([])
      setNextCursor(null)

      try {
        const params = buildSearchParams(filters)
        const res = await fetch(`/api/tournaments?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load')
        const result: PaginatedTournamentsResponse = await res.json()
        if (!controller.signal.aborted) {
          setTournaments(result.data)
          setNextCursor(result.nextCursor)
          setTotalCount(result.totalCount)
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

    fetchFirstPage()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateFrom, filters.dateTo, filters.buyInMin, filters.buyInMax,
      gameTypes, formats, tableSizes, casinos, filters.sortBy,
      filters.startTimeFrom, filters.startTimeTo, filters.avoidTurbos,
      filters.hasGuarantee, filters.guaranteeMin, filters.guaranteeMax])

  // Load more function
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return

    const controller = new AbortController()
    setLoadingMore(true)

    try {
      const params = buildSearchParams(filters, nextCursor)
      const res = await fetch(`/api/tournaments?${params}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Failed to load more')
      const result: PaginatedTournamentsResponse = await res.json()
      if (!controller.signal.aborted) {
        setTournaments(prev => [...prev, ...result.data])
        setNextCursor(result.nextCursor)
        setTotalCount(result.totalCount)
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(String(e))
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false)
      }
    }
  }, [nextCursor, loadingMore, filters])

  return {
    tournaments,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore: nextCursor !== null,
    loadMore,
  }
}
