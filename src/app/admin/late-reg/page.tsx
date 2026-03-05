'use client'

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Timer, Save, Loader2, Filter, CheckCircle } from 'lucide-react'
import { formatDate, formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'

interface TournamentRow {
  id: string
  name: string
  date: string
  start_time: string
  buy_in: number
  game_type: string
  starting_stack: number | null
  blind_levels_minutes: number | null
  late_reg_levels: number | null
  late_reg_end_time: string | null
  series: { id: string; name: string; venue: string } | null
}

interface EditedFields {
  blind_levels_minutes?: number | null
  late_reg_levels?: number | null
  starting_stack?: number | null
}

function isAdmin(email: string | undefined | null): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails || !email) return false
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}

export default function AdminLateRegPage() {
  const { user, loading: userLoading } = useUser()
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, EditedFields>>({})
  const [missingOnly, setMissingOnly] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchTournaments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (missingOnly) params.set('missing', 'true')
      const res = await fetch(`/api/admin/late-reg?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTournaments(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [missingOnly])

  useEffect(() => {
    if (user && isAdmin(user.email)) {
      fetchTournaments()
    }
  }, [user, fetchTournaments])

  function handleEdit(id: string, field: keyof EditedFields, value: string) {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value === '' ? null : parseInt(value),
      },
    }))
  }

  async function handleSave() {
    const updates = Object.entries(edits)
      .filter(([, fields]) => Object.keys(fields).length > 0)
      .map(([id, fields]) => ({ id, ...fields }))

    if (updates.length === 0) return

    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/late-reg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedback({ type: 'success', message: `Updated ${data.updated} tournaments.` })
        setEdits({})
        fetchTournaments()
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to save.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="size-6 animate-spin" /></div>
  }

  if (!user || !isAdmin(user.email)) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Unauthorized</div>
  }

  const editCount = Object.keys(edits).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="size-6" />
            Late Registration Editor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fill in blind level duration and late reg levels for tournaments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMissingOnly(!missingOnly)}
          >
            <Filter className="size-4 mr-1" />
            {missingOnly ? 'Missing Only' : 'All'}
          </Button>
          {editCount > 0 && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
              Save {editCount} {editCount === 1 ? 'change' : 'changes'}
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`rounded-md border p-3 text-sm flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {feedback.type === 'success' && <CheckCircle className="size-4" />}
          {feedback.message}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {missingOnly ? 'All tournaments have late reg data!' : 'No tournaments found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Tournament</th>
                    <th className="text-left py-3 px-3 font-medium w-24">Date</th>
                    <th className="text-left py-3 px-3 font-medium w-20">Time</th>
                    <th className="text-left py-3 px-3 font-medium w-20">Buy-in</th>
                    <th className="text-center py-3 px-3 font-medium w-24">Blind Lvl (min)</th>
                    <th className="text-center py-3 px-3 font-medium w-24">Late Reg Lvls</th>
                    <th className="text-center py-3 px-3 font-medium w-28">Starting Stack</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => {
                    const seriesName = t.series?.name ?? ''
                    const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
                    const edited = edits[t.id] || {}
                    return (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`shrink-0 text-[10px] ${colors.bg} ${colors.text} border-0`}>
                              {colors.label}
                            </Badge>
                            <span className="truncate max-w-[250px]">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(t.date)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatTime(t.start_time)}</td>
                        <td className="py-2 px-3 font-medium">{formatBuyIn(t.buy_in)}</td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            className="h-8 w-20 mx-auto text-center"
                            placeholder={t.blind_levels_minutes?.toString() ?? '—'}
                            value={edited.blind_levels_minutes !== undefined
                              ? (edited.blind_levels_minutes?.toString() ?? '')
                              : (t.blind_levels_minutes?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'blind_levels_minutes', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            className="h-8 w-20 mx-auto text-center"
                            placeholder={t.late_reg_levels?.toString() ?? '—'}
                            value={edited.late_reg_levels !== undefined
                              ? (edited.late_reg_levels?.toString() ?? '')
                              : (t.late_reg_levels?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'late_reg_levels', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1000"
                            className="h-8 w-24 mx-auto text-center"
                            placeholder={t.starting_stack?.toString() ?? '—'}
                            value={edited.starting_stack !== undefined
                              ? (edited.starting_stack?.toString() ?? '')
                              : (t.starting_stack?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'starting_stack', e.target.value)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {tournaments.length} tournaments. {missingOnly ? 'Filtered to those missing late reg data.' : 'Showing all.'}
      </p>
    </div>
  )
}
