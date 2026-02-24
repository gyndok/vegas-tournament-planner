'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { UserPreferences } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { LogIn, Save, Check, AlertCircle } from 'lucide-react'

const GAME_OPTIONS = ['NLH', 'PLO', 'PLO8', 'Mixed', 'Stud', 'Razz', 'HORSE', 'Omaha Hi-Lo', 'Limit Hold\'em']
const FORMAT_OPTIONS = ['Freezeout', 'Re-entry', 'Rebuy', 'Turbo', 'Super Turbo', 'Bounty', 'Mystery Bounty', 'Satellite', 'Mega Satellite', 'Deep Stack']

export default function SettingsPage() {
  const { user, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [buyInMin, setBuyInMin] = useState<string>('')
  const [buyInMax, setBuyInMax] = useState<string>('')
  const [preferredGames, setPreferredGames] = useState<string[]>([])
  const [preferredFormats, setPreferredFormats] = useState<string[]>([])
  const [earliestStart, setEarliestStart] = useState<string>('')
  const [latestStart, setLatestStart] = useState<string>('')
  const [avoidTurbos, setAvoidTurbos] = useState(false)
  const [tripStart, setTripStart] = useState<string>('')
  const [tripEnd, setTripEnd] = useState<string>('')
  const [tripBudget, setTripBudget] = useState<string>('')

  const loadPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences')
      if (res.ok) {
        const data: UserPreferences | null = await res.json()
        if (data) {
          setBuyInMin(data.buy_in_min?.toString() ?? '')
          setBuyInMax(data.buy_in_max?.toString() ?? '')
          setPreferredGames(data.preferred_games ?? [])
          setPreferredFormats(data.preferred_formats ?? [])
          setEarliestStart(data.preferred_start_time_earliest ?? '')
          setLatestStart(data.preferred_start_time_latest ?? '')
          setAvoidTurbos(data.avoid_turbos ?? false)
          setTripStart(data.trip_start ?? '')
          setTripEnd(data.trip_end ?? '')
          setTripBudget(data.trip_budget?.toString() ?? '')
        }
      }
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadPreferences()
    } else if (!userLoading) {
      setLoading(false)
    }
  }, [user, userLoading, loadPreferences])

  function toggleItem(list: string[], item: string, setter: (val: string[]) => void) {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item))
    } else {
      setter([...list, item])
    }
  }

  async function handleSave() {
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buy_in_min: buyInMin ? Number(buyInMin) : null,
          buy_in_max: buyInMax ? Number(buyInMax) : null,
          preferred_games: preferredGames,
          preferred_formats: preferredFormats,
          preferred_start_time_earliest: earliestStart || null,
          preferred_start_time_latest: latestStart || null,
          avoid_turbos: avoidTurbos,
          trip_start: tripStart || null,
          trip_end: tripEnd || null,
          trip_budget: tripBudget ? Number(tripBudget) : null,
        }),
      })

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Preferences saved successfully.' })
      } else {
        const data = await res.json()
        setFeedback({ type: 'error', message: data.error || 'Failed to save preferences.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <p className="text-muted-foreground text-center">
          Sign in to manage your tournament preferences.
        </p>
        <Button asChild>
          <Link href="/login?next=/settings">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your tournament preferences to get personalized recommendations.
        </p>
      </div>

      {feedback && (
        <div
          className={cn(
            'rounded-md border p-3 text-sm flex items-center gap-2',
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          )}
        >
          {feedback.type === 'success' ? (
            <Check className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Buy-in Range */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buy-in Range</CardTitle>
          <CardDescription>Set your minimum and maximum buy-in amounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="buyInMin">Minimum ($)</Label>
              <Input
                id="buyInMin"
                type="number"
                min="0"
                placeholder="0"
                value={buyInMin}
                onChange={(e) => setBuyInMin(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground pt-6">to</span>
            <div className="flex-1 space-y-2">
              <Label htmlFor="buyInMax">Maximum ($)</Label>
              <Input
                id="buyInMax"
                type="number"
                min="0"
                placeholder="10000"
                value={buyInMax}
                onChange={(e) => setBuyInMax(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferred Games */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferred Games</CardTitle>
          <CardDescription>Select the game types you prefer to play.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {GAME_OPTIONS.map((game) => (
              <Badge
                key={game}
                variant={preferredGames.includes(game) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  preferredGames.includes(game)
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'hover:bg-accent'
                )}
                onClick={() => toggleItem(preferredGames, game, setPreferredGames)}
              >
                {game}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preferred Formats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferred Formats</CardTitle>
          <CardDescription>Select the tournament formats you enjoy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((format) => (
              <Badge
                key={format}
                variant={preferredFormats.includes(format) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  preferredFormats.includes(format)
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'hover:bg-accent'
                )}
                onClick={() => toggleItem(preferredFormats, format, setPreferredFormats)}
              >
                {format}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Start Time Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start Time Preferences</CardTitle>
          <CardDescription>Set your preferred tournament start time window.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="earliestStart">Earliest</Label>
              <Input
                id="earliestStart"
                type="time"
                value={earliestStart}
                onChange={(e) => setEarliestStart(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground pt-6">to</span>
            <div className="flex-1 space-y-2">
              <Label htmlFor="latestStart">Latest</Label>
              <Input
                id="latestStart"
                type="time"
                value={latestStart}
                onChange={(e) => setLatestStart(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avoid Turbos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Turbo Preference</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidTurbos}
              onChange={(e) => setAvoidTurbos(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
            />
            <span className="text-sm">Avoid turbo and super turbo tournaments</span>
          </label>
        </CardContent>
      </Card>

      {/* Trip Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip Dates</CardTitle>
          <CardDescription>When will you be in Las Vegas?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="tripStart">Arrival</Label>
              <Input
                id="tripStart"
                type="date"
                value={tripStart}
                onChange={(e) => setTripStart(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground pt-6">to</span>
            <div className="flex-1 space-y-2">
              <Label htmlFor="tripEnd">Departure</Label>
              <Input
                id="tripEnd"
                type="date"
                value={tripEnd}
                onChange={(e) => setTripEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="tripBudget">Trip Budget ($)</Label>
            <Input
              id="tripBudget"
              type="number"
              min="0"
              placeholder="5000"
              value={tripBudget}
              onChange={(e) => setTripBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Set a total buy-in budget for your trip to track spending.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="size-4 mr-2" />
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  )
}
