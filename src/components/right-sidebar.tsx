'use client'

import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/sidebar-context'
import { TodaysScheduleWidget } from '@/components/todays-schedule-widget'
import { SeriesLegend } from '@/components/series-legend'
import { QuickActions } from '@/components/quick-actions'
import { AdUnit } from '@/components/ad-unit'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'

export function RightSidebar() {
  const { isRightOpen, toggleRight } = useSidebar()

  return (
    <div className="hidden xl:flex items-start">
      {/* Toggle button — always visible */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleRight}
        className="mt-4 -ml-3 h-8 w-8 p-0 shrink-0"
        title={isRightOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isRightOpen ? (
          <PanelRightClose className="size-4" />
        ) : (
          <PanelRightOpen className="size-4" />
        )}
      </Button>

      {/* Sidebar content */}
      <aside
        className={cn(
          'shrink-0 border-l border-border bg-background transition-[width,opacity] duration-200 ease-in-out overflow-hidden',
          isRightOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'
        )}
      >
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-6">
            <TodaysScheduleWidget />
            <Separator />
            <SeriesLegend />
            <Separator />
            <QuickActions />
            <Separator />
            <AdUnit slot="9877859861" size="sidebar" channel="right_sidebar" />
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
