'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { useFavorites } from '@/hooks/use-favorites'
import { useCustomTournaments } from '@/hooks/use-custom-tournaments'
import { ScheduleCalendar } from '@/components/schedule-calendar'
import { TournamentCard } from '@/components/tournament-card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LogIn, Download, CalendarDays, Heart, Share2, Copy, Check, RefreshCw, Plus, Info } from 'lucide-react'
import { OfflineIndicator } from '@/components/offline-indicator'
import { Tournament, CustomTournament, UserScheduleEntry } from '@/types'

export default function SchedulePage() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, error, updateEntry, removeFromSchedule } = useSchedule()
  const { favorites, loading: favLoading } = useFavorites()
  const { customTournaments, loading: customLoading } = useCustomTournaments()

  const loading = userLoading || scheduleLoading || favLoading || customLoading

  // Convert custom tournaments to schedule entry format for unified display
  const customEntries: UserScheduleEntry[] = customTournaments.map((ct) => ({
    id: `custom-${ct.id}`,
    user_id: ct.created_by,
    tournament_id: ct.id,
    entry_number: 1,
    priority: 'target' as const,
    notes: ct.notes,
    created_at: ct.created_at,
    tournament: {
      id: ct.id,
      slug: `custom-${ct.id}`,
      series_id: '',
      event_number: 0,
      name: ct.name,
      date: ct.date,
      day_of_week: ct.day_of_week,
      start_time: ct.start_time,
      buy_in: ct.buy_in,
      game_type: ct.game_type,
      format: ct.format,
      table_size: ct.table_size,
      starting_stack: null,
      blind_levels_minutes: null,
      late_reg_levels: null,
      late_reg_end_time: null,
      guaranteed_prize: ct.guaranteed_prize,
      is_flight: false,
      flight_label: null,
      parent_event_number: null,
      estimated_duration_hours: null,
      notes: null,
      event_category: null,
      created_at: ct.created_at,
      series: { id: '', name: ct.venue_name, venue: ct.venue_name, start_date: '', end_date: '', website_url: null, is_featured: false, created_at: ct.created_at },
    },
  }))

  const allEntries = [...entries, ...customEntries].sort((a, b) => {
    const dateA = a.tournament?.date ?? ''
    const dateB = b.tournament?.date ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    const timeA = a.tournament?.start_time ?? ''
    const timeB = b.tournament?.start_time ?? ''
    return timeA.localeCompare(timeB)
  })

  const [shareEnabled, setShareEnabled] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareOrigin, setShareOrigin] = useState('')

  // Load sharing state from preferences
  useEffect(() => {
    setShareOrigin(window.location.origin)
    async function loadShareState() {
      const res = await fetch('/api/preferences')
      if (res.ok) {
        const prefs = await res.json()
        if (prefs) {
          setShareEnabled(prefs.share_enabled ?? false)
          setShareToken(prefs.share_token ?? null)
        }
      }
    }
    if (user) loadShareState()
  }, [user])

  async function handleShareToggle(enabled: boolean) {
    setShareEnabled(enabled)
    // Load current prefs first to avoid overwriting other fields
    const current = await fetch('/api/preferences')
    const currentPrefs = current.ok ? await current.json() : {}

    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...currentPrefs, share_enabled: enabled }),
    })
    if (res.ok) {
      const prefs = await res.json()
      setShareToken(prefs.share_token)
    }
  }

  async function handleRegenerateLink() {
    const current = await fetch('/api/preferences')
    const currentPrefs = current.ok ? await current.json() : {}

    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...currentPrefs, share_enabled: true, regenerate_token: true }),
    })
    if (res.ok) {
      const prefs = await res.json()
      setShareToken(prefs.share_token)
    }
  }

  function handleCopyLink() {
    if (!shareToken) return
    const url = `${shareOrigin}/shared/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExport() {
    try {
      const res = await fetch('/api/schedule/export')
      if (!res.ok) {
        throw new Error('Failed to export schedule')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'vegas-tournament-schedule.ics'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <CalendarDays className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Sign in to view your schedule</p>
          <p className="text-muted-foreground text-sm mt-1">
            Create an account to save tournaments and build your Vegas schedule.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/schedule">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <OfflineIndicator />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Schedule</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/custom/new">
              <Plus className="size-4 mr-2" />
              Add Tournament
            </Link>
          </Button>
          {allEntries.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-2" />
              Export .ics
            </Button>
          )}
        </div>
      </div>

      {/* Schedule accuracy disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
        <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Schedules are sourced from venue websites and may change without notice. Always confirm details directly with the venue before making travel plans.
        </p>
      </div>

      {/* Share controls */}
      <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
        <Share2 className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Share my schedule</span>
            <Switch checked={shareEnabled} onCheckedChange={handleShareToggle} />
          </div>
          {shareEnabled && shareToken && (
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs bg-muted px-2 py-1 rounded truncate block flex-1">
                {shareOrigin}/shared/{shareToken}
              </code>
              <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" onClick={handleCopyLink}>
                {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2 text-muted-foreground" onClick={handleRegenerateLink} title="Generate new link">
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarDays className="size-4" />
            Schedule
            {allEntries.length > 0 && (
              <span className="text-xs text-muted-foreground">({allEntries.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Heart className="size-4" />
            Favorites
            {favorites.length > 0 && (
              <span className="text-xs text-muted-foreground">({favorites.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleCalendar
            entries={allEntries}
            onUpdateEntry={updateEntry}
            onRemoveEntry={removeFromSchedule}
          />
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="size-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No favorites yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Tap the heart icon on any tournament to save it here.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/browse">Browse Tournaments</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((fav) => (
                fav.tournament && (
                  <TournamentCard
                    key={fav.id}
                    tournament={fav.tournament as Tournament}
                  />
                )
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
