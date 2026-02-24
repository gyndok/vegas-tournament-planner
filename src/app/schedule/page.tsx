'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { useFavorites } from '@/hooks/use-favorites'
import { ScheduleCalendar } from '@/components/schedule-calendar'
import { TournamentCard } from '@/components/tournament-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LogIn, Download, CalendarDays, Heart } from 'lucide-react'
import { Tournament } from '@/types'

export default function SchedulePage() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, error, updateEntry, removeFromSchedule } = useSchedule()
  const { favorites, loading: favLoading } = useFavorites()

  const loading = userLoading || scheduleLoading || favLoading

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Schedule</h1>
        </div>

        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Export .ics
          </Button>
        )}
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
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground">({entries.length})</span>
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
            entries={entries}
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
