'use client'

import { useEffect, useState } from 'react'
import type { PoolAuditEntry } from '@/types'

export function PoolAuditFeed({ poolId }: { poolId: string }) {
  const [entries, setEntries] = useState<PoolAuditEntry[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/pools/${poolId}/audit`).then(r => r.ok ? r.json() : []).then(setEntries).catch(() => setEntries([]))
  }, [poolId, open])

  return (
    <div className="rounded-xl border border-border p-3 text-xs">
      <button className="font-medium" onClick={() => setOpen(o => !o)}>
        {open ? '▼' : '►'} Audit log ({entries.length} entries)
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-muted-foreground max-h-60 overflow-y-auto">
          {entries.map(e => (
            <li key={e.id}>
              <span className="font-mono">{e.created_at.slice(0, 16).replace('T', ' ')}</span>
              {' — '}
              <span>{e.action}</span>
            </li>
          ))}
          {entries.length === 0 && <li>No entries yet.</li>}
        </ul>
      )}
    </div>
  )
}
