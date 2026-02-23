'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

export function PdtClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    function updateTime() {
      const now = new Date()
      const formatted = now.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      setTime(formatted)
    }

    updateTime()
    const interval = setInterval(updateTime, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!time) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
      <Clock className="size-3.5" />
      <span>{time}</span>
      <span className="text-[10px] opacity-70">PT</span>
    </div>
  )
}
