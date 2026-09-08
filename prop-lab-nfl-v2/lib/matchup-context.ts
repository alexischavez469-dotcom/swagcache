import 'server-only'
import type { Prop, Sport } from '@/lib/props-data'

type Json = Record<string, unknown>

type MatchupSignal = 'Favorable' | 'Neutral' | 'Tough' | 'Unavailable'

interface MatchupContext {
  signal: MatchupSignal
  metric?: string
  description: string
  source: string
}

const ESPN_PATH: Partial<Record<Sport, string>> = {
  NFL: 'football/nfl',
}

function norm(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function collectStats(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const item of node) collectStats(item, out)
    return out
  }
  if (!node || typeof node !== 'object') return out

  const obj = node as Json
  if (
    ('name' in obj || 'displayName' in obj || 'shortDisplayName' in obj) &&
    ('value' in obj || 'displayValue' in obj || 'rank' in obj)
  ) {
    out.push(obj)
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectStats(value, out)
  }
  return out
}

function findStat(stats: Json[], candidates: string[]): Json | null {
  const wanted = candidates.map(norm)
  for (const candidate of wanted) {
    const exact = stats.find((st) => {
      const names = [
        String(st.name ?? ''),
        String(st.displayName ?? ''),
        String(st.shortDisplayName ?? ''),
        String(st.abbreviation ?? ''),
      ].map(norm)
      return names.includes(candidate)
    })
    if (exact) return exact
  }

  for (const candidate of wanted) {
    const fuzzy = stats.find((st) => {
      const names = [
        String(st.name ?? ''),
        String(st.displayName ?? ''),
        String(st.shortDisplayName ?? ''),
      ].map(norm)
      return names.some((name) => name.includes(candidate) || candidate.includes(name))
    })
    if (fuzzy) return fuzzy
  }
  return null
}

function gamesPlayed(stats: Json[]): number | null {
  const stat = findStat(stats, ['gamesPlayed', 'games', 'teamGamesPlayed'])
  return stat ? toNum(stat.value ?? stat.displayValue) : null
}

function propFamily(prop: Prop): 'pass' | 'rush' | 'points' | 'general' {
  const p = `${prop.propType} ${prop.id}`.toLowerCase()
  if (
    p.includes('passing') ||
    p.includes('receiving') ||
    p.includes('reception') ||
    p.includes('completion') ||
    p.includes('pass attempt')
  ) return 'pass'
  if (p.includes('rushing') || p.includes('rush ')) return 'rush'
  if (p.includes('points') || p.includes('fantasy')) return 'points'
  return 'general'
}

function candidatesFor(prop: Prop): { names: string[]; label: string; cumulative: boolean } | null {
  const family = propFamily(prop)

  if (prop.sport === 'NFL' || prop.sport === 'NCAAF') {
    if (family === 'pass') {
      return {
        names: ['passingYardsAllowed', 'passYardsAllowed', 'opponentPassingYards'],
        label: 'pass yards allowed/game',
        cumulative: true,
      }
    }
    if (family === 'rush') {
      return {
        names: ['rushingYardsAllowed', 'rushYardsAllowed', 'opponentRushingYards'],
        label: 'rush yards allowed/game',
        cumulative: true,
      }
    }
    return {
      names: ['pointsAllowedPerGame', 'opponentPointsPerGame', 'pointsAllowed', 'totalPointsAllowed'],
      label: 'points allowed/game',
      cumulative: true,
    }
  }

  if (prop.sport === 'NBA') {
    return {
      names: ['avgPointsAgainst', 'opponentPointsPerGame', 'pointsAllowedPerGame', 'pointsAgainst'],
      label: 'opponent points/game',
      cumulative: false,
    }
  }

  if (prop.sport === 'MLB') {
    return {
      names: ['avgRunsAgainst', 'runsAllowedPerGame', 'runsAgainst', 'runsAllowed'],
      label: 'runs allowed/game',
      cumulative: true,
    }
  }

  if (prop.sport === 'Soccer') {
    return {
      names: ['avgGoalsAgainst', 'goalsAgainstPerGame', 'goalsAgainst'],
      label: 'goals allowed/game',
      cumulative: true,
    }
  }

  return null
}

function classify(sport: Sport, family: ReturnType<typeof propFamily>, value: number): Exclude<MatchupSignal, 'Unavailable'> {
  if (family === 'pass') return value >= 240 ? 'Favorable' : value <= 205 ? 'Tough' : 'Neutral'
  if (family === 'rush') return value >= 125 ? 'Favorable' : value <= 95 ? 'Tough' : 'Neutral'
  return value >= 25.5 ? 'Favorable' : value <= 19 ? 'Tough' : 'Neutral'
}


async function fetchOpponentContext(prop: Prop): Promise<MatchupContext> {
  const path = ESPN_PATH[prop.sport]
  const config = candidatesFor(prop)
  if (!path || !config) {
    return {
      signal: 'Unavailable',
      description: 'No opponent matchup feed is configured for this prop type yet.',
      source: 'None',
    }
  }

  const abbr = prop.opponentAbbr.toLowerCase()
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(abbr)}/statistics`

  try {
    const res = await fetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(4500),
      headers: { accept: 'application/json' },
    })

    if (!res.ok) {
      return {
        signal: 'Unavailable',
        description: `ESPN matchup data was unavailable for ${prop.opponentAbbr}.`,
        source: 'ESPN',
      }
    }

    const body = await res.json() as unknown
    const stats = collectStats(body)
    const found = findStat(stats, config.names)

    if (!found) {
      return {
        signal: 'Unavailable',
        description: `ESPN did not expose the defensive metric needed for this ${prop.propType} matchup.`,
        source: 'ESPN',
      }
    }

    let value = toNum(found.value ?? found.displayValue)
    if (value == null) {
      return {
        signal: 'Unavailable',
        description: 'The matchup metric was present but did not contain a usable numeric value.',
        source: 'ESPN',
      }
    }

    const foundName = norm(String(found.name ?? found.displayName ?? ''))
    const alreadyPerGame =
      foundName.includes('pergame') ||
      foundName.includes('avg') ||
      String(found.displayName ?? '').toLowerCase().includes('per game')

    if (config.cumulative && !alreadyPerGame) {
      const gp = gamesPlayed(stats)
      if (gp && gp > 0) value = value / gp
    }

    // NBA's avgPointsAgainst candidates are already per-game; cumulative pointsAgainst is not.
    if (prop.sport === 'NBA' && !alreadyPerGame && foundName.includes('pointsagainst')) {
      const gp = gamesPlayed(stats)
      if (gp && gp > 0) value = value / gp
    }

    const signal = classify(prop.sport, propFamily(prop), value)
    const rank = toNum(found.rank)
    const rankText = rank != null ? ` ESPN stat rank: #${rank}.` : ''

    const family = propFamily(prop)
    const weakness =
      signal === 'Favorable'
        ? family === 'rush'
          ? `${prop.player} gets a favorable matchup against ${prop.opponentAbbr} because that defense has been weak against the run`
          : family === 'pass'
            ? `${prop.player} gets a favorable matchup against ${prop.opponentAbbr} because that defense has been weak against the pass`
            : `${prop.player} gets a favorable scoring environment against ${prop.opponentAbbr}`
        : signal === 'Tough'
          ? family === 'rush'
            ? `${prop.player} gets a difficult matchup against ${prop.opponentAbbr} because that defense has been strong against the run`
            : family === 'pass'
              ? `${prop.player} gets a difficult matchup against ${prop.opponentAbbr} because that defense has been strong against the pass`
              : `${prop.player} gets a tougher scoring environment against ${prop.opponentAbbr}`
          : `${prop.player}'s matchup with ${prop.opponentAbbr} is close to neutral for this prop type`

    const impact =
      prop.recommendation === 'More'
        ? signal === 'Favorable'
          ? `That supports the More on ${prop.propType}.`
          : signal === 'Tough'
            ? `That works against the More on ${prop.propType}.`
            : `It does not add much support either way for the More.`
        : signal === 'Tough'
          ? `That supports the Less on ${prop.propType}.`
          : signal === 'Favorable'
            ? `That works against the Less on ${prop.propType}.`
            : `It does not add much support either way for the Less.`

    return {
      signal,
      metric: `${value.toFixed(1)} ${config.label}`,
      description: `${weakness}. ESPN shows ${value.toFixed(1)} ${config.label}.${rankText} ${impact}`,
      source: 'ESPN',
    }
  } catch {
    return {
      signal: 'Unavailable',
      description: `ESPN matchup lookup timed out or failed for ${prop.opponentAbbr}.`,
      source: 'ESPN',
    }
  }
}

function adjustedRisk(confidence: number): Prop['riskLevel'] {
  // Still conservative because role, injuries and recent-form are not connected.
  if (confidence >= 7) return 'Medium'
  if (confidence >= 4) return 'Medium'
  return 'High'
}

function enrichOne(prop: Prop, context: MatchupContext): Prop {
  if (context.signal === 'Unavailable') {
    return {
      ...prop,
      matchupSignal: context.signal,
      matchupMetric: context.metric,
      matchupSource: context.source,
      matchupAnalysis: `${prop.matchupAnalysis} ${context.description}`,
    }
  }

  const alignment =
    (context.signal === 'Favorable' && prop.recommendation === 'More') ||
    (context.signal === 'Tough' && prop.recommendation === 'Less')

  const conflict =
    (context.signal === 'Favorable' && prop.recommendation === 'Less') ||
    (context.signal === 'Tough' && prop.recommendation === 'More')

  // Matchup context can move a market-only score by one point.
  // It can unlock 7/10, but 8-10 remain reserved for role/recent/injury confirmation.
  const confidence = Math.max(1, Math.min(7, prop.confidence + (alignment ? 1 : conflict ? -1 : 0)))

  const riskFactors = prop.riskFactors.filter(
    (r) => !r.toLowerCase().includes('matchup, role, recent form and injury context are not scored yet'),
  )

  if (conflict) riskFactors.push('Opponent matchup conflicts with the market lean')
  if (context.signal === 'Neutral') riskFactors.push('Opponent matchup is neutral and adds little confirmation')
  riskFactors.push('Role/usage summary is contextual only; live usage rates and injury status are still not scored')

  return {
    ...prop,
    confidence,
    riskLevel: adjustedRisk(confidence),
    matchupSignal: context.signal,
    matchupMetric: context.metric,
    matchupSource: context.source,
    matchupAnalysis: `${prop.matchupAnalysis.replace(
      'Opponent-defense and matchup splits are not connected yet, so they do not affect this score.',
      '',
    ).trim()} ${context.description}`,
    role: prop.role,
    riskFactors,
    analysisStage: 'Context enriched',
  }
}

export async function enrichPropsWithMatchups(props: Prop[]): Promise<Prop[]> {
  // Deduplicate opponent+sport+prop-family lookups so a page of props does not hammer ESPN.
  const cache = new Map<string, Promise<MatchupContext>>()

  const enriched = await Promise.all(
    props.map(async (prop) => {
      const key = `${prop.sport}|${prop.opponentAbbr}|${propFamily(prop)}`
      let pending = cache.get(key)
      if (!pending) {
        pending = fetchOpponentContext(prop)
        cache.set(key, pending)
      }
      const context = await pending
      return enrichOne(prop, context)
    }),
  )

  return enriched.sort((a, b) => b.confidence - a.confidence)
}
