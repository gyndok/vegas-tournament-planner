'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from './use-user'

export interface UserPreferences {
  trip_start: string | null
  trip_end: string | null
  trip_budget: number | null
  buy_in_min: number | null
  buy_in_max: number | null
  preferred_games: string[]
  preferred_formats: string[]
  preferred_start_time_earliest: string | null
  preferred_start_time_latest: string | null
  avoid_turbos: boolean
}

export function usePreferences() {
  const { user } = useUser()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/preferences')
      if (res.status === 401) {
        setPreferences(null)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch preferences')
      const data = await res.json()
      setPreferences(data)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  return { preferences, loading, refetch: fetchPreferences }
}
