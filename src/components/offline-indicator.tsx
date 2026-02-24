'use client'

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    function handleOnline() { setIsOffline(false) }
    function handleOffline() { setIsOffline(true) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
      <WifiOff className="size-4 shrink-0" />
      <span>You are offline — showing your last saved schedule</span>
    </div>
  )
}
