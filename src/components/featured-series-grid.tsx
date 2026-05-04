'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Series } from '@/types'
import { formatDate, getSeriesColor } from '@/lib/utils'

interface FeaturedSeriesGridProps {
  title?: string
  className?: string
}

export function FeaturedSeriesGrid({
  title = '2026 Summer Series',
  className,
}: FeaturedSeriesGridProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/series/featured')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Series[]) => {
        if (!cancelled) setSeries(data)
      })
      .catch(() => {
        if (!cancelled) setSeries([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className={className}>
        <h2 className="text-2xl font-bold tracking-tight text-center mb-6">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (series.length === 0) return null

  return (
    <section className={className}>
      <h2 className="text-2xl font-bold tracking-tight text-center mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {series.map((s) => {
          const colors = getSeriesColor(s.name, s.venue)
          return (
            <a
              key={s.id}
              href={s.website_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${colors.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{colors.label}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(s.start_date)} – {formatDate(s.end_date)}
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
            </a>
          )
        })}
      </div>
    </section>
  )
}
