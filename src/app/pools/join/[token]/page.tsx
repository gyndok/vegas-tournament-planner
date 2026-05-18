'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Info } from 'lucide-react'

interface PoolMeta {
  id: string
  name: string
  pool_type: 'official' | 'home_game'
  status: string
  tournament?: { name: string; date: string; venue?: { venue?: string } } | null
  custom_tournament?: { name: string; date: string } | null
  member_count: number
}

export default function PoolJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [meta, setMeta] = useState<PoolMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/pools/by-token/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error ?? `${r.status}`) }))
      .then(setMeta)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  async function join() {
    setJoining(true)
    setError(null)
    try {
      const res = await fetch(`/api/pools/by-token/${token}/join`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join')
      router.push(`/pools/${data.pool_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setJoining(false)
    }
  }

  if (loading || userLoading) return <div className="p-6">Loading…</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!meta) return <div className="p-6">Pool not found.</div>

  const tournamentLine = meta.tournament?.name ?? meta.custom_tournament?.name ?? 'Tournament'
  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">Join Last Longer Pool</h1>
      <a
        href="/faq#last-longer-pools"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm hover:bg-primary/10"
      >
        <Info className="size-4 mt-0.5 shrink-0 text-primary" />
        <span>
          <span className="font-medium text-foreground">How Last Longer Pools work.</span>{' '}
          <span className="text-muted-foreground">
            NextRebuy tracks the standings — it doesn&apos;t handle money. Settle buy-ins and payouts directly with the pool organizer.
          </span>
        </span>
      </a>
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="text-lg font-semibold">{meta.name}</div>
        <div className="text-sm text-muted-foreground">{tournamentLine}</div>
        <div className="text-xs text-muted-foreground">{meta.member_count} member{meta.member_count === 1 ? '' : 's'} so far</div>
      </div>
      {!user ? (
        <div className="space-y-2">
          <p className="text-sm">Sign in or create an account to join.</p>
          <Button asChild>
            <Link href={`/login?next=/pools/join/${token}`}>Sign in / create account</Link>
          </Button>
        </div>
      ) : (
        <Button disabled={joining} onClick={join}>{joining ? 'Joining…' : 'Join pool'}</Button>
      )}
    </div>
  )
}
