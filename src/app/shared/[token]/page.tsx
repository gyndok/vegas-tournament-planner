import { notFound } from 'next/navigation'
import { SharedScheduleView } from '@/components/shared-schedule-view'

interface SharedPageProps {
  params: Promise<{ token: string }>
}

export default async function SharedSchedulePage({ params }: SharedPageProps) {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const res = await fetch(`${baseUrl}/api/schedule/shared/${token}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    notFound()
  }

  const data = await res.json()

  return <SharedScheduleView entries={data.entries} tripDates={data.tripDates} />
}
