'use client'

import { useState, useEffect, useCallback } from 'react'
import { TournamentResult } from '@/types'

export function useResults() {
  const [results, setResults] = useState<TournamentResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/results')
      if (res.status === 401) {
        setResults([])
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch results')
      const data = await res.json()
      setResults(data)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const createResult = useCallback(async (data: {
    schedule_entry_id: string
    result_amount: number
    finish_position?: number | null
    notes?: string | null
  }) => {
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to create result')
    }
    await fetchResults()
  }, [fetchResults])

  const updateResult = useCallback(async (id: string, updates: {
    result_amount?: number
    finish_position?: number | null
    notes?: string | null
  }) => {
    const res = await fetch('/api/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to update result')
    }
    await fetchResults()
  }, [fetchResults])

  const deleteResult = useCallback(async (id: string) => {
    const res = await fetch(`/api/results?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to delete result')
    }
    await fetchResults()
  }, [fetchResults])

  const getResultForEntry = useCallback((scheduleEntryId: string) => {
    return results.find(r => r.schedule_entry_id === scheduleEntryId) ?? null
  }, [results])

  return { results, loading, createResult, updateResult, deleteResult, getResultForEntry, refetch: fetchResults }
}
