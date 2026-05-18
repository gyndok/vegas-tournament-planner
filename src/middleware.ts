import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from '@/lib/rate-limit'

const CHIP_UPDATE = /^\/api\/pools\/[^/]+\/members\/[^/]+$/
const JOIN_ROUTE = /^\/api\/pools\/by-token\/[^/]+\/join$/

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (request.method === 'PATCH' && CHIP_UPDATE.test(path)) {
    const ip = clientKey(request)
    const { ok, retryAfterMs } = checkRateLimit(`chip:${ip}:${path}`, 1, 60_000)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many chip updates — try again in a moment' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (request.method === 'POST' && JOIN_ROUTE.test(path)) {
    const ip = clientKey(request)
    const { ok, retryAfterMs } = checkRateLimit(`join:${ip}`, 5, 60_000)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many join attempts — try again in a minute' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
