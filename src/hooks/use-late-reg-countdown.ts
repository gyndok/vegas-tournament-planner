'use client'

import { useState, useEffect, useMemo } from 'react'
import { Tournament } from '@/types'

export type LateRegStatus = 'not_started' | 'open' | 'closing' | 'urgent' | 'closed' | 'no_data'

interface LateRegCountdown {
  timeRemainingMs: number
  status: LateRegStatus
  formattedTime: string
  lateRegEndDate: Date | null
  isLive: boolean
}

function getNowInVegas(): Date {
  const now = new Date()
  const vegasStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  return new Date(vegasStr)
}

function getTodayInVegas(): string {
  const now = getNowInVegas()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateLateRegEnd(tournament: Tournament): Date | null {
  const tournamentDate = tournament.date

  if (tournament.late_reg_end_time) {
    return new Date(`${tournamentDate}T${tournament.late_reg_end_time}`)
  }

  if (
    tournament.late_reg_levels &&
    tournament.blind_levels_minutes &&
    tournament.start_time
  ) {
    const startDate = new Date(`${tournamentDate}T${tournament.start_time}`)
    const lateRegMinutes = tournament.late_reg_levels * tournament.blind_levels_minutes
    return new Date(startDate.getTime() + lateRegMinutes * 60 * 1000)
  }

  return null
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m'

  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

export function useLateRegCountdown(
  tournament: Tournament,
  intervalMs: number = 60_000
): LateRegCountdown {
  const lateRegEnd = useMemo(() => calculateLateRegEnd(tournament), [
    tournament.date,
    tournament.start_time,
    tournament.late_reg_end_time,
    tournament.late_reg_levels,
    tournament.blind_levels_minutes,
  ])

  const isToday = tournament.date === getTodayInVegas()

  const [countdown, setCountdown] = useState<LateRegCountdown>(() =>
    computeCountdown(lateRegEnd, isToday)
  )

  useEffect(() => {
    setCountdown(computeCountdown(lateRegEnd, isToday))

    if (!lateRegEnd || !isToday) return

    const interval = setInterval(() => {
      setCountdown(computeCountdown(lateRegEnd, isToday))
    }, intervalMs)

    return () => clearInterval(interval)
  }, [lateRegEnd, isToday, intervalMs])

  return countdown
}

function computeCountdown(lateRegEnd: Date | null, isToday: boolean): LateRegCountdown {
  if (!lateRegEnd) {
    return {
      timeRemainingMs: 0,
      status: 'no_data',
      formattedTime: '',
      lateRegEndDate: null,
      isLive: false,
    }
  }

  if (!isToday) {
    return {
      timeRemainingMs: 0,
      status: 'not_started',
      formattedTime: '',
      lateRegEndDate: lateRegEnd,
      isLive: false,
    }
  }

  const now = getNowInVegas()
  const remaining = lateRegEnd.getTime() - now.getTime()

  if (remaining <= 0) {
    return {
      timeRemainingMs: 0,
      status: 'closed',
      formattedTime: '',
      lateRegEndDate: lateRegEnd,
      isLive: false,
    }
  }

  const fifteenMinutes = 15 * 60 * 1000
  const oneHour = 60 * 60 * 1000

  let status: LateRegStatus = 'open'
  if (remaining < fifteenMinutes) {
    status = 'urgent'
  } else if (remaining < oneHour) {
    status = 'closing'
  }

  return {
    timeRemainingMs: remaining,
    status,
    formattedTime: formatCountdown(remaining),
    lateRegEndDate: lateRegEnd,
    isLive: true,
  }
}

export { calculateLateRegEnd, formatCountdown, getTodayInVegas }
