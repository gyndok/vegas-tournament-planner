import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTournamentQuery, buildCountQuery, encodeCursor, decodeCursor } from '@/lib/queries'
import { TournamentFilters, PaginatedTournamentsResponse } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const supabase = await createClient()

  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 30
  const cursor = searchParams.get('cursor') || undefined

  const filters: TournamentFilters = {
    dateFrom: searchParams.get('dateFrom') || new Date().toISOString().split('T')[0],
    dateTo: searchParams.get('dateTo') || undefined,
    seriesIds: searchParams.getAll('seriesId').filter(Boolean),
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
    limit: limit + 1,
  }

  let query = buildTournamentQuery(supabase, filters)

  // Apply cursor for default date/time sort
  if (cursor) {
    const { date, startTime, id } = decodeCursor(cursor)
    if (!filters.sortBy && !filters.hasGuarantee) {
      query = query.or(`date.gt.${date},and(date.eq.${date},start_time.gt.${startTime}),and(date.eq.${date},start_time.eq.${startTime},id.gt.${id})`)
    }
  }

  const [dataResult, countResult] = await Promise.all([
    query,
    buildCountQuery(supabase, filters),
  ])

  if (dataResult.error) {
    return NextResponse.json({ error: dataResult.error.message }, { status: 500 })
  }

  const allRows = dataResult.data || []
  const hasMore = allRows.length > limit
  const data = hasMore ? allRows.slice(0, limit) : allRows

  let nextCursor: string | null = null
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1]
    nextCursor = encodeCursor(lastItem.date, lastItem.start_time, lastItem.id)
  }

  const response: PaginatedTournamentsResponse = {
    data,
    nextCursor,
    totalCount: countResult.count ?? data.length,
  }

  return NextResponse.json(response)
}
