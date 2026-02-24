import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SERIES_COLORS } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBuyIn(amount: number): string {
  return '$' + amount.toLocaleString('en-US')
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getSeriesColor(seriesName: string, venue?: string, tournamentName?: string) {
  const searchStr = `${seriesName} ${venue || ''} ${tournamentName || ''}`.toLowerCase()
  const key = Object.keys(SERIES_COLORS).find(k =>
    k !== 'default' && searchStr.includes(k.toLowerCase())
  )
  return SERIES_COLORS[key || 'default']
}
