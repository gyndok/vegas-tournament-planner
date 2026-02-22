import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatICSDate(date: string, time: string): string {
  // date: "2026-06-01", time: "12:00:00" or "12:00"
  const [year, month, day] = date.split('-')
  const timeParts = time.split(':')
  const hours = timeParts[0] || '10'
  const minutes = timeParts[1] || '00'
  const seconds = timeParts[2] || '00'
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

function addHours(date: string, time: string, hours: number): string {
  const d = new Date(`${date}T${time}`)
  d.setHours(d.getHours() + hours)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}`
}

function generateUID(id: string): string {
  return `${id}@vegas-tournament-planner`
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: entries, error } = await supabase
    .from('user_schedule')
    .select('*, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vegas Tournament Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Vegas Tournament Schedule',
    'X-WR-TIMEZONE:America/Los_Angeles',
  ]

  for (const entry of entries ?? []) {
    const t = entry.tournament
    if (!t) continue

    const startTime = t.start_time || '10:00:00'
    const normalizedStart = startTime.length === 5 ? startTime + ':00' : startTime
    const duration = t.estimated_duration_hours ?? 10

    const dtStart = formatICSDate(t.date, normalizedStart)
    const dtEnd = addHours(t.date, normalizedStart, duration)

    const descLines: string[] = []
    descLines.push(`Buy-in: $${t.buy_in}`)
    descLines.push(`Game: ${t.game_type}`)
    descLines.push(`Format: ${t.format}`)
    descLines.push(`Priority: ${entry.priority}`)
    if (entry.notes) descLines.push(`Notes: ${entry.notes}`)
    if (t.guaranteed_prize) descLines.push(`Guarantee: $${t.guaranteed_prize.toLocaleString()}`)

    const venue = t.series?.venue ?? ''

    ics.push('BEGIN:VEVENT')
    ics.push(`UID:${generateUID(entry.id)}`)
    ics.push(`DTSTAMP:${now}`)
    ics.push(`DTSTART;TZID=America/Los_Angeles:${dtStart}`)
    ics.push(`DTEND;TZID=America/Los_Angeles:${dtEnd}`)
    ics.push(`SUMMARY:${escapeICS(t.name)}`)
    ics.push(`DESCRIPTION:${escapeICS(descLines.join('\\n'))}`)
    if (venue) ics.push(`LOCATION:${escapeICS(venue)}`)
    ics.push('END:VEVENT')
  }

  ics.push('END:VCALENDAR')

  const icsString = ics.join('\r\n')

  return new NextResponse(icsString, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vegas-tournament-schedule.ics"',
    },
  })
}
