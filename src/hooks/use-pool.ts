'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PoolDetail } from '@/types'

export function usePool(poolId: string | null) {
  const [pool, setPool] = useState<PoolDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(!!poolId)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!poolId) return
    try {
      const res = await fetch(`/api/pools/${poolId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`)
      setPool(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pool')
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => {
    if (!poolId) return
    setLoading(true)
    refetch()
    // Poll every 30 seconds on the leaderboard page for near-live updates.
    const t = setInterval(refetch, 30_000)
    return () => clearInterval(t)
  }, [poolId, refetch])

  return { pool, loading, error, refetch }
}
