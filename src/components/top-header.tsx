'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, User, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/sidebar-context'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'
import { GlobalSearch } from '@/components/global-search'
import { PdtClock } from '@/components/pdt-clock'
import Link from 'next/link'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/browse': 'Browse Tournaments',
  '/schedule': 'My Schedule',
  '/chat': 'AI Advisor',
  '/settings': 'Settings',
  '/login': 'Sign In',
  '/admin/import': 'Admin Import',
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname]

  // Tournament detail
  if (pathname.startsWith('/tournament/')) return 'Tournament Details'

  // Prefix match
  for (const [path, title] of Object.entries(pageTitles)) {
    if (path !== '/' && pathname.startsWith(path)) return title
  }

  return 'NextRebuy'
}

export function TopHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { setLeftMobileOpen } = useSidebar()
  const { user, loading } = useUser()

  const pageTitle = getPageTitle(pathname)

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
    <header className="flex items-center h-14 shrink-0 border-b border-border bg-background px-4 gap-4">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0 size-8"
          onClick={() => setLeftMobileOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="text-sm font-semibold truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Center: search */}
      <div className="hidden sm:flex flex-1 justify-center">
        <GlobalSearch />
      </div>

      {/* Right: theme toggle, clock, user */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div className="hidden lg:block">
          <PdtClock />
        </div>

        <ThemeToggle />

        {/* User menu */}
        {!loading && (
          <>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-8 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs p-0"
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
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link href="/login">
                  Sign In
                </Link>
              </Button>
            )}
          </>
        )}

        {loading && <div className="w-8 h-8" />}
      </div>
    </header>
  )
}
