'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserScheduleEntry } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatBuyIn, formatTime, formatDate } from '@/lib/utils'
import { ChevronDown, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'

const PRIORITY_CONFIG = {
  target: { label: 'Target', className: 'bg-primary hover:bg-primary/90 text-primary-foreground' },
  backup: { label: 'Backup', className: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
  maybe: { label: 'Maybe', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
}

interface CalendarEventPopoverProps {
  entry: UserScheduleEntry
  hasConflict: boolean
  onUpdateEntry: (entryId: string, updates: { priority?: 'target' | 'backup' | 'maybe' }) => Promise<void>
  onRemoveEntry: (entryId: string) => Promise<void>
  children: React.ReactNode
}

export function CalendarEventPopover({
  entry,
  hasConflict,
  onUpdateEntry,
  onRemoveEntry,
  children,
}: CalendarEventPopoverProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const t = entry.tournament
  if (!t) return <>{children}</>

  const priorityConfig = PRIORITY_CONFIG[entry.priority]

  async function handleDelete() {
    setDeleting(true)
    try {
      await onRemoveEntry(entry.id)
      setOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div>
            <Link
              href={`/tournament/${t.slug ?? t.id}`}
              className="font-medium text-sm hover:text-primary transition-colors leading-tight"
              onClick={() => setOpen(false)}
            >
              {t.name}
              <ExternalLink className="size-3 inline ml-1 opacity-50" />
            </Link>
            {t.series && (
              <p className="text-xs text-muted-foreground mt-0.5">{t.series.name}</p>
            )}
          </div>

          {/* Details */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>{formatDate(t.date)} · {formatTime(t.start_time)}</span>
              <span className="font-medium text-foreground">{formatBuyIn(t.buy_in)}</span>
            </div>
            <div className="flex gap-2">
              <span>{t.game_type}</span>
              <span>·</span>
              <span>{t.format}</span>
            </div>
            {t.guaranteed_prize && t.guaranteed_prize > 0 && (
              <div>GTD {formatBuyIn(t.guaranteed_prize)}</div>
            )}
          </div>

          {/* Conflict warning */}
          {hasConflict && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="size-3 mr-1" />
              Schedule conflict
            </Badge>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn('h-7 text-xs px-2 gap-1', priorityConfig.className)}
                >
                  {priorityConfig.label}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(PRIORITY_CONFIG) as Array<'target' | 'backup' | 'maybe'>).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => onUpdateEntry(entry.id, { priority: p })}
                    className={cn(entry.priority === p && 'font-bold')}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-3.5 mr-1" />
              {deleting ? '...' : 'Remove'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
