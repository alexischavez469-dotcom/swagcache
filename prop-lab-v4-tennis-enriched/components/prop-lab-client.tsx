'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Radio, Zap } from 'lucide-react'
import type { Prop, Sport } from '@/lib/props-data'
import { SportFilter } from '@/components/sport-filter'
import { SearchBar } from '@/components/search-bar'
import { PropCard } from '@/components/prop-card'

type Filter = Sport | 'All'

export function PropLabClient({
  props,
  live,
  error,
}: {
  props: Prop[]
  live: boolean
  error?: string
}) {
  const [sport, setSport] = useState<Filter>('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.filter((p) => {
      const matchesSport = sport === 'All' || p.sport === sport
      const matchesQuery =
        !q ||
        p.player.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.teamAbbr.toLowerCase().includes(q) ||
        p.opponent.toLowerCase().includes(q) ||
        p.propType.toLowerCase().includes(q)
      return matchesSport && matchesQuery
    })
  }, [props, sport, query])

  const bestEdges = useMemo(
    () => [...filtered].sort((a, b) => b.confidence - a.confidence),
    [filtered],
  )

  const totalPages = Math.max(1, Math.ceil(bestEdges.length / PAGE_SIZE))
  const pageProps = useMemo(
    () => bestEdges.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [bestEdges, page],
  )

  useEffect(() => {
    setPage(1)
  }, [sport, query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="mx-auto min-h-screen w-full max-w-md">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-none">
            <h1 className="text-base font-semibold tracking-tight">Prop Lab</h1>
            <p className="text-xs text-muted-foreground">FanDuel market analysis</p>
          </div>
          {live && (
            <span className="ml-auto flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Radio className="size-3" aria-hidden="true" /> Live
            </span>
          )}
        </div>
        <div className="px-4 pb-3">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <div className="pb-3">
          <SportFilter active={sport} onChange={setSport} />
        </div>
      </header>

      <main className="px-4 pb-16 pt-4">
        {!live && error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-semibold">Live data is not connected</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <Zap className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Best Edges</h2>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {bestEdges.length} {bestEdges.length === 1 ? 'prop' : 'props'}
          </span>
        </div>

        {bestEdges.length > 0 ? (
          <>
            <div className="space-y-3">
              {pageProps.map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Prop pages">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="min-w-20 text-center font-mono text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground text-pretty">
              {live
                ? 'No live FanDuel props match your filters.'
                : 'No live FanDuel props are available yet. The error above shows what needs fixing.'}
            </p>
          </div>
        )}

        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-muted-foreground text-pretty">
          {live
            ? 'Live FanDuel lines via SportsGameOdds. Showing 10 props per page. Opponent-defense matchup context is pulled from ESPN when available. Tennis adds ESPN rankings, 45-day form and recent H2H when matched. Market + context can reach 7/10; 8-10 stays locked until deeper role/serve-return/injury feeds are added. Not betting advice.'
            : 'Sample props are disabled so API problems cannot be hidden.'}
        </p>
      </main>
    </div>
  )
}
