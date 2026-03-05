import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatBuyIn, formatTime, formatDate, getSeriesColor } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Clock, DollarSign, Users, Layers, ExternalLink } from 'lucide-react'
import { AddToScheduleButton } from '@/components/add-to-schedule-button'
import { FavoriteButton } from '@/components/favorite-button'
import { SimilarTournaments } from '@/components/similar-tournaments'
import { AdUnit } from '@/components/ad-unit'
import { LateRegBadge } from '@/components/late-reg-badge'
import { Tournament, Series } from '@/types'

interface TournamentWithSeries extends Omit<Tournament, 'series'> {
  series: Series | null
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('*, series:series_id(*)')
    .eq('id', id)
    .single<TournamentWithSeries>()

  if (error || !tournament) {
    notFound()
  }

  const seriesName = tournament.series?.name || 'Unknown Series'
  const seriesColor = getSeriesColor(seriesName, tournament.series?.venue, tournament.name)
  const isWsop = `${seriesName} ${tournament.series?.venue || ''} ${tournament.name}`.toLowerCase().includes('wsop')

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Back link */}
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Browse
      </Link>

      {/* Series badge */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${seriesColor.bg} ${seriesColor.text}`}
        >
          {seriesColor.label} #{tournament.event_number}
        </span>
        <FavoriteButton tournamentId={tournament.id} />
      </div>

      {/* Event name */}
      <h1 className="text-2xl md:text-3xl font-bold leading-tight">
        {tournament.name}
      </h1>

      {/* Key info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Date */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              Date & Time
            </p>
            <p className="text-sm font-semibold">
              {formatDate(tournament.date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tournament.day_of_week} at {formatTime(tournament.start_time)}
            </p>
          </CardContent>
        </Card>

        {/* Buy-in */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="size-3" />
              Buy-in
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatBuyIn(tournament.buy_in)}
            </p>
          </CardContent>
        </Card>

        {/* Table Size */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="size-3" />
              Table Size
            </p>
            <p className="text-sm font-semibold">
              {tournament.table_size}-max
            </p>
          </CardContent>
        </Card>

        {/* Guarantee */}
        {tournament.guaranteed_prize && tournament.guaranteed_prize > 0 && (
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="size-3" />
                Guarantee
              </p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatBuyIn(tournament.guaranteed_prize)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Game type, format, badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{tournament.game_type}</Badge>
        <Badge variant="outline">{tournament.format}</Badge>
        {tournament.table_size !== 9 && (
          <Badge variant="outline">{tournament.table_size}-max</Badge>
        )}
      </div>

      {/* Tournament Details */}
      <Card className="border-border bg-card">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Tournament Details</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            {tournament.starting_stack && (
              <>
                <span className="text-muted-foreground">Starting Stack</span>
                <span className="font-medium">{tournament.starting_stack.toLocaleString()}</span>
              </>
            )}
            {tournament.blind_levels_minutes && (
              <>
                <span className="text-muted-foreground">Blind Levels</span>
                <span className="font-medium">{tournament.blind_levels_minutes} min</span>
              </>
            )}
            {tournament.late_reg_levels && (
              <>
                <span className="text-muted-foreground">Late Reg Levels</span>
                <span className="font-medium">{tournament.late_reg_levels} levels</span>
              </>
            )}
            {tournament.late_reg_end_time && (
              <>
                <span className="text-muted-foreground">Late Reg Ends</span>
                <span className="font-medium">{formatTime(tournament.late_reg_end_time)}</span>
              </>
            )}
            {tournament.estimated_duration_hours && (
              <>
                <span className="text-muted-foreground">Est. Duration</span>
                <span className="font-medium">{tournament.estimated_duration_hours} hours</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Late Registration Countdown */}
      <LateRegBadge tournament={tournament as Tournament} size="lg" showStatic={true} />

      {/* Structure sheet link (WSOP only) */}
      {isWsop && (
        <a
          href="https://wsop.gg-global-cdn.com/wsop/5c0762b2-a033-4bf5-8725-735e3a61c42d.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          <ExternalLink className="size-4" />
          View WSOP Structure Sheets (PDF)
        </a>
      )}

      {/* Flight info */}
      {tournament.is_flight && tournament.flight_label && (
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Flight Information</h2>
            <p className="text-sm text-muted-foreground">
              This is <span className="font-medium text-foreground">Flight {tournament.flight_label}</span>
              {tournament.parent_event_number && (
                <> of Event #{tournament.parent_event_number}</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {tournament.notes && (
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Notes</h2>
            <p className="text-sm text-muted-foreground">{tournament.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Venue info */}
      {tournament.series?.venue && (
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Venue</h2>
            <p className="text-sm text-muted-foreground">{tournament.series.venue}</p>
          </CardContent>
        </Card>
      )}

      {/* Add to Schedule button */}
      <AddToScheduleButton tournamentId={tournament.id} tournamentFormat={tournament.format} />

      {/* Contextual ad — appears between actions and similar tournaments */}
      <AdUnit slot="9431137307" size="responsive" channel="tournament_detail" />

      {/* Similar Tournaments */}
      <SimilarTournaments
        tournament={{
          id: tournament.id,
          date: tournament.date,
          buy_in: tournament.buy_in,
          game_type: tournament.game_type,
          event_number: tournament.event_number,
          series_id: tournament.series_id,
        }}
      />
    </div>
  )
}
