'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { TournamentFilters } from '@/types'

export function useTournamentFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters: TournamentFilters = useMemo(() => ({
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
    gameTypes: searchParams.getAll('gameType').filter(Boolean),
    formats: searchParams.getAll('format').filter(Boolean),
    tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
    sortBy: (searchParams.get('sortBy') as TournamentFilters['sortBy']) || undefined,
  }), [searchParams])

  const setFilter = useCallback((key: string, value: string | string[] | null) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v))
      } else {
        params.set(key, value)
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const resetFilters = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const filterCount = useMemo(() => {
    let count = 0
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.buyInMin !== undefined || filters.buyInMax !== undefined) count++
    if (filters.gameTypes?.length) count++
    if (filters.formats?.length) count++
    if (filters.tableSizes?.length) count++
    return count
  }, [filters])

  return { filters, setFilter, resetFilters, filterCount }
}
