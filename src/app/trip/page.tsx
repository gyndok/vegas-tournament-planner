'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { useResults } from '@/hooks/use-results'
import { Tournament, UserPreferences } from '@/types'
import { TripDayCard } from '@/components/trip-day-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatBuyIn } from '@/lib/utils'
import { Plane, LogIn, Settings, CalendarDays, Loader2, Trophy } from 'lucide-react'

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const current = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (current <= last) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default function TripPage() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, addToSchedule, removeFromSchedule, reenterTournament } = useSchedule()
  const { results, loading: resultsLoading, createResult, updateResult, deleteResult, getResultForEntry } = useResults()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(false)

  // Load preferences
  useEffect(() => {
    if (!user) {
      setPrefsLoading(false)
      return
    }
    async function loadPrefs() {
      try {
        const res = await fetch('/api/preferences')
        if (res.ok) {
          const data = await res.json()
          setPrefs(data)
        }
      } catch {
        // Ignore
      } finally {
        setPrefsLoading(false)
      }
    }
    loadPrefs()
  }, [user])

  const tripStart = prefs?.trip_start
  const tripEnd = prefs?.trip_end
  const tripBudget = prefs?.trip_budget
  const hasTrip = tripStart && tripEnd

  // Load available tournaments for trip dates
  useEffect(() => {
    if (!hasTrip) return
    async function loadTournaments() {
      setTournamentsLoading(true)
      try {
        const params = new URLSearchParams({
          dateFrom: tripStart!,
          dateTo: tripEnd!,
          limit: '500',
        })
        const res = await fetch(`/api/tournaments?${params}`)
        if (res.ok) {
          const result = await res.json()
          setAllTournaments(result.data || [])
        }
      } catch {
        // Ignore
      } finally {
        setTournamentsLoading(false)
      }
    }
    loadTournaments()
  }, [hasTrip, tripStart, tripEnd])

  // Compute trip days
  const tripDays = useMemo(() => {
    if (!tripStart || !tripEnd) return []
    return getDaysBetween(tripStart, tripEnd)
  }, [tripStart, tripEnd])

  // Scheduled tournament IDs for quick lookup
  const scheduledTournamentIds = useMemo(
    () => new Set(entries.map((e) => e.tournament_id)),
    [entries]
  )

  // Filter entries to trip date range
  const tripEntries = useMemo(
    () => entries.filter((e) => {
      const d = e.tournament?.date
      return d && d >= tripStart! && d <= tripEnd!
    }),
    [entries, tripStart, tripEnd]
  )

  // Budget computation
  const totalCommitted = useMemo(
    () => tripEntries.reduce((sum, e) => sum + (e.tournament?.buy_in ?? 0), 0),
    [tripEntries]
  )

  const budgetPercent = tripBudget ? Math.min((totalCommitted / tripBudget) * 100, 100) : 0
  const budgetColor = budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'

  // Results computation
  const tripResults = useMemo(() => {
    const tripEntryIds = new Set(tripEntries.map(e => e.id))
    return results.filter(r => tripEntryIds.has(r.schedule_entry_id))
  }, [results, tripEntries])

  const totalBuyInsPlayed = useMemo(
    () => tripResults.reduce((sum, r) => {
      const entry = tripEntries.find(e => e.id === r.schedule_entry_id)
      return sum + (entry?.tournament?.buy_in ?? 0)
    }, 0),
    [tripResults, tripEntries]
  )

  const totalCashOut = useMemo(
    () => tripResults.reduce((sum, r) => sum + r.result_amount, 0),
    [tripResults]
  )

  const netPL = totalCashOut - totalBuyInsPlayed
  const roi = totalBuyInsPlayed > 0 ? ((netPL / totalBuyInsPlayed) * 100) : 0

  // Quick add handler
  const handleQuickAdd = useCallback(async (tournamentId: string) => {
    await addToSchedule(tournamentId, 'target')
  }, [addToSchedule])

  // Result handlers
  const handleLogResult = useCallback(async (scheduleEntryId: string, data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => {
    await createResult({ schedule_entry_id: scheduleEntryId, ...data })
  }, [createResult])

  const handleUpdateResult = useCallback(async (resultId: string, data: { result_amount?: number; finish_position?: number | null; notes?: string | null }) => {
    await updateResult(resultId, data)
  }, [updateResult])

  const handleDeleteResult = useCallback(async (resultId: string) => {
    await deleteResult(resultId)
  }, [deleteResult])

  const loading = userLoading || prefsLoading || scheduleLoading || resultsLoading

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
        <Plane className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Sign in to plan your trip</p>
          <p className="text-muted-foreground text-sm mt-1">
            Create an account to build your Vegas tournament itinerary.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/trip">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  if (!hasTrip) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Plane className="size-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">Set your trip dates</p>
            <p className="text-muted-foreground text-sm mt-1">
              Head to Settings to enter your Vegas arrival and departure dates.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings">
              <Settings className="size-4 mr-2" />
              Go to Settings
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Trip Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="size-6" />
              Trip Planner
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateDisplay(tripStart)} — {formatDateDisplay(tripEnd)} · {tripDays.length} day{tripDays.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              <Settings className="size-4 mr-1" />
              Edit Trip
            </Link>
          </Button>
        </div>

        {/* Budget bar */}
        {tripBudget ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">{formatBuyIn(totalCommitted)} committed</span>
              <span className="text-muted-foreground">of {formatBuyIn(tripBudget)} budget</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${budgetColor}`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            {tripBudget - totalCommitted > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {formatBuyIn(tripBudget - totalCommitted)} remaining
              </p>
            ) : (
              <p className="text-xs text-red-500 mt-1">
                Budget exceeded by {formatBuyIn(totalCommitted - tripBudget)}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              {tripEntries.length > 0 && (
                <span>{formatBuyIn(totalCommitted)} in buy-ins · </span>
              )}
              <Link href="/settings" className="text-primary hover:underline">Set a budget</Link> to track spending.
            </p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {tripResults.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Trophy className="size-4 text-primary" />
            Results
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className={`text-xl font-bold ${netPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {netPL >= 0 ? '+' : ''}{formatBuyIn(netPL)}
              </p>
              <p className="text-xs text-muted-foreground">Net P&L</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{tripResults.length}/{tripEntries.length}</p>
              <p className="text-xs text-muted-foreground">Played</p>
            </div>
            <div className="text-center">
              <p className={`text-xl font-bold ${roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">ROI</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripEntries.length}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripDays.filter(d => tripEntries.some(e => e.tournament?.date === d)).length}</p>
            <p className="text-xs text-muted-foreground">Days Playing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{tripDays.length - tripDays.filter(d => tripEntries.some(e => e.tournament?.date === d)).length}</p>
            <p className="text-xs text-muted-foreground">Free Days</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily itinerary */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="size-5" />
          Daily Itinerary
        </h2>

        {tournamentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {tripDays.map((day, index) => {
              const dayEntries = tripEntries
                .filter((e) => e.tournament?.date === day)
                .sort((a, b) => (a.tournament?.start_time || '').localeCompare(b.tournament?.start_time || ''))

              const dayAvailable = allTournaments
                .filter((t) => t.date === day && !scheduledTournamentIds.has(t.id))
                .sort((a, b) => a.start_time.localeCompare(b.start_time))

              return (
                <TripDayCard
                  key={day}
                  date={day}
                  dayLabel={getDayLabel(day)}
                  dayNumber={index + 1}
                  scheduledEntries={dayEntries}
                  availableTournaments={dayAvailable}
                  onQuickAdd={handleQuickAdd}
                  onRemove={removeFromSchedule}
                  onReenter={async (tournamentId) => {
                    try {
                      await reenterTournament(tournamentId)
                    } catch {
                      // silently handle
                    }
                  }}
                  getResultForEntry={getResultForEntry}
                  onLogResult={handleLogResult}
                  onUpdateResult={handleUpdateResult}
                  onDeleteResult={handleDeleteResult}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
