'use client'

import { useRouter } from 'next/navigation'
import { PoolCreateModal } from '@/components/pool-create-modal'

interface Props {
  tournamentId?: string
  customTournamentId?: string
  defaultName: string
  triggerLabel?: string
}

export function PoolCreateCta({ tournamentId, customTournamentId, defaultName, triggerLabel }: Props) {
  const router = useRouter()
  return (
    <PoolCreateModal
      tournamentId={tournamentId}
      customTournamentId={customTournamentId}
      defaultName={defaultName}
      triggerLabel={triggerLabel}
      onCreated={(poolId) => router.push(`/pools/${poolId}`)}
    />
  )
}
