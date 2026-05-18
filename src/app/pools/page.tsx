'use client'

import Link from 'next/link'
import { useMyPools } from '@/hooks/use-my-pools'
import { Badge } from '@/components/ui/badge'

export default function MyPoolsPage() {
  const { pools, loading } = useMyPools()
  if (loading) return <div className="p-6">Loading…</div>

  if (pools.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-muted-foreground">
        You haven&apos;t joined any pools yet. Create one from a tournament page.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
      <h1 className="text-2xl font-bold">My Last Longer Pools</h1>
      {pools.map(p => (
        <Link key={p.id} href={`/pools/${p.id}`} className="block rounded-xl border border-border p-4 hover:bg-accent">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.alive_count}/{p.member_count} alive · {p.status}
                {p.is_organizer ? ' · You are the organizer' : ''}
              </div>
            </div>
            <Badge variant="outline">{p.status}</Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}
