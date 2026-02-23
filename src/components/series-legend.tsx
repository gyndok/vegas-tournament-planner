'use client'

import { SERIES_COLORS } from '@/types'

export function SeriesLegend() {
  const entries = Object.entries(SERIES_COLORS).filter(([key]) => key !== 'default')

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Series Colors
      </h3>
      <div className="space-y-1.5">
        {entries.map(([key, colors]) => (
          <div key={key} className="flex items-center gap-2.5">
            <div className={`size-2.5 rounded-full ${colors.dot}`} />
            <span className="text-sm text-foreground">{colors.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
