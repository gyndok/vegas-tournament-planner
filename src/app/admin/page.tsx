'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  LogIn,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'
import type { Tournament, Series } from '@/types'
import ImportTab from '@/components/admin/import-tab'
import AddNewTab from '@/components/admin/add-new-tab'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------
function isClientAdmin(email: string | undefined | null): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails) return false
  if (!email) return false
  const allowed = adminEmails.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.toLowerCase())
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 50

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
// Types
// ---------------------------------------------------------------------------
interface TournamentsApiResponse {
  data: Tournament[]
  totalCount: number
  offset: number
  limit: number
}

interface EditFormState {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const { user, loading: userLoading } = useUser()

  // ---- Tournaments tab state ----
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [listLoading, setListLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterSeriesId, setFilterSeriesId] = useState<string>('')
  const [filterGameType, setFilterGameType] = useState<string>('')

  // Series list for dropdown
  const [seriesList, setSeriesList] = useState<Series[]>([])

  // ---- Edit sheet state ----
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [formState, setFormState] = useState<EditFormState>({
    name: '',
    event_number: null,
    date: '',
    day_of_week: '',
    start_time: '',
    buy_in: '',
    game_type: '',
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
  })
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ---- Delete dialog state ----
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Refs for debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ------------------------------------------------------------------
  // Debounce search
  // ------------------------------------------------------------------
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setOffset(0)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  // ------------------------------------------------------------------
  // Fetch series list
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user || !isClientAdmin(user.email)) return
    const supabase = createClient()
    supabase
      .from('series')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setSeriesList(data)
      })
  }, [user])

  // ------------------------------------------------------------------
  // Fetch tournaments
  // ------------------------------------------------------------------
  const fetchTournaments = useCallback(async () => {
    setListLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterSeriesId) params.set('series_id', filterSeriesId)
      if (filterGameType) params.set('game_type', filterGameType)
      params.set('sort_by', 'date')
      params.set('sort_dir', 'desc')
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))

      const res = await fetch(`/api/admin/tournaments?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: TournamentsApiResponse = await res.json()
      setTournaments(json.data)
      setTotalCount(json.totalCount)
    } catch (err) {
      console.error('Error fetching tournaments:', err)
    } finally {
      setListLoading(false)
    }
  }, [debouncedSearch, filterSeriesId, filterGameType, offset])

  useEffect(() => {
    if (!user || !isClientAdmin(user.email)) return
    fetchTournaments()
  }, [user, fetchTournaments])

  // ------------------------------------------------------------------
  // Open edit sheet
  // ------------------------------------------------------------------
  function openEditSheet(t: Tournament) {
    setSelectedTournament(t)
    setFormState({
      name: t.name,
      event_number: t.event_number,
      date: t.date,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      buy_in: t.buy_in,
      game_type: t.game_type,
      format: t.format,
      table_size: t.table_size,
      starting_stack: t.starting_stack,
      blind_levels_minutes: t.blind_levels_minutes,
      late_reg_levels: t.late_reg_levels,
      late_reg_end_time: t.late_reg_end_time ?? '',
      guaranteed_prize: t.guaranteed_prize,
      is_flight: t.is_flight,
      flight_label: t.flight_label ?? '',
      parent_event_number: t.parent_event_number,
      estimated_duration_hours: t.estimated_duration_hours,
      notes: t.notes ?? '',
    } satisfies EditFormState)
    setSaveMessage(null)
    setSheetOpen(true)
  }

  // ------------------------------------------------------------------
  // Form change helpers
  // ------------------------------------------------------------------
  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
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
  // Compute changed fields
  // ------------------------------------------------------------------
  function getChangedFields(): Record<string, unknown> {
    if (!selectedTournament) return {}
    const changes: Record<string, unknown> = {}
    const original = selectedTournament as unknown as Record<string, unknown>
    const form = formState as unknown as Record<string, unknown>

    for (const [key, val] of Object.entries(form)) {
      const origVal = original[key]

      // Normalize empty strings to null for nullable fields
      const normalized = val === '' ? null : val

      if (normalized !== origVal) {
        changes[key] = normalized
      }
    }
    return changes
  }

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------
  async function handleSave() {
    if (!selectedTournament) return
    const changes = getChangedFields()
    if (Object.keys(changes).length === 0) {
      setSaveMessage({ type: 'success', text: 'No changes to save.' })
      return
    }

    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTournament.id, ...changes }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      setSaveMessage({ type: 'success', text: 'Saved successfully.' })
      fetchTournaments()
      // Close after brief delay so the user sees the success message
      setTimeout(() => setSheetOpen(false), 600)
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  async function handleDelete() {
    if (!selectedTournament) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTournament.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Delete failed')
      }
      setDeleteDialogOpen(false)
      setSheetOpen(false)
      fetchTournaments()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ------------------------------------------------------------------
  // Pagination helpers
  // ------------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  // ------------------------------------------------------------------
  // Auth guards
  // ------------------------------------------------------------------
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <LogIn className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You must be signed in to access this page.
          </p>
        </div>
      </div>
    )
  }

  if (!isClientAdmin(user.email)) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <ShieldAlert className="size-10 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Access denied. This page is restricted to administrators.
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      <Tabs defaultValue="tournaments">
        <TabsList>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="add">Add New</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TOURNAMENTS TAB                                              */}
        {/* ============================================================ */}
        <TabsContent value="tournaments">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tournaments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filterSeriesId}
              onValueChange={(val) => {
                setFilterSeriesId(val === '__all__' ? '' : val)
                setOffset(0)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Series</SelectItem>
                {seriesList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterGameType}
              onValueChange={(val) => {
                setFilterGameType(val === '__all__' ? '' : val)
                setOffset(0)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Games" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Games</SelectItem>
                {GAME_TYPES.map((gt) => (
                  <SelectItem key={gt} value={gt}>
                    {gt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count */}
          <p className="text-xs text-muted-foreground mb-2">
            Showing {tournaments.length} of {totalCount} tournaments
          </p>

          {/* Data table */}
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Tournament</th>
                  <th className="px-3 py-2 text-left font-medium">Casino</th>
                  <th className="px-3 py-2 text-right font-medium">Buy-in</th>
                  <th className="px-3 py-2 text-left font-medium">Game</th>
                  <th className="px-3 py-2 text-left font-medium">Format</th>
                  <th className="px-3 py-2 text-right font-medium">GTD</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : tournaments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No tournaments found.
                    </td>
                  </tr>
                ) : (
                  tournaments.map((t) => {
                    const seriesName = t.series?.name ?? ''
                    const venue = t.series?.venue ?? ''
                    const color = getSeriesColor(seriesName, venue, t.name)
                    return (
                      <tr
                        key={t.id}
                        className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => openEditSheet(t)}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatTime(t.start_time)}</td>
                        <td className="px-3 py-2 max-w-[260px] truncate">{t.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant="secondary" className={`${color.bg} ${color.text} border-0`}>
                            {venue || seriesName}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-mono">
                          {formatBuyIn(t.buy_in)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.game_type}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.format}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-mono">
                          {t.guaranteed_prize ? formatBuyIn(t.guaranteed_prize) : '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            >
              <ChevronLeft className="size-4 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= totalCount}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* IMPORT TAB                                                   */}
        {/* ============================================================ */}
        <TabsContent value="import">
          <ImportTab />
        </TabsContent>

        {/* ============================================================ */}
        {/* ADD NEW TAB                                                  */}
        {/* ============================================================ */}
        <TabsContent value="add">
          <AddNewTab />
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* EDIT SHEET                                                     */}
      {/* ============================================================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Tournament</SheetTitle>
          </SheetHeader>

          {selectedTournament && (
            <div className="px-4 pb-4 space-y-6">
              {/* Series (read-only) */}
              <div>
                <Label className="text-xs text-muted-foreground">Series</Label>
                <p className="text-sm mt-0.5">
                  {selectedTournament.series?.name ?? 'Unknown'}{' '}
                  {selectedTournament.series?.venue
                    ? `(${selectedTournament.series.venue})`
                    : ''}
                </p>
              </div>

              <Separator />

              {/* ---- Core Info ---- */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Core Info</h3>
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={(formState.name as string) ?? ''}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-event-number">Event #</Label>
                    <Input
                      id="edit-event-number"
                      type="number"
                      value={formState.event_number ?? ''}
                      onChange={(e) =>
                        updateField('event_number', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-date">Date *</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={(formState.date as string) ?? ''}
                      onChange={(e) => updateField('date', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-dow">Day of Week</Label>
                    <Input
                      id="edit-dow"
                      value={(formState.day_of_week as string) ?? ''}
                      onChange={(e) => updateField('day_of_week', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-time">Start Time *</Label>
                    <Input
                      id="edit-time"
                      type="time"
                      value={(formState.start_time as string) ?? ''}
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
                    <Label htmlFor="edit-buyin">Buy-in *</Label>
                    <Input
                      id="edit-buyin"
                      type="number"
                      value={formState.buy_in ?? ''}
                      onChange={(e) =>
                        updateField('buy_in', e.target.value ? Number(e.target.value) : '')
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-gametype">Game Type</Label>
                    <Select
                      value={(formState.game_type as string) ?? ''}
                      onValueChange={(val) => updateField('game_type', val)}
                    >
                      <SelectTrigger id="edit-gametype" className="w-full">
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
                    <Label htmlFor="edit-format">Format</Label>
                    <Input
                      id="edit-format"
                      value={(formState.format as string) ?? ''}
                      onChange={(e) => updateField('format', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-tablesize">Table Size</Label>
                    <Input
                      id="edit-tablesize"
                      type="number"
                      value={formState.table_size ?? 9}
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
                    <Label htmlFor="edit-stack">Starting Stack</Label>
                    <Input
                      id="edit-stack"
                      type="number"
                      value={formState.starting_stack ?? ''}
                      onChange={(e) =>
                        updateField(
                          'starting_stack',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-blinds">Blind Levels (min)</Label>
                    <Input
                      id="edit-blinds"
                      type="number"
                      value={formState.blind_levels_minutes ?? ''}
                      onChange={(e) =>
                        updateField(
                          'blind_levels_minutes',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-latereg-levels">Late Reg Levels</Label>
                    <Input
                      id="edit-latereg-levels"
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
                    <Label htmlFor="edit-latereg-time">Late Reg End Time</Label>
                    <Input
                      id="edit-latereg-time"
                      type="time"
                      value={(formState.late_reg_end_time as string) ?? ''}
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
                  <Label htmlFor="edit-gtd">Guaranteed Prize</Label>
                  <Input
                    id="edit-gtd"
                    type="number"
                    value={formState.guaranteed_prize ?? ''}
                    onChange={(e) =>
                      updateField(
                        'guaranteed_prize',
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* ---- Flight Info ---- */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Flight Info</h3>
                <div className="flex items-center gap-3">
                  <Switch
                    id="edit-isflight"
                    checked={!!formState.is_flight}
                    onCheckedChange={(checked) => updateField('is_flight', checked)}
                  />
                  <Label htmlFor="edit-isflight">Is Flight</Label>
                </div>
                {formState.is_flight && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="edit-flightlabel">Flight Label</Label>
                      <Input
                        id="edit-flightlabel"
                        value={(formState.flight_label as string) ?? ''}
                        onChange={(e) => updateField('flight_label', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-parentevent">Parent Event #</Label>
                      <Input
                        id="edit-parentevent"
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
                  <Label htmlFor="edit-duration">Estimated Duration (hrs)</Label>
                  <Input
                    id="edit-duration"
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
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    rows={3}
                    value={(formState.notes as string) ?? ''}
                    onChange={(e) => updateField('notes', e.target.value)}
                  />
                </div>
              </div>

              {/* Save message */}
              {saveMessage && (
                <p
                  className={`text-sm ${
                    saveMessage.type === 'success' ? 'text-green-600' : 'text-destructive'
                  }`}
                >
                  {saveMessage.text}
                </p>
              )}
            </div>
          )}

          <SheetFooter>
            <div className="flex items-center justify-between w-full">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4 mr-1" />
                Delete
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ============================================================== */}
      {/* DELETE CONFIRMATION DIALOG                                     */}
      {/* ============================================================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTournament?.name}&quot;? This removes
              it from all user schedules and favorites.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
