'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, MessageSquare, Calendar, Settings, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const desktopLinks = [
  { href: '/browse', label: 'Browse' },
  { href: '/chat', label: 'Chat' },
  { href: '/schedule', label: 'Schedule' },
]

const mobileLinks = [
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop navigation - horizontal top bar */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between border-b border-[#2a2a2a] bg-[#0a0a0a]/95 backdrop-blur-sm px-6">
        <Link href="/" className="text-xl font-bold text-green-500 tracking-tight">
          VTP
        </Link>

        <div className="flex items-center gap-1">
          {desktopLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'text-green-500 bg-green-500/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href="/login">
            <LogIn className="size-4" />
            Sign In
          </Link>
        </Button>
      </nav>

      {/* Mobile navigation - fixed bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#2a2a2a] bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                  isActive
                    ? 'text-green-500'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-medium">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
