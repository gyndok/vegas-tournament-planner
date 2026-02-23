'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useSchedule } from '@/hooks/use-schedule'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CalendarPlus, CalendarCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAddButtonProps {
  tournamentId: string
  className?: string
}

export function QuickAddButton({ tournamentId, className }: QuickAddButtonProps) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { entries, loading: scheduleLoading, addToSchedule, removeFromSchedule } = useSchedule()
  const [actionLoading, setActionLoading] = useState(false)

  const existingEntry = entries.find((e) => e.tournament_id === tournamentId)
  const isInSchedule = !!existingEntry

  async function handleClick(e: React.MouseEvent) {
    // Prevent the parent Link from navigating
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    setActionLoading(true)

    try {
      if (isInSchedule) {
        await removeFromSchedule(existingEntry!.id)
      } else {
        await addToSchedule(tournamentId, 'target')
      }
    } catch {
      // Silently fail on quick-add — user can retry
    } finally {
      setActionLoading(false)
    }
  }

  // Still loading auth or schedule
  if (userLoading || (user && scheduleLoading)) {
    return null // Don't show anything while loading to avoid layout shift
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 shrink-0 rounded-full transition-colors',
            isInSchedule
              ? 'text-primary bg-primary/10 hover:bg-primary/20'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
            className,
          )}
          onClick={handleClick}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isInSchedule ? (
            <CalendarCheck className="size-4" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={4}>
        {!user
          ? 'Sign in to add to schedule'
          : isInSchedule
            ? 'Remove from schedule'
            : 'Add to schedule'}
      </TooltipContent>
    </Tooltip>
  )
}
