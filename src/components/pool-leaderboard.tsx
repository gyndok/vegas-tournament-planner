'use client'

import { useState } from 'react'
import type { PoolDetail, PoolMember } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBuyIn } from '@/lib/utils'

interface Props {
  pool: PoolDetail
  currentUserId: string
  onRefetch: () => void
}

export function PoolLeaderboard({ pool, currentUserId, onRefetch }: Props) {
  const isOrganizer = pool.is_organizer
  const sorted = [...pool.members].sort((a, b) => {
    const rank = (m: PoolMember) =>
      m.status === 'alive' ? 0 : m.status === 'busted' ? 1 : 2
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.status === 'alive') return (b.current_chips ?? 0) - (a.current_chips ?? 0)
    if (a.status === 'busted') return (a.busted_at ?? '').localeCompare(b.busted_at ?? '')
    return 0
  })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground uppercase">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Chips</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">{isOrganizer ? 'Manage' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(m => (
            <Row
              key={m.id}
              poolId={pool.id}
              member={m}
              isSelf={m.user_id === currentUserId}
              isOrganizer={isOrganizer}
              onRefetch={onRefetch}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  poolId, member, isSelf, isOrganizer, onRefetch,
}: { poolId: string; member: PoolMember; isSelf: boolean; isOrganizer: boolean; onRefetch: () => void }) {
  const [chips, setChips] = useState<string>(member.current_chips != null ? String(member.current_chips) : '')
  const [saving, setSaving] = useState(false)

  async function updateChips() {
    if (!isSelf && !isOrganizer) return
    const value = chips.trim() === '' ? null : Number(chips.replace(/,/g, ''))
    if (value !== null && (Number.isNaN(value) || value < 0)) return
    setSaving(true)
    await fetch(`/api/pools/${poolId}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_chips: value }),
    }).catch(() => {})
    setSaving(false)
    onRefetch()
  }

  async function bust() {
    await fetch(`/api/pools/${poolId}/members/${member.id}/bust`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  async function unbust() {
    await fetch(`/api/pools/${poolId}/members/${member.id}/unbust`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  async function toggleVerified() {
    const path = member.verified ? 'unverify' : 'verify'
    await fetch(`/api/pools/${poolId}/members/${member.id}/${path}`, { method: 'POST' }).catch(() => {})
    onRefetch()
  }

  const status = member.status
  const statusBadge =
    status === 'alive' ? <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Alive</Badge> :
    status === 'busted' ? <Badge variant="outline">Out #{member.bust_order ?? '?'}</Badge> :
    <Badge variant="outline" className="text-muted-foreground">No-show</Badge>

  return (
    <tr className={`border-t border-border ${isSelf ? 'bg-primary/5' : ''}`}>
      <td className="px-3 py-2 text-xs text-muted-foreground">{member.bust_order ?? '—'}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{member.resolved_display_name ?? 'Player'}</span>
        {!member.verified && <span className="ml-2 text-[10px] uppercase text-amber-600">Unverified</span>}
        {member.verified && <span className="ml-2 text-[10px] uppercase text-emerald-600">✓ Verified</span>}
      </td>
      <td className="px-3 py-2">
        {isSelf || isOrganizer ? (
          <div className="flex items-center gap-1">
            <Input value={chips} onChange={e => setChips(e.target.value)} className="h-7 w-24 text-sm" disabled={saving || status !== 'alive'} />
            <Button size="sm" variant="outline" onClick={updateChips} disabled={saving || status !== 'alive'}>Save</Button>
          </div>
        ) : (
          <span>{member.current_chips != null ? formatBuyIn(member.current_chips).replace('$', '') : '—'}</span>
        )}
      </td>
      <td className="px-3 py-2">{statusBadge}</td>
      <td className="px-3 py-2 text-right space-x-1">
        {isSelf && status === 'alive' && (
          <Button size="sm" variant="destructive" onClick={bust}>I busted</Button>
        )}
        {isOrganizer && status === 'busted' && (
          <Button size="sm" variant="outline" onClick={unbust}>Un-bust</Button>
        )}
        {isOrganizer && status === 'alive' && !isSelf && (
          <Button size="sm" variant="outline" onClick={bust}>Bust them</Button>
        )}
        {isOrganizer && (
          <Button size="sm" variant="outline" onClick={toggleVerified}>{member.verified ? 'Unverify' : 'Verify'}</Button>
        )}
      </td>
    </tr>
  )
}
