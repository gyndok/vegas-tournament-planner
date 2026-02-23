'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { Button } from '@/components/ui/button'
import { CalendarPlus, CalendarCheck, Loader2 } from 'lucide-react'

interface AddToScheduleButtonProps {
  tournamentId: string
}

export function AddToScheduleButton({ tournamentId }: AddToScheduleButtonProps) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, addToSchedule, removeFromSchedule } = useSchedule()
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const existingEntry = entries.find((e) => e.tournament_id === tournamentId)
  const isInSchedule = !!existingEntry

  async function handleAdd() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    setError(null)
    setSuccess(null)
    setActionLoading(true)

    try {
      await addToSchedule(tournamentId, 'target')
      setSuccess('Added to your schedule!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to schedule'
      if (message.includes('already in schedule')) {
        setError('Already in your schedule')
      } else {
        setError(message)
      }
      setTimeout(() => setError(null), 4000)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRemove() {
    if (!existingEntry) return

    setError(null)
    setSuccess(null)
    setActionLoading(true)

    try {
      await removeFromSchedule(existingEntry.id)
      setSuccess('Removed from schedule')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
      setTimeout(() => setError(null), 4000)
    } finally {
      setActionLoading(false)
    }
  }

  // Still loading auth or schedule state
  if (userLoading || (user && scheduleLoading)) {
    return (
      <div className="pt-2">
        <Button disabled className="w-full md:w-auto gap-2" size="lg">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </Button>
      </div>
    )
  }

  // Not signed in
  if (!user) {
    return (
      <div className="pt-2">
        <Button
          onClick={handleAdd}
          className="w-full md:w-auto gap-2"
          size="lg"
          variant="outline"
        >
          <CalendarPlus className="size-4" />
          Add to Schedule
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Sign in to add tournaments to your schedule.
        </p>
      </div>
    )
  }

  // Already in schedule
  if (isInSchedule) {
    return (
      <div className="pt-2">
        <Button
          onClick={handleRemove}
          disabled={actionLoading}
          className="w-full md:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          {actionLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarCheck className="size-4" />
          )}
          In Schedule
        </Button>
        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-green-500 mt-2">{success}</p>
        )}
      </div>
    )
  }

  // Ready to add
  return (
    <div className="pt-2">
      <Button
        onClick={handleAdd}
        disabled={actionLoading}
        className="w-full md:w-auto gap-2"
        size="lg"
      >
        {actionLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
        {actionLoading ? 'Adding...' : 'Add to Schedule'}
      </Button>
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-500 mt-2">{success}</p>
      )}
    </div>
  )
}
