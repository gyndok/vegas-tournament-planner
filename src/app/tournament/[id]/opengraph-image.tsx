import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export const alt = 'Vegas poker tournament details'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface OGData {
  name: string
  date: string
  start_time: string
  buy_in: number | null
  guaranteed_prize: number | null
  series: { name?: string | null; venue?: string | null } | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime12(t: string): string {
  const [hStr, mStr] = (t || '00:00').split(':')
  const h = Number(hStr)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${mStr ?? '00'} ${ampm}`
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const svc = createAdminClient()
  const column = UUID_RE.test(id) ? 'id' : 'slug'
  const { data } = await svc
    .from('tournaments')
    .select('name, date, start_time, buy_in, guaranteed_prize, series:series_id(name, venue)')
    .eq(column, id)
    .maybeSingle<OGData>()

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0e1a',
            color: '#fff',
            fontSize: 48,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          NextRebuy — Tournament not found
        </div>
      ),
      { ...size }
    )
  }

  const venue = data.series?.venue?.trim() || 'Las Vegas'
  const seriesName = data.series?.name?.trim() || ''
  const dateLabel = formatDate(data.date)
  const timeLabel = formatTime12(data.start_time)
  const buyInLabel = data.buy_in != null ? formatMoney(data.buy_in) : 'TBD'
  const gtdLabel = data.guaranteed_prize ? formatMoney(data.guaranteed_prize) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #0a0e1a 0%, #131a2e 60%, #1a2238 100%)',
          color: '#fff',
          padding: '64px 72px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 8,
            background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)',
          }}
        />

        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#94a3b8',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          <span>NextRebuy</span>
          <span>Vegas Poker Tournament</span>
        </div>

        {/* Tournament name */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: data.name.length > 60 ? 56 : 72,
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#fff',
              letterSpacing: -1,
            }}
          >
            {data.name}
          </div>
          {seriesName && (
            <div
              style={{
                fontSize: 28,
                color: '#fbbf24',
                marginTop: 18,
                fontWeight: 600,
              }}
            >
              {seriesName}
              {venue && seriesName !== venue ? ` · ${venue}` : ''}
            </div>
          )}
        </div>

        {/* Footer row: date | buy-in | gtd */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '1px solid #1e293b',
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 18, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Date
            </span>
            <span style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>{dateLabel}</span>
            <span style={{ fontSize: 22, color: '#cbd5e1', marginTop: 4 }}>{timeLabel}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Buy-in
            </span>
            <span style={{ fontSize: 56, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>{buyInLabel}</span>
          </div>

          {gtdLabel && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 18, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Guaranteed
              </span>
              <span style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>{gtdLabel}</span>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
