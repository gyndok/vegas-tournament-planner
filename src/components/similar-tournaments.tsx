import { createClient } from '@/lib/supabase/server'
import { getSimilarTournaments } from '@/lib/queries'
import { TournamentCard } from '@/components/tournament-card'
import { Tournament } from '@/types'

interface SimilarTournamentsProps {
  tournament: {
    id: string
    date: string
    buy_in: number
    game_type: string
    event_number: number
    series_id: string
  }
}

export async function SimilarTournaments({ tournament }: SimilarTournamentsProps) {
  const supabase = await createClient()
  const { data: similar } = await getSimilarTournaments(supabase, tournament)

  if (!similar || similar.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Similar Tournaments</h2>
        <span className="text-sm text-muted-foreground">
          {similar.length} found
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {(similar as Tournament[]).map((t) => (
          <div key={t.id} className="min-w-[300px] max-w-[350px] snap-start shrink-0">
            <TournamentCard tournament={t} />
          </div>
        ))}
      </div>
    </div>
  )
}
