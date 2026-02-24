import { Card, CardContent } from '@/components/ui/card'

export function TournamentCardSkeleton() {
  return (
    <Card className="border-border bg-card py-0 gap-0 border-l-4 border-l-gray-300 dark:border-l-gray-600">
      <CardContent className="p-4 space-y-3">
        {/* Top row: series badge + event number */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-8 rounded bg-muted animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
        </div>

        {/* Date/time row */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>

        {/* Buy-in / badges row */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-14 rounded bg-muted animate-pulse" />
          <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
