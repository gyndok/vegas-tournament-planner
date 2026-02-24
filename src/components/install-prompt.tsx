'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Don't show if already installed (standalone) or previously dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (localStorage.getItem('pwa-install-dismissed')) return

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-lg">
        <Download className="size-5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install NextRebuy</p>
          <p className="text-xs text-muted-foreground">Quick access to your schedule, even offline</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={handleInstall}>Install</Button>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
