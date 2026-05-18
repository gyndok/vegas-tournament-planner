'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PoolDetail } from '@/types'

interface Props {
  pool: PoolDetail
  onRefetch: () => void
}

export function PoolOrganizerPanel({ pool, onRefetch }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [winnerId, setWinnerId] = useState<string>('')

  async function call(path: string, body?: object) {
    setBusy(path)
    try {
      await fetch(`/api/pools/${pool.id}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
    } finally {
      setBusy(null)
      onRefetch()
    }
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}/pools/join/${pool.invite_token}`
    await navigator.clipboard.writeText(url)
  }

  const aliveMembers = pool.members.filter(m => m.status === 'alive')

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Organizer controls</h3>
      <div className="flex flex-wrap gap-2">
        {pool.status === 'open' && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('lock')}>Lock pool</Button>
        )}
        {pool.status === 'locked' && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('start')}>Start pool</Button>
        )}
        {pool.status !== 'ended' && pool.status !== 'cancelled' && (
          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => {
            if (confirm('Cancel this pool?')) call('cancel')
          }}>Cancel pool</Button>
        )}
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call('rotate-token')}>Rotate invite token</Button>
        <Button size="sm" variant="outline" onClick={copyInviteLink}>Copy invite link</Button>
      </div>

      {pool.status === 'live' || pool.status === 'locked' ? (
        <div className="space-y-2 border-t pt-3">
          <label className="text-xs font-medium">Declare winner</label>
          <select
            value={winnerId}
            onChange={e => setWinnerId(e.target.value)}
            className="w-full rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">Pick a member…</option>
            {aliveMembers.length > 0 ? (
              <optgroup label="Alive">
                {aliveMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.resolved_display_name ?? 'Player'}</option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All members">
              {pool.members.map(m => (
                <option key={m.id} value={m.id}>{m.resolved_display_name ?? 'Player'} ({m.status})</option>
              ))}
            </optgroup>
          </select>
          <Button
            size="sm"
            disabled={!winnerId || !!busy}
            onClick={() => call('declare-winner', { member_id: winnerId })}
          >
            Confirm winner
          </Button>
        </div>
      ) : null}
    </div>
  )
}
