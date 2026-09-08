'use client'

import { Clock3, Radio, Trophy } from 'lucide-react'
import type { NflGame } from '@/lib/props-data'

function formatKickoff(raw?: string): string {
  if (!raw) return 'Time TBD'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function GameBoard({ games, error }: { games: NflGame[]; error?: string }) {
  const live = games.filter((g) => g.status === 'live')
  const upcoming = games.filter((g) => g.status === 'scheduled' || g.status === 'unknown')
  const finals = games.filter((g) => g.status === 'final').slice(-8).reverse()

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-muted-foreground">
          {error}
        </div>
      )}

      {live.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Live</h2>
          </div>
          <div className="space-y-2">
            {live.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Clock3 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Upcoming Games</h2>
        </div>
        {upcoming.length ? (
          <div className="space-y-2">
            {upcoming.slice(0, 16).map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No upcoming games returned by NFLMeta.
          </div>
        )}
      </section>

      {finals.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Recent Finals</h2>
          </div>
          <div className="space-y-2">
            {finals.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function GameCard({ game }: { game: NflGame }) {
  const showScore = game.awayScore != null || game.homeScore != null
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{game.week ? `Week ${game.week}` : 'NFL'}</span>
        <span>{game.status === 'live' ? (game.detail || 'LIVE') : formatKickoff(game.kickoff)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
        <span className="font-medium">{game.away}</span>
        <span className="font-mono font-semibold">{showScore ? game.awayScore ?? '-' : ''}</span>
        <span className="font-medium">{game.home}</span>
        <span className="font-mono font-semibold">{showScore ? game.homeScore ?? '-' : ''}</span>
      </div>
    </article>
  )
}
