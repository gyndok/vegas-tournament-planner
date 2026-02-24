'use client'

import { useState, useEffect, useCallback } from 'react'

interface FavoriteEntry {
  id: string
  tournament_id: string
  created_at: string
  tournament?: any
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/favorites')
      if (res.status === 401) {
        setFavorites([])
        setLoading(false)
        return
      }
      if (!res.ok) {
        throw new Error('Failed to fetch favorites')
      }
      const data = await res.json()
      setFavorites(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const toggleFavorite = useCallback(
    async (tournamentId: string) => {
      // Optimistic update
      const isFavorited = favorites.some(f => f.tournament_id === tournamentId)

      if (isFavorited) {
        setFavorites(prev => prev.filter(f => f.tournament_id !== tournamentId))
      } else {
        setFavorites(prev => [
          { id: 'optimistic', tournament_id: tournamentId, created_at: new Date().toISOString() },
          ...prev,
        ])
      }

      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournament_id: tournamentId }),
        })
        if (!res.ok) throw new Error('Failed to toggle favorite')
        // Refetch to get accurate data
        await fetchFavorites()
      } catch {
        // Revert optimistic update on error
        await fetchFavorites()
      }
    },
    [favorites, fetchFavorites]
  )

  const isFavorited = useCallback(
    (tournamentId: string) => favorites.some(f => f.tournament_id === tournamentId),
    [favorites]
  )

  return {
    favorites,
    loading,
    error,
    toggleFavorite,
    isFavorited,
    refetch: fetchFavorites,
  }
}
