'use client'

import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useSidebar } from '@/components/sidebar-context'
import { TodaysScheduleWidget } from '@/components/todays-schedule-widget'
import { SeriesLegend } from '@/components/series-legend'
import { QuickActions } from '@/components/quick-actions'
import { AdUnit } from '@/components/ad-unit'

export function RightSidebar() {
  const { isRightOpen } = useSidebar()

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-l border-border bg-background transition-[width] duration-200 ease-in-out overflow-hidden',
        isRightOpen ? 'xl:flex w-80' : 'w-0'
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
  )
}
