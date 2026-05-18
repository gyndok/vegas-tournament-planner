'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tournament } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Timer } from 'lucide-react'
import { LateRegBadge } from '@/components/late-reg-badge'
import { formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

function getTodayVegas(): string {
  const now = new Date()
  const vegas = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const y = vegas.getFullYear()
  const m = String(vegas.getMonth() + 1).padStart(2, '0')
  const d = String(vegas.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function hasActiveLateReg(t: Tournament): boolean {
  const now = new Date()
  const vegasNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))

  let endTime: Date | null = null

  if (t.late_reg_end_time) {
    endTime = new Date(`${t.date}T${t.late_reg_end_time}`)
  } else if (t.late_reg_levels && t.blind_levels_minutes && t.start_time) {
    const start = new Date(`${t.date}T${t.start_time}`)
    endTime = new Date(start.getTime() + t.late_reg_levels * t.blind_levels_minutes * 60 * 1000)
  }

  if (!endTime) return false

  const fourHours = 4 * 60 * 60 * 1000
  const remaining = endTime.getTime() - vegasNow.getTime()
  return remaining > 0 && remaining <= fourHours
}

function getEndMs(t: Tournament): number {
  if (t.late_reg_end_time) {
    return new Date(`${t.date}T${t.late_reg_end_time}`).getTime()
  }
  if (t.late_reg_levels && t.blind_levels_minutes && t.start_time) {
    const start = new Date(`${t.date}T${t.start_time}`)
    return start.getTime() + t.late_reg_levels * t.blind_levels_minutes * 60 * 1000
  }
  return Infinity
}

export function ClosingSoonWidget() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTodaysTournaments() {
      const today = getTodayVegas()
      const supabase = createClient()

      const { data } = await supabase
        .from('tournaments')
        .select('*, series:series_id(*)')
        .eq('date', today)
        .not('late_reg_levels', 'is', null)
        .order('start_time', { ascending: true })

      if (data) {
        const active = (data as Tournament[]).filter(hasActiveLateReg)
        active.sort((a, b) => getEndMs(a) - getEndMs(b))
        setTournaments(active)
      }
      setLoading(false)
    }

    fetchTodaysTournaments()
    const interval = setInterval(fetchTodaysTournaments, 120_000)
    return () => clearInterval(interval)
  }, [])

  if (loading || tournaments.length === 0) return null

  return (
    <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="size-4 text-amber-600 dark:text-amber-400" />
          Late Reg Closing Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tournaments.map((t) => {
            const seriesName = t.series?.name ?? ''
            const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
            return (
              <Link
                key={t.id}
                href={`/tournament/${t.slug ?? t.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{formatTime(t.start_time)}</span>
                    <span>&middot;</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatBuyIn(t.buy_in)}
                    </span>
                  </div>
                </div>
                <LateRegBadge tournament={t} size="sm" />
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
