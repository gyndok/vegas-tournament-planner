'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { ScheduleView } from '@/components/schedule-view'
import { Button } from '@/components/ui/button'
import { LogIn, Download, CalendarDays } from 'lucide-react'

export default function SchedulePage() {
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, error, updateEntry, removeFromSchedule } = useSchedule()

  const loading = userLoading || scheduleLoading

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            My Schedule
            {entries.length > 0 && (
              <span className="text-base font-normal text-muted-foreground">
                ({entries.length} tournament{entries.length !== 1 ? 's' : ''})
              </span>
            )}
          </h1>
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

      <ScheduleView
        entries={entries}
        onUpdateEntry={updateEntry}
        onRemoveEntry={removeFromSchedule}
      />
    </div>
  )
}
