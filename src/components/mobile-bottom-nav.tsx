'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, MessageSquare, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.href === '/'
            ? pathname === '/'
            : pathname === tab.href || pathname.startsWith(tab.href + '/')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] min-h-[44px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-6" />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
