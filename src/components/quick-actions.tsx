'use client'

import Link from 'next/link'
import { Search, MessageSquare, Download } from 'lucide-react'

const actions = [
  { href: '/browse', label: 'Browse', icon: Search, description: 'Find tournaments' },
  { href: '/chat', label: 'AI Advisor', icon: MessageSquare, description: 'Plan your grind' },
]

export function QuickActions() {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Quick Actions
      </h3>
      <div className="space-y-1">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icon className="size-4" />
              <div>
                <div className="font-medium">{action.label}</div>
                <div className="text-xs opacity-70">{action.description}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
