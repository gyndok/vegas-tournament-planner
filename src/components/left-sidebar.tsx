'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Calendar,
  MessageSquare,
  Newspaper,
  Settings,
  HelpCircle,
  MessageSquareText,
  LogOut,
  LogIn,
  Crown,
  PanelLeftClose,
  PanelLeft,
  Shield,
  Plane,
  Sparkles,
  Loader2,
  CheckCircle2,
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
  { href: '/trip', label: 'Trip Planner', icon: Plane },
  { href: '/chat', label: 'AI Advisor', icon: MessageSquare },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useUser()
  const { toggleLeft, isLeftOpen } = useSidebar()
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const isPro = user?.user_metadata?.subscription_tier === 'pro'

  async function handleUpgrade() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('Checkout error:', data.error)
        setCheckoutLoading(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutLoading(false)
    }
  }

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
    router.push('/login')
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Branding */}
      <div className={cn('flex items-center h-14 shrink-0 border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        {collapsed ? (
          <Link href="/" className="flex items-center justify-center">
            <Image src="/logo-square.png" alt="NextRebuy" width={32} height={32} className="rounded-full" />
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-square.png" alt="NextRebuy" width={36} height={36} className="rounded-full shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-primary tracking-tight">NextRebuy</span>
              <span className="text-[10px] text-sidebar-foreground/60 -mt-1">Plan Your Grind</span>
            </div>
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
          {/* Help / FAQ */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href="/faq" className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <HelpCircle className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Help & FAQ</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/faq" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <HelpCircle className="size-5" />
              <span>Help & FAQ</span>
            </Link>
          )}

          {/* Feedback */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href="/feedback" className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <MessageSquareText className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Feedback</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/feedback" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <MessageSquareText className="size-5" />
              <span>Feedback</span>
            </Link>
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

          {/* Pro upgrade / status */}
          {!loading && user && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              {isPro ? (
                collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center rounded-lg p-2.5">
                        <Crown className="size-5 text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>Pro Member</TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="rounded-lg bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Crown className="size-4" />
                      <span>Pro Member</span>
                      <CheckCircle2 className="size-3.5 ml-auto" />
                    </div>
                  </div>
                )
              ) : (
                collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleUpgrade}
                        disabled={checkoutLoading}
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-amber-500 hover:bg-sidebar-accent transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <Sparkles className="size-5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>Go Pro — $4.99</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 p-3 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Sparkles className="size-4" />
                      <span>Go Pro</span>
                      <span className="ml-auto text-[10px] text-sidebar-foreground/60">$4.99</span>
                    </div>
                    <p className="text-[10px] text-sidebar-foreground/50 mt-1">
                      {checkoutLoading ? 'Redirecting to checkout...' : 'Remove all ads forever'}
                    </p>
                  </button>
                )
              )}
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
