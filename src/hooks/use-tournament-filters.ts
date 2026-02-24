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
    casinos: searchParams.getAll('casino').filter(Boolean),
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
    gameTypes: searchParams.getAll('gameType').filter(Boolean),
    formats: searchParams.getAll('format').filter(Boolean),
    tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
    startTimeFrom: searchParams.get('startTimeFrom') || undefined,
    startTimeTo: searchParams.get('startTimeTo') || undefined,
    avoidTurbos: searchParams.get('avoidTurbos') === 'true',
    hasGuarantee: searchParams.get('hasGuarantee') === 'true',
    guaranteeMin: searchParams.get('guaranteeMin') ? Number(searchParams.get('guaranteeMin')) : undefined,
    guaranteeMax: searchParams.get('guaranteeMax') ? Number(searchParams.get('guaranteeMax')) : undefined,
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

  const batchSetFilters = useCallback((newFilters: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(newFilters)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else {
          params.set(key, value)
        }
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname])

  const removeFilters = useCallback((keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    keys.forEach(k => params.delete(k))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const filterCount = useMemo(() => {
    let count = 0
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.buyInMin !== undefined || filters.buyInMax !== undefined) count++
    if (filters.gameTypes?.length) count++
    if (filters.formats?.length) count++
    if (filters.tableSizes?.length) count++
    if (filters.startTimeFrom || filters.startTimeTo) count++
    if (filters.avoidTurbos) count++
    if (filters.casinos?.length) count++
    if (filters.hasGuarantee) count++
    return count
  }, [filters])

  return { filters, setFilter, removeFilters, resetFilters, filterCount, batchSetFilters }
}
