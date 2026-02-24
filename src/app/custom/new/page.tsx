'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useCustomTournaments } from '@/hooks/use-custom-tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Plus, LogIn } from 'lucide-react'
import Link from 'next/link'

const GAME_TYPES = ['NLH', 'PLO', 'PLO8', 'Mixed', 'Stud', 'Razz', 'Limit Hold\'em', 'Big O', 'Badugi']
const FORMATS = ['Re-entry', 'Freezeout', 'Deepstack', 'Bounty', 'Mystery Bounty', 'Turbo']
const TABLE_SIZES = [6, 8, 9, 10]

export default function NewCustomTournamentPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { createCustomTournament } = useCustomTournaments()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('12:00')
  const [buyIn, setBuyIn] = useState('')
  const [gameType, setGameType] = useState('NLH')
  const [format, setFormat] = useState('Re-entry')
  const [tableSize, setTableSize] = useState('9')
  const [venueName, setVenueName] = useState('')
  const [guarantee, setGuarantee] = useState('')
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name || !date || !startTime || !buyIn || !venueName) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      await createCustomTournament({
        name,
        date,
        start_time: startTime,
        buy_in: parseInt(buyIn, 10),
        game_type: gameType,
        format,
        table_size: parseInt(tableSize, 10),
        venue_name: venueName,
        guaranteed_prize: guarantee ? parseInt(guarantee, 10) : null,
        notes: notes || null,
        is_public: isPublic,
      })
      router.push('/schedule')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Plus className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Sign in to add custom tournaments</p>
        </div>
        <Button asChild>
          <Link href="/login?next=/custom/new">
            <LogIn className="size-4 mr-2" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/schedule">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Add Custom Tournament</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tournament Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tournament Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. $200 NLH Daily" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyIn">Buy-in ($) *</Label>
                <Input id="buyIn" type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="200" min="0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guarantee">Guarantee ($)</Label>
                <Input id="guarantee" type="number" value={guarantee} onChange={(e) => setGuarantee(e.target.value)} placeholder="Optional" min="0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueName">Venue *</Label>
              <Input id="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Bellagio, Home Game, etc." required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Game Type</Label>
                <Select value={gameType} onValueChange={setGameType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GAME_TYPES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Table Size</Label>
                <Select value={tableSize} onValueChange={setTableSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TABLE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}-max</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <div>
                <p className="text-sm font-medium">Submit to public database</p>
                <p className="text-xs text-muted-foreground">If approved by admin, other users will be able to see this tournament</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/schedule">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add Tournament'}
          </Button>
        </div>
      </form>
    </div>
  )
}
