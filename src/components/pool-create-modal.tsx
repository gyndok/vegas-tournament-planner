'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Info } from 'lucide-react'

interface Props {
  tournamentId?: string
  customTournamentId?: string
  defaultName: string
  triggerLabel?: string
  onCreated: (poolId: string, inviteToken: string) => void
}

export function PoolCreateModal({ tournamentId, customTournamentId, defaultName, triggerLabel, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [reentries, setReentries] = useState(true)
  const [trackAfterRebuy, setTrackAfterRebuy] = useState(false)
  const [multiflight, setMultiflight] = useState<'first_flight' | 'last_flight'>('last_flight')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pool_type: tournamentId ? 'official' : 'home_game',
          tournament_id: tournamentId ?? null,
          custom_tournament_id: customTournamentId ?? null,
          reentries_keep_alive: reentries,
          start_after_reentry_period: trackAfterRebuy,
          multiflight_out_rule: multiflight,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create pool')
      onCreated(data.id, data.invite_token)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{triggerLabel ?? 'Create Last Longer Pool'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Last Longer Pool</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <a
            href="/faq#last-longer-pools"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm hover:bg-primary/10"
          >
            <Info className="size-4 mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">New to Last Longer Pools?</span>{' '}
              <span className="text-muted-foreground">
                Read how they work and what organizers handle (NextRebuy doesn&apos;t collect or pay out money — all buy-ins and payouts are handled by you outside the app).
              </span>
            </span>
          </a>
          <label className="block text-sm">
            Pool name
            <Input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reentries} onChange={e => setReentries(e.target.checked)} />
            Re-entries keep you alive
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={trackAfterRebuy} onChange={e => setTrackAfterRebuy(e.target.checked)} />
            Start tracking after re-entry period closes
          </label>
          <label className="block text-sm">
            Multi-flight rule
            <select value={multiflight} onChange={e => setMultiflight(e.target.value as 'first_flight' | 'last_flight')} className="block w-full rounded border bg-background px-2 py-1">
              <option value="last_flight">Out only after last flight bust</option>
              <option value="first_flight">Out on first flight bust</option>
            </select>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create pool'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
