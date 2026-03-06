'use client'

import { useEffect, useRef, useState } from 'react'
import { useAds } from '@/components/ad-context'
import { cn } from '@/lib/utils'

/**
 * Ad size presets for common placements.
 *
 * "responsive" — lets Google pick the best size for the container (recommended)
 * "banner"     — classic 728x90 leaderboard (shrinks on mobile)
 * "sidebar"    — 300x250 medium rectangle, ideal for sidebar/between content
 * "inline"     — in-feed native ad that matches surrounding content
 */
type AdSize = 'responsive' | 'banner' | 'sidebar' | 'inline'

interface AdUnitProps {
  /** Ad slot ID from your AdSense dashboard */
  slot: string
  /** Size preset — defaults to "responsive" */
  size?: AdSize
  /** Optional custom channel for analytics grouping in AdSense */
  channel?: string
  /** Additional CSS classes on the wrapper */
  className?: string
}

const SIZE_STYLES: Record<AdSize, { format: string; style: React.CSSProperties }> = {
  responsive: {
    format: 'auto',
    style: { display: 'block', width: '100%' },
  },
  banner: {
    format: 'horizontal',
    style: { display: 'block', width: '100%', maxHeight: 90 },
  },
  sidebar: {
    format: 'rectangle',
    style: { display: 'block', width: '100%', minHeight: 250 },
  },
  inline: {
    format: 'fluid',
    style: { display: 'block', width: '100%' },
  },
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function AdUnit({ slot, size = 'responsive', channel, className }: AdUnitProps) {
  const { showAds, adsReady, publisherId } = useAds()
  const adRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)
  const [adFilled, setAdFilled] = useState(false)

  useEffect(() => {
    if (!showAds || !adsReady || pushed.current) return

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // AdSense push failed — silently degrade
    }
  }, [showAds, adsReady])

  // Watch for AdSense actually filling the slot with a real ad.
  // AdSense sets data-ad-status="filled" when an ad is served,
  // and "unfilled" when no ad is available (e.g. site not approved yet).
  useEffect(() => {
    if (!adRef.current || !pushed.current) return

    const checkFilled = () => {
      const el = adRef.current
      if (el?.getAttribute('data-ad-status') === 'filled') {
        setAdFilled(true)
        observer.disconnect()
      }
    }

    const observer = new MutationObserver(checkFilled)
    observer.observe(adRef.current, { attributes: true, attributeFilter: ['data-ad-status'] })

    // Check immediately in case it was already set
    checkFilled()

    return () => observer.disconnect()
  }, [adsReady])

  // Don't render anything if ads are disabled or not configured
  if (!showAds || !publisherId) return null

  const preset = SIZE_STYLES[size]

  return (
    <div
      className={cn(
        'ad-unit overflow-hidden rounded-lg',
        // Hide the wrapper entirely until an ad actually fills
        adFilled ? 'bg-muted/30 border border-border/50' : 'h-0 overflow-hidden',
        className
      )}
    >
      {adFilled && (
        <div className="text-[10px] text-muted-foreground/50 text-center py-0.5 select-none">
          Advertisement
        </div>
      )}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={preset.style}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={preset.format}
        data-full-width-responsive="true"
        {...(channel ? { 'data-ad-channel': channel } : {})}
        {...(size === 'inline' ? { 'data-ad-layout-key': '-6t+ed+2i-1n-4w' } : {})}
      />
    </div>
  )
}
