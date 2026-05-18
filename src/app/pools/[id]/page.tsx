'use client'

import { use } from 'react'
import { usePool } from '@/hooks/use-pool'
import { useUser } from '@/hooks/use-user'
import { PoolLeaderboard } from '@/components/pool-leaderboard'
import { PoolOrganizerPanel } from '@/components/pool-organizer-panel'
import { PoolAuditFeed } from '@/components/pool-audit-feed'
import { Badge } from '@/components/ui/badge'

export default function PoolDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useUser()
  const { pool, loading, error, refetch } = usePool(id)

  if (loading) return <div className="p-6">Loading pool…</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!pool) return <div className="p-6">Pool not found.</div>

  const tournamentName = pool.tournament?.name ?? pool.custom_tournament?.name ?? 'Tournament'
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        <p className="text-sm text-muted-foreground">{tournamentName}</p>
        <div className="flex gap-2">
          <Badge variant="outline">{pool.status}</Badge>
          <Badge variant="outline">{pool.alive_count}/{pool.total_count} alive</Badge>
        </div>
      </header>

      <div className="text-xs text-muted-foreground">
        Re-entries: {pool.reentries_keep_alive ? 'alive' : 'final'} ·
        Multi-flight: {pool.multiflight_out_rule === 'last_flight' ? 'last flight' : 'first flight'} ·
        {pool.start_after_reentry_period ? ' Tracking after re-entry close' : ' Tracking from start'}
      </div>

      <PoolLeaderboard pool={pool} currentUserId={user?.id ?? ''} onRefetch={refetch} />

      {pool.is_organizer && <PoolOrganizerPanel pool={pool} onRefetch={refetch} />}

      <PoolAuditFeed poolId={pool.id} />
    </div>
  )
}
