import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTournamentQuery } from '@/lib/queries'
import { TournamentFilters } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const supabase = await createClient()

  const filters: TournamentFilters = {
    dateFrom: searchParams.get('dateFrom') || new Date().toISOString().split('T')[0],
    dateTo: searchParams.get('dateTo') || undefined,
    seriesIds: searchParams.getAll('seriesId').filter(Boolean),
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
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  }

  const { data, error } = await buildTournamentQuery(supabase, filters)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
