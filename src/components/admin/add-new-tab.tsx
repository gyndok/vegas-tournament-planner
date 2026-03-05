'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Series } from '@/types'
import { Loader2, Plus, CheckCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GAME_TYPES = [
  'NLH',
  'PLO',
  'PLO Hi-Lo',
  'Mixed',
  'Omaha Hi-Lo',
  'Stud',
  'Stud Hi-Lo',
  'Razz',
  'HORSE',
  'Limit Hold\'em',
  'NL 2-7 Lowball',
  'Pot Limit 2-7 Triple Draw',
  'Big O',
  'Short Deck',
  'Other',
]

// ---------------------------------------------------------------------------
// Form state interface
// ---------------------------------------------------------------------------
interface AddFormState {
  name: string
  event_number: number | null
  date: string
  day_of_week: string
  start_time: string
  buy_in: number | string
  game_type: string
  format: string
  table_size: number
  starting_stack: number | null
  blind_levels_minutes: number | null
  late_reg_levels: number | null
  late_reg_end_time: string
  guaranteed_prize: number | null
  is_flight: boolean
  flight_label: string
  parent_event_number: number | null
  estimated_duration_hours: number | null
  notes: string
}

const INITIAL_FORM: AddFormState = {
  name: '',
  event_number: null,
  date: '',
  day_of_week: '',
  start_time: '',
  buy_in: '',
  game_type: 'NLH',
  format: '',
  table_size: 9,
  starting_stack: null,
  blind_levels_minutes: null,
  late_reg_levels: null,
  late_reg_end_time: '',
  guaranteed_prize: null,
  is_flight: false,
  flight_label: '',
  parent_event_number: null,
  estimated_duration_hours: null,
  notes: '',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AddNewTab() {
  // Series state
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string>('new')

  // New series inline form
  const [newSeriesName, setNewSeriesName] = useState('')
  const [newSeriesVenue, setNewSeriesVenue] = useState('')
  const [newSeriesStartDate, setNewSeriesStartDate] = useState('')
  const [newSeriesEndDate, setNewSeriesEndDate] = useState('')
  const [newSeriesWebsite, setNewSeriesWebsite] = useState('')

  // Tournament form
  const [formState, setFormState] = useState<AddFormState>({ ...INITIAL_FORM })

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error'
    text: string
    tournamentName?: string
  } | null>(null)

  // ------------------------------------------------------------------
  // Fetch series
  // ------------------------------------------------------------------
  const fetchSeries = useCallback(async () => {
    const supabase = createClient()
    const { data: series } = await supabase
      .from('series')
      .select('*')
      .order('start_date', { ascending: false })
    if (series) setSeriesList(series)
  }, [])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  // ------------------------------------------------------------------
  // Form change helpers
  // ------------------------------------------------------------------
  function updateField<K extends keyof AddFormState>(field: K, value: AddFormState[K]) {
    setFormState((prev) => {
      const next = { ...prev, [field]: value }
      // Auto-fill day_of_week when date changes
      if (field === 'date' && typeof value === 'string' && value) {
        const dayName = new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
        })
        next.day_of_week = dayName
      }
      return next
    })
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  async function handleSubmit() {
    // Client-side validation
    if (!formState.name.trim()) {
      setSubmitMessage({ type: 'error', text: 'Tournament name is required.' })
      return
    }
    if (!formState.date) {
      setSubmitMessage({ type: 'error', text: 'Date is required.' })
      return
    }
    if (!formState.start_time) {
      setSubmitMessage({ type: 'error', text: 'Start time is required.' })
      return
    }
    if (!formState.buy_in && formState.buy_in !== 0) {
      setSubmitMessage({ type: 'error', text: 'Buy-in is required.' })
      return
    }

    // Build tournament data
    const tournament: Record<string, unknown> = {
      name: formState.name.trim(),
      event_number: formState.event_number,
      date: formState.date,
      day_of_week: formState.day_of_week,
      start_time: formState.start_time,
      buy_in: Number(formState.buy_in),
      game_type: formState.game_type || 'NLH',
      format: formState.format || '',
      table_size: formState.table_size || 9,
      starting_stack: formState.starting_stack,
      blind_levels_minutes: formState.blind_levels_minutes,
      late_reg_levels: formState.late_reg_levels,
      late_reg_end_time: formState.late_reg_end_time || null,
      guaranteed_prize: formState.guaranteed_prize,
      is_flight: formState.is_flight,
      flight_label: formState.flight_label || null,
      parent_event_number: formState.parent_event_number,
      estimated_duration_hours: formState.estimated_duration_hours,
      notes: formState.notes || null,
    }

    // Attach series
    const body: Record<string, unknown> = { tournament }

    if (selectedSeries === 'new') {
      if (!newSeriesName || !newSeriesVenue || !newSeriesStartDate || !newSeriesEndDate) {
        setSubmitMessage({
          type: 'error',
          text: 'New series requires name, venue, start date, and end date.',
        })
        return
      }
      body.new_series = {
        name: newSeriesName,
        venue: newSeriesVenue,
        start_date: newSeriesStartDate,
        end_date: newSeriesEndDate,
        website_url: newSeriesWebsite || undefined,
      }
    } else {
      tournament.series_id = selectedSeries
    }

    setSubmitting(true)
    setSubmitMessage(null)

    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create tournament')
      }

      setSubmitMessage({
        type: 'success',
        text: `Tournament created successfully!`,
        tournamentName: json.tournament?.name ?? formState.name,
      })

      // Refresh series list in case a new one was created
      if (selectedSeries === 'new') {
        fetchSeries()
      }
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create tournament',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------------------------------------------
  // Clear form for "Add Another"
  // ------------------------------------------------------------------
  function handleAddAnother() {
    setFormState({ ...INITIAL_FORM })
    setSubmitMessage(null)
    // Keep series selection as-is so the user can quickly add another to same series
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="mt-2 max-w-2xl">
      {/* Success banner */}
      {submitMessage?.type === 'success' && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {submitMessage.text}
            </span>
          </div>
          {submitMessage.tournamentName && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              &ldquo;{submitMessage.tournamentName}&rdquo; has been added to the database.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={handleAddAnother} className="gap-2">
            <Plus className="size-4" />
            Add Another
          </Button>
        </div>
      )}

      {/* Error banner */}
      {submitMessage?.type === 'error' && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {submitMessage.text}
        </div>
      )}

      {/* ---- Series Picker ---- */}
      <section className="mb-6">
        <Label className="text-sm font-medium mb-2 block">Series</Label>
        <select
          value={selectedSeries}
          onChange={(e) => setSelectedSeries(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="new">+ Create New Series</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.venue})
            </option>
          ))}
        </select>

        {/* New Series Form */}
        {selectedSeries === 'new' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border bg-muted p-4">
            <div>
              <Label htmlFor="add-series-name" className="text-xs text-muted-foreground">
                Name *
              </Label>
              <Input
                id="add-series-name"
                placeholder="e.g. WSOP 2026"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-series-venue" className="text-xs text-muted-foreground">
                Venue *
              </Label>
              <Input
                id="add-series-venue"
                placeholder="e.g. Paris Las Vegas"
                value={newSeriesVenue}
                onChange={(e) => setNewSeriesVenue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-series-start" className="text-xs text-muted-foreground">
                Start Date *
              </Label>
              <Input
                id="add-series-start"
                type="date"
                value={newSeriesStartDate}
                onChange={(e) => setNewSeriesStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-series-end" className="text-xs text-muted-foreground">
                End Date *
              </Label>
              <Input
                id="add-series-end"
                type="date"
                value={newSeriesEndDate}
                onChange={(e) => setNewSeriesEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="add-series-website" className="text-xs text-muted-foreground">
                Website URL (optional)
              </Label>
              <Input
                id="add-series-website"
                type="url"
                placeholder="https://..."
                value={newSeriesWebsite}
                onChange={(e) => setNewSeriesWebsite(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </section>

      <Separator className="mb-6" />

      {/* ---- Tournament Form ---- */}
      <div className="space-y-6">
        {/* ---- Core Info ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Core Info</h3>
          <div>
            <Label htmlFor="add-name">Name *</Label>
            <Input
              id="add-name"
              value={formState.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. $1,500 NLH - Event #1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-event-number">Event #</Label>
              <Input
                id="add-event-number"
                type="number"
                value={formState.event_number ?? ''}
                onChange={(e) =>
                  updateField('event_number', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
            <div>
              <Label htmlFor="add-date">Date *</Label>
              <Input
                id="add-date"
                type="date"
                value={formState.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-dow">Day of Week</Label>
              <Input
                id="add-dow"
                value={formState.day_of_week}
                onChange={(e) => updateField('day_of_week', e.target.value)}
                placeholder="Auto-fills from date"
              />
            </div>
            <div>
              <Label htmlFor="add-time">Start Time *</Label>
              <Input
                id="add-time"
                type="time"
                value={formState.start_time}
                onChange={(e) => updateField('start_time', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ---- Game Details ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Game Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-buyin">Buy-in *</Label>
              <Input
                id="add-buyin"
                type="number"
                value={formState.buy_in ?? ''}
                onChange={(e) =>
                  updateField('buy_in', e.target.value ? Number(e.target.value) : '')
                }
                placeholder="e.g. 1500"
              />
            </div>
            <div>
              <Label htmlFor="add-gametype">Game Type</Label>
              <Select
                value={formState.game_type}
                onValueChange={(val) => updateField('game_type', val)}
              >
                <SelectTrigger id="add-gametype" className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {GAME_TYPES.map((gt) => (
                    <SelectItem key={gt} value={gt}>
                      {gt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-format">Format</Label>
              <Input
                id="add-format"
                value={formState.format}
                onChange={(e) => updateField('format', e.target.value)}
                placeholder="e.g. Re-entry, Freezeout"
              />
            </div>
            <div>
              <Label htmlFor="add-tablesize">Table Size</Label>
              <Input
                id="add-tablesize"
                type="number"
                value={formState.table_size}
                onChange={(e) =>
                  updateField('table_size', e.target.value ? Number(e.target.value) : 9)
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ---- Structure ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Structure</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-stack">Starting Stack</Label>
              <Input
                id="add-stack"
                type="number"
                value={formState.starting_stack ?? ''}
                onChange={(e) =>
                  updateField('starting_stack', e.target.value ? Number(e.target.value) : null)
                }
                placeholder="e.g. 25000"
              />
            </div>
            <div>
              <Label htmlFor="add-blinds">Blind Levels (min)</Label>
              <Input
                id="add-blinds"
                type="number"
                value={formState.blind_levels_minutes ?? ''}
                onChange={(e) =>
                  updateField(
                    'blind_levels_minutes',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="e.g. 20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-latereg-levels">Late Reg Levels</Label>
              <Input
                id="add-latereg-levels"
                type="number"
                value={formState.late_reg_levels ?? ''}
                onChange={(e) =>
                  updateField(
                    'late_reg_levels',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>
            <div>
              <Label htmlFor="add-latereg-time">Late Reg End Time</Label>
              <Input
                id="add-latereg-time"
                type="time"
                value={formState.late_reg_end_time}
                onChange={(e) => updateField('late_reg_end_time', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ---- Prize ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Prize</h3>
          <div>
            <Label htmlFor="add-gtd">Guaranteed Prize</Label>
            <Input
              id="add-gtd"
              type="number"
              value={formState.guaranteed_prize ?? ''}
              onChange={(e) =>
                updateField('guaranteed_prize', e.target.value ? Number(e.target.value) : null)
              }
              placeholder="e.g. 100000"
            />
          </div>
        </div>

        <Separator />

        {/* ---- Flight Info ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Flight Info</h3>
          <div className="flex items-center gap-3">
            <Switch
              id="add-isflight"
              checked={formState.is_flight}
              onCheckedChange={(checked) => updateField('is_flight', checked)}
            />
            <Label htmlFor="add-isflight">Is Flight</Label>
          </div>
          {formState.is_flight && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add-flightlabel">Flight Label</Label>
                <Input
                  id="add-flightlabel"
                  value={formState.flight_label}
                  onChange={(e) => updateField('flight_label', e.target.value)}
                  placeholder="e.g. Day 1A"
                />
              </div>
              <div>
                <Label htmlFor="add-parentevent">Parent Event #</Label>
                <Input
                  id="add-parentevent"
                  type="number"
                  value={formState.parent_event_number ?? ''}
                  onChange={(e) =>
                    updateField(
                      'parent_event_number',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Other ---- */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Other</h3>
          <div>
            <Label htmlFor="add-duration">Estimated Duration (hrs)</Label>
            <Input
              id="add-duration"
              type="number"
              step="0.5"
              value={formState.estimated_duration_hours ?? ''}
              onChange={(e) =>
                updateField(
                  'estimated_duration_hours',
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
          <div>
            <Label htmlFor="add-notes">Notes</Label>
            <Textarea
              id="add-notes"
              rows={3}
              value={formState.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </div>

        {/* ---- Submit ---- */}
        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="lg"
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Create Tournament
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
