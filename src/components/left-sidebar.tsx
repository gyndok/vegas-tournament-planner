'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Calendar,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
  LogIn,
  Crown,
  PanelLeftClose,
  PanelLeft,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSidebar } from '@/components/sidebar-context'
import { useUser } from '@/hooks/use-user'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/schedule', label: 'My Schedule', icon: Calendar },
  { href: '/chat', label: 'AI Advisor', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useUser()
  const { toggleLeft, isLeftOpen } = useSidebar()

  const isAdmin = (() => {
    if (!user?.email) return false
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
    if (!adminEmails) return false
    const allowed = adminEmails.split(',').map((e) => e.trim().toLowerCase())
    return allowed.includes(user.email.toLowerCase())
  })()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Branding */}
      <div className={cn('flex items-center h-14 shrink-0 border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        {collapsed ? (
          <Link href="/" className="text-lg font-bold text-sidebar-primary">
            N
          </Link>
        ) : (
          <Link href="/" className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-primary tracking-tight">NextRebuy</span>
            <span className="text-[10px] text-sidebar-foreground/60 -mt-1">Plan Your Grind</span>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className={cn('space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/')

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {link}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}

          {/* Admin link — only visible for admin users */}
          {isAdmin && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              {(() => {
                const isAdminActive = pathname.startsWith('/admin')
                const adminLink = (
                  <Link
                    href="/admin/import"
                    className={cn(
                      'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                      isAdminActive
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <Shield className="size-5 shrink-0" />
                    {!collapsed && <span>Admin</span>}
                  </Link>
                )

                if (collapsed) {
                  return (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        {adminLink}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        Admin
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return adminLink
              })()}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Bottom section */}
      <div className={cn('shrink-0 border-t border-sidebar-border', collapsed ? 'px-2 py-2' : 'px-3 py-3')}>
        <div className="space-y-1">
          {/* Help */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <HelpCircle className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Help</TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <HelpCircle className="size-5" />
              <span>Help</span>
            </button>
          )}

          {/* Auth action */}
          {!loading && (
            <>
              {user ? (
                collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive transition-colors"
                      >
                        <LogOut className="size-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>Sign Out</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive transition-colors"
                  >
                    <LogOut className="size-5" />
                    <span>Sign Out</span>
                  </button>
                )
              ) : (
                collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href="/login"
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-primary hover:bg-sidebar-accent transition-colors"
                      >
                        <LogIn className="size-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>Sign In</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    href="/login"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-primary hover:bg-sidebar-accent transition-colors"
                  >
                    <LogIn className="size-5" />
                    <span>Sign In</span>
                  </Link>
                )
              )}
            </>
          )}

          {!collapsed && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              {/* Upgrade placeholder */}
              <div className="rounded-lg bg-sidebar-accent/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/70">
                  <Crown className="size-4 text-amber-500" />
                  <span>Upgrade to Pro</span>
                </div>
                <p className="text-[10px] text-sidebar-foreground/50 mt-1">
                  Coming soon
                </p>
              </div>
            </>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden md:block mt-2">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleLeft}
                  className="flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <PanelLeft className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Expand sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={toggleLeft}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <PanelLeftClose className="size-5" />
              <span>Collapse</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function LeftSidebar() {
  const { isLeftOpen, isLeftMobileOpen, setLeftMobileOpen } = useSidebar()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex shrink-0 border-r border-sidebar-border transition-[width] duration-200 ease-in-out',
          isLeftOpen ? 'w-64' : 'w-16'
        )}
      >
        <SidebarContent collapsed={!isLeftOpen} />
      </aside>

      {/* Mobile sidebar (Sheet drawer) */}
      <Sheet open={isLeftMobileOpen} onOpenChange={setLeftMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
