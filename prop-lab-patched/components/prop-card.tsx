'use client'

import { useState } from 'react'
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Swords,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Prop } from '@/lib/props-data'
import { ConfidenceMeter } from '@/components/confidence-meter'
import { Sparkline } from '@/components/sparkline'

const riskTone: Record<Prop['riskLevel'], string> = {
  Low: 'text-primary bg-primary/10 border-primary/20',
  Medium: 'text-warning bg-warning/10 border-warning/20',
  High: 'text-destructive bg-destructive/10 border-destructive/20',
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </div>
      {children}
    </div>
  )
}

export function PropCard({ prop }: { prop: Prop }) {
  const [open, setOpen] = useState(false)
  const isMore = prop.recommendation === 'More'
  const RecIcon = isMore ? TrendingUp : TrendingDown

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              {prop.sport}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {prop.teamAbbr} vs {prop.opponentAbbr} &middot; {prop.gameTime}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold leading-tight text-foreground text-pretty">
            {prop.player}
          </h3>
          <p className="text-sm text-muted-foreground">{prop.propType}</p>
        </div>
        <ConfidenceMeter score={prop.confidence} />
      </div>

      {/* Line + recommendation */}
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-semibold text-foreground">
            {prop.prizePicksLine}
          </span>
          <span className="text-xs text-muted-foreground">PrizePicks</span>
        </div>
        <div
          className={cn(
            'ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold',
            isMore
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground',
          )}
        >
          <RecIcon className="size-4" aria-hidden="true" />
          {prop.recommendation}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t border-border px-3.5 py-2.5 text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
              riskTone[prop.riskLevel],
            )}
          >
            {prop.riskLevel} risk
          </span>
          {open ? 'Hide analysis' : 'View analysis'}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Details */}
      {open && (
        <div className="space-y-4 border-t border-border bg-background/40 p-3.5">
          <Section icon={BarChart3} title="Sportsbook consensus">
            <div className="flex flex-wrap gap-1.5">
              {prop.consensus.map((c) => (
                <span
                  key={c.book}
                  className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-mono text-xs"
                >
                  <span className="text-muted-foreground">{c.book}</span>
                  <span className="font-semibold text-foreground">
                    {c.line}
                  </span>
                </span>
              ))}
            </div>
          </Section>

          <Section icon={Swords} title="Matchup analysis">
            <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
              {prop.matchupAnalysis}
            </p>
          </Section>

          <Section icon={Users} title="Role &amp; usage">
            <p className="text-sm leading-relaxed text-foreground/90">
              {prop.role}
            </p>
          </Section>

          {prop.recentPerformance.length > 0 && prop.recentLabel && (
            <Section icon={TrendingUp} title={prop.recentLabel}>
              <Sparkline
                values={prop.recentPerformance}
                line={prop.prizePicksLine}
                recommendation={prop.recommendation}
              />
            </Section>
          )}

          <Section icon={AlertTriangle} title="Risk factors">
            <ul className="space-y-1">
              {prop.riskFactors.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-2 text-sm text-foreground/90"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </article>
  )
}
