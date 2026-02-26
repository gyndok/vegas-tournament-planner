'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from '@/components/sidebar-context'
import { AdProvider } from '@/components/ad-context'
import { LeftSidebar } from '@/components/left-sidebar'
import { TopHeader } from '@/components/top-header'
import { RightSidebar } from '@/components/right-sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { ServiceWorkerRegistration } from '@/components/sw-registration'
import { InstallPrompt } from '@/components/install-prompt'

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <AdProvider>
      <ServiceWorkerRegistration />
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar */}
        <LeftSidebar />

        {/* Right section: header + main + right sidebar */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top header */}
          <TopHeader />

          {/* Content row: main + right sidebar */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main content - scrollable */}
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
              {children}
            </main>

            {/* Right sidebar */}
            <RightSidebar />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
      <InstallPrompt />
      </AdProvider>
    </SidebarProvider>
  )
}
