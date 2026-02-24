'use client'

import { useState, useEffect, useCallback } from 'react'
import { CustomTournament } from '@/types'

export function useCustomTournaments() {
  const [customTournaments, setCustomTournaments] = useState<CustomTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomTournaments = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/custom-tournaments')
      if (res.status === 401) {
        setCustomTournaments([])
        setLoading(false)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch custom tournaments')
      }
      const data = await res.json()
      setCustomTournaments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomTournaments()
  }, [fetchCustomTournaments])

  const createCustomTournament = useCallback(
    async (tournament: Omit<CustomTournament, 'id' | 'created_by' | 'status' | 'approved_tournament_id' | 'day_of_week' | 'created_at'>) => {
      const res = await fetch('/api/custom-tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournament),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create custom tournament')
      }
      await fetchCustomTournaments()
    },
    [fetchCustomTournaments]
  )

  const deleteCustomTournament = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/custom-tournaments?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      await fetchCustomTournaments()
    },
    [fetchCustomTournaments]
  )

  return {
    customTournaments,
    loading,
    error,
    createCustomTournament,
    deleteCustomTournament,
    refetch: fetchCustomTournaments,
  }
}
