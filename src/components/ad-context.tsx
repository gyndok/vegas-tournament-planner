'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useUser } from '@/hooks/use-user'

interface AdContextValue {
  /** Whether ads should be shown (false for Pro subscribers) */
  showAds: boolean
  /** Whether the AdSense script has loaded */
  adsReady: boolean
  /** The AdSense publisher ID */
  publisherId: string | null
}

const AdContext = createContext<AdContextValue>({
  showAds: true,
  adsReady: false,
  publisherId: null,
})

export function useAds() {
  return useContext(AdContext)
}

interface AdProviderProps {
  children: ReactNode
}

export function AdProvider({ children }: AdProviderProps) {
  const { user } = useUser()
  const [adsReady, setAdsReady] = useState(false)

  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || null

  // Check if user has Pro subscription (no ads)
  // For now this reads from user_metadata; expand when Stripe/billing is added
  const isPro = user?.user_metadata?.subscription_tier === 'pro'
  const showAds = !isPro && !!publisherId

  useEffect(() => {
    if (!showAds || !publisherId) return

    // Check if script already loaded
    if (document.querySelector(`script[src*="adsbygoogle"]`)) {
      setAdsReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => setAdsReady(true)
    script.onerror = () => {
      // AdSense failed to load (ad blocker, etc.) — degrade gracefully
      setAdsReady(false)
    }
    document.head.appendChild(script)
  }, [showAds, publisherId])

  return (
    <AdContext.Provider value={{ showAds, adsReady, publisherId }}>
      {children}
    </AdContext.Provider>
  )
}
