import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing-page'
import { DashboardAuthenticated } from '@/components/dashboard-authenticated'
import { JsonLd } from '@/components/json-ld'
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return <DashboardAuthenticated />
  }

  // Fetch live stats for landing page
  const { count: tournamentCount } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })

  const { count: seriesCount } = await supabase
    .from('series')
    .select('*', { count: 'exact', head: true })

  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <LandingPage
        tournamentCount={tournamentCount ?? 0}
        seriesCount={seriesCount ?? 0}
      />
    </>
  )
}
