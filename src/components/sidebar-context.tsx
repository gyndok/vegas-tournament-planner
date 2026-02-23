'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface SidebarContextValue {
  isLeftOpen: boolean
  isLeftMobileOpen: boolean
  isRightOpen: boolean
  toggleLeft: () => void
  toggleRight: () => void
  setLeftMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY_LEFT = 'sidebar-left-open'
const STORAGE_KEY_RIGHT = 'sidebar-right-open'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isLeftOpen, setIsLeftOpen] = useState(true)
  const [isLeftMobileOpen, setIsLeftMobileOpen] = useState(false)
  const [isRightOpen, setIsRightOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage + set responsive defaults
  useEffect(() => {
    setMounted(true)

    const storedLeft = localStorage.getItem(STORAGE_KEY_LEFT)
    const storedRight = localStorage.getItem(STORAGE_KEY_RIGHT)

    const isDesktop = window.matchMedia('(min-width: 1280px)').matches
    const isTablet = window.matchMedia('(min-width: 768px)').matches

    // Left sidebar: expanded on desktop, collapsed on tablet, hidden on mobile
    if (storedLeft !== null) {
      setIsLeftOpen(storedLeft === 'true')
    } else {
      setIsLeftOpen(isDesktop)
    }

    // Right sidebar: only visible on desktop
    if (storedRight !== null) {
      setIsRightOpen(storedRight === 'true' && isDesktop)
    } else {
      setIsRightOpen(isDesktop)
    }

    // Listen for resize to auto-hide right sidebar
    const handleResize = () => {
      const nowDesktop = window.matchMedia('(min-width: 1280px)').matches
      if (!nowDesktop) {
        setIsRightOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleLeft = useCallback(() => {
    setIsLeftOpen(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY_LEFT, String(next))
      return next
    })
  }, [])

  const toggleRight = useCallback(() => {
    setIsRightOpen(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY_RIGHT, String(next))
      return next
    })
  }, [])

  const handleSetLeftMobileOpen = useCallback((open: boolean) => {
    setIsLeftMobileOpen(open)
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        isLeftOpen,
        isLeftMobileOpen,
        isRightOpen,
        toggleLeft,
        toggleRight,
        setLeftMobileOpen: handleSetLeftMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
