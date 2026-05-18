'use client'

import { useEffect, useState } from 'react'
import type { Pool } from '@/types'

interface MyPoolRow extends Pool {
  is_organizer: boolean
  member_count: number
  alive_count: number
}

export function useMyPools() {
  const [pools, setPools] = useState<MyPoolRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pools/mine')
      .then(r => r.ok ? r.json() : [])
      .then(setPools)
      .catch(() => setPools([]))
      .finally(() => setLoading(false))
  }, [])

  return { pools, loading }
}
