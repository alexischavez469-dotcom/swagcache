'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Radio, Search, Trophy, Zap } from 'lucide-react'
import type { NflGame, Prop } from '@/lib/props-data'
import { SearchBar } from '@/components/search-bar'
import { PropCard } from '@/components/prop-card'
import { GameBoard } from '@/components/game-board'

type Tab = 'props' | 'games'

export function PropLabClient({
  props,
  live,
  error,
  games,
  gamesError,
}: {
  props: Prop[]
  live: boolean
  error?: string
  games: NflGame[]
  gamesError?: string
}) {
  const [tab, setTab] = useState<Tab>('props')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.filter((p) =>
      !q ||
      p.player.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.teamAbbr.toLowerCase().includes(q) ||
      p.opponent.toLowerCase().includes(q) ||
      p.propType.toLowerCase().includes(q)
    )
  }, [props, query])

  const bestEdges = useMemo(
    () => [...filtered].sort((a, b) => b.confidence - a.confidence),
    [filtered],
  )

  const totalPages = Math.max(1, Math.ceil(bestEdges.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageProps = bestEdges.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="mx-auto min-h-screen w-full max-w-md">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-none">
            <h1 className="text-base font-semibold tracking-tight">NFL Prop Lab</h1>
            <p className="text-xs text-muted-foreground">FanDuel + NFLMeta analysis</p>
          </div>
          {live && (
            <span className="ml-auto flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Radio className="size-3" /> Live Data
            </span>
          )}
        </div>

        <div className="mx-4 mb-3 grid grid-cols-2 rounded-xl bg-secondary p-1">
          <button
            onClick={() => setTab('props')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === 'props' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5" /> Props</span>
          </button>
          <button
            onClick={() => setTab('games')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === 'games' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <span className="inline-flex items-center gap-1.5"><Trophy className="size-3.5" /> Scores & Games</span>
          </button>
        </div>

        {tab === 'props' && (
          <div className="px-4 pb-3">
            <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(1) }} />
          </div>
        )}
      </header>

      <main className="px-4 pb-16 pt-4">
        {tab === 'games' ? (
          <GameBoard games={games} error={gamesError} />
        ) : (
          <>
            {!live && error && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold">Live prop data is not connected</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3 flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Best NFL Edges</h2>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {bestEdges.length} props
              </span>
            </div>

            {bestEdges.length > 0 ? (
              <>
                <div className="space-y-3">
                  {pageProps.map((prop) => <PropCard key={prop.id} prop={prop} />)}
                </div>
                {totalPages > 1 && (
                  <nav className="mt-5 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="min-w-20 text-center font-mono text-xs text-muted-foreground">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No live NFL FanDuel props available.
              </div>
            )}

            <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
              FanDuel props: SportsGameOdds · opponent matchup: ESPN · player role/season usage and scores: NFLMeta. 10 props per page. Not betting advice.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
