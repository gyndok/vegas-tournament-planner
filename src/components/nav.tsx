'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, MessageSquare, Calendar, Settings, LogIn, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'

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
  const router = useRouter()
  const { user, loading } = useUser()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  function getUserInitial(): string {
    if (!user) return '?'
    const email = user.email ?? ''
    return email.charAt(0).toUpperCase() || '?'
  }

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

        {!loading && (
          <>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-9 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm p-0"
                  >
                    {getUserInitial()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="size-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/schedule" className="cursor-pointer">
                      <Calendar className="size-4 mr-2" />
                      My Schedule
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="size-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">
                  <LogIn className="size-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </>
        )}

        {loading && <div className="w-9 h-9" />}
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

          {/* Mobile user icon / sign-in */}
          {!loading && !user && (
            <Link
              href="/login"
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                pathname === '/login'
                  ? 'text-green-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LogIn className="size-5" />
              <span className="text-[10px] font-medium">Sign In</span>
            </Link>
          )}

          {!loading && user && (
            <Link
              href="/settings"
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                pathname === '/settings'
                  ? 'text-green-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <User className="size-5" />
              <span className="text-[10px] font-medium">{getUserInitial()}</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
