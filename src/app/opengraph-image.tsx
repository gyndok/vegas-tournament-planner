import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export const alt = 'NextRebuy — Vegas Poker Tournament Planner'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  let tournamentCount = 0
  let seriesCount = 0
  try {
    const svc = createAdminClient()
    const [{ count: tc }, { count: sc }] = await Promise.all([
      svc.from('tournaments').select('*', { count: 'exact', head: true }),
      svc.from('series').select('*', { count: 'exact', head: true }),
    ])
    tournamentCount = tc ?? 0
    seriesCount = sc ?? 0
  } catch {
    // Best-effort. If the DB call fails, fall through with zeros.
  }

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

        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          NextRebuy
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            marginTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -2,
              color: '#fff',
            }}
          >
            Plan Your Vegas
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -2,
              color: '#fbbf24',
              marginTop: 4,
            }}
          >
            Poker Trip
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#cbd5e1',
              marginTop: 32,
              maxWidth: 980,
              lineHeight: 1.3,
            }}
          >
            WSOP, Wynn, Venetian, Aria, Resorts World — every major series. Build
            your schedule, run Last Longer Pools, track your bankroll.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '1px solid #1e293b',
            paddingTop: 24,
          }}
        >
          <div style={{ display: 'flex', gap: 64 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 44, fontWeight: 800 }}>
                {tournamentCount.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: 18,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginTop: 2,
                }}
              >
                Tournaments
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 44, fontWeight: 800 }}>{seriesCount}</span>
              <span
                style={{
                  fontSize: 18,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginTop: 2,
                }}
              >
                Series
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24' }}>
                Free
              </span>
              <span
                style={{
                  fontSize: 18,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginTop: 2,
                }}
              >
                Always
              </span>
            </div>
          </div>
          <div style={{ fontSize: 28, color: '#cbd5e1', fontWeight: 600 }}>
            nextrebuy.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
