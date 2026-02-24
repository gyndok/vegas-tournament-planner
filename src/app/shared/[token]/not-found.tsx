import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SharedNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <CalendarDays className="size-12 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium">Schedule not available</p>
        <p className="text-muted-foreground text-sm mt-1">
          This schedule link is invalid or sharing has been disabled.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  )
}
