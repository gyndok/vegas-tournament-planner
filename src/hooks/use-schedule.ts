'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserScheduleEntry } from '@/types'

export function useSchedule() {
  const [entries, setEntries] = useState<UserScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedule = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/schedule')
      if (res.status === 401) {
        setEntries([])
        setLoading(false)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch schedule')
      }
      const data = await res.json()
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedule')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  const addToSchedule = useCallback(
    async (tournamentId: string, priority: 'target' | 'backup' | 'maybe', notes?: string) => {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId, priority, notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add to schedule')
      }
      await fetchSchedule()
    },
    [fetchSchedule]
  )

  const removeFromSchedule = useCallback(
    async (entryId: string) => {
      const res = await fetch(`/api/schedule?id=${entryId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove from schedule')
      }
      await fetchSchedule()
    },
    [fetchSchedule]
  )

  const updateEntry = useCallback(
    async (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe'; notes?: string }) => {
      const res = await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, ...updates }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update entry')
      }
      await fetchSchedule()
    },
    [fetchSchedule]
  )

  return {
    entries,
    loading,
    error,
    addToSchedule,
    removeFromSchedule,
    updateEntry,
    refetch: fetchSchedule,
  }
}
