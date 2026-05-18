import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export const alt = 'My Vegas poker schedule'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface ScheduleRow {
  priority: 'target' | 'backup' | 'maybe'
  tournament: {
    name: string
    date: string
    start_time: string
    buy_in: number | null
    series: { venue?: string | null } | null
  } | null
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime12(t: string): string {
  const [hStr, mStr] = (t || '00:00').split(':')
  const h = Number(hStr)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${(mStr ?? '00').padStart(2, '0')} ${ampm}`
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s
}

const MAX_LISTED = 8

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const svc = createAdminClient()

  const { data: prefs } = await svc
    .from('user_preferences')
    .select('user_id, share_enabled, trip_start, trip_end')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .maybeSingle()

  let entries: ScheduleRow[] = []
  if (prefs) {
    const { data } = await svc
      .from('user_schedule')
      .select('priority, tournament:tournament_id(name, date, start_time, buy_in, series:series_id(venue))')
      .eq('user_id', prefs.user_id)
      .order('created_at', { ascending: true })
    entries = (data ?? []) as unknown as ScheduleRow[]
  }

  // Sort by date ascending, prioritize targets first then by date
  const sorted = entries
    .filter((e) => e.tournament != null)
    .sort((a, b) => {
      const da = a.tournament?.date ?? ''
      const db = b.tournament?.date ?? ''
      if (da !== db) return da < db ? -1 : 1
      const ta = a.tournament?.start_time ?? ''
      const tb = b.tournament?.start_time ?? ''
      return ta < tb ? -1 : 1
    })

  const visible = sorted.slice(0, MAX_LISTED)
  const overflow = Math.max(0, sorted.length - MAX_LISTED)

  const tripRange =
    prefs?.trip_start && prefs?.trip_end
      ? `${formatDate(prefs.trip_start)} – ${formatDate(prefs.trip_end)}`
      : sorted.length > 0
      ? `${formatDate(sorted[0].tournament!.date)} – ${formatDate(
          sorted[sorted.length - 1].tournament!.date
        )}`
      : 'My Vegas Schedule'

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
          padding: '52px 64px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 8,
            background:
              'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)',
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 18,
                color: '#94a3b8',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              NextRebuy
            </span>
            <span style={{ fontSize: 48, fontWeight: 800, marginTop: 4, letterSpacing: -1 }}>
              My Vegas Schedule
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: 16, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {sorted.length} event{sorted.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 22, color: '#fbbf24', fontWeight: 700, marginTop: 2 }}>
              {tripRange}
            </span>
          </div>
        </div>

        {/* Event list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: 8,
          }}
        >
          {visible.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: 28,
              }}
            >
              No events added yet
            </div>
          ) : (
            visible.map((e, i) => {
              const t = e.tournament!
              const venue = t.series?.venue?.trim() || 'Vegas'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderLeft: '3px solid #fbbf24',
                  }}
                >
                  <span
                    style={{
                      width: 130,
                      fontSize: 18,
                      color: '#cbd5e1',
                      fontWeight: 600,
                    }}
                  >
                    {formatDate(t.date)}
                  </span>
                  <span
                    style={{
                      width: 90,
                      fontSize: 16,
                      color: '#94a3b8',
                    }}
                  >
                    {formatTime12(t.start_time)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {truncate(t.name, 50)}
                  </span>
                  <span
                    style={{
                      width: 140,
                      fontSize: 16,
                      color: '#94a3b8',
                      textAlign: 'right',
                    }}
                  >
                    {truncate(venue, 14)}
                  </span>
                  <span
                    style={{
                      width: 110,
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#fbbf24',
                      textAlign: 'right',
                    }}
                  >
                    {t.buy_in != null ? formatMoney(t.buy_in) : 'TBD'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #1e293b',
            paddingTop: 20,
            marginTop: 12,
            fontSize: 18,
            color: '#cbd5e1',
          }}
        >
          <span>
            {overflow > 0 ? `+ ${overflow} more event${overflow === 1 ? '' : 's'} · ` : ''}
            Plan your Vegas trip free
          </span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>nextrebuy.com</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
