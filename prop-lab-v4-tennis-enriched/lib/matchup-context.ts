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
  NCAAF: 'football/college-football',
  NBA: 'basketball/nba',
  MLB: 'baseball/mlb',
  Soccer: 'soccer/eng.1',
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
  if (sport === 'NFL') {
    if (family === 'pass') return value >= 240 ? 'Favorable' : value <= 205 ? 'Tough' : 'Neutral'
    if (family === 'rush') return value >= 125 ? 'Favorable' : value <= 95 ? 'Tough' : 'Neutral'
    return value >= 25.5 ? 'Favorable' : value <= 19 ? 'Tough' : 'Neutral'
  }
  if (sport === 'NCAAF') {
    if (family === 'pass') return value >= 250 ? 'Favorable' : value <= 190 ? 'Tough' : 'Neutral'
    if (family === 'rush') return value >= 150 ? 'Favorable' : value <= 100 ? 'Tough' : 'Neutral'
    return value >= 29 ? 'Favorable' : value <= 20.5 ? 'Tough' : 'Neutral'
  }
  if (sport === 'NBA') return value >= 116 ? 'Favorable' : value <= 109 ? 'Tough' : 'Neutral'
  if (sport === 'MLB') return value >= 4.8 ? 'Favorable' : value <= 3.9 ? 'Tough' : 'Neutral'
  if (sport === 'Soccer') return value >= 1.6 ? 'Favorable' : value <= 1.0 ? 'Tough' : 'Neutral'
  return 'Neutral'
}


type TennisPlayerSnapshot = {
  name: string
  rank: number | null
  wins: number
  losses: number
}

type TennisMatch = {
  players: { name: string; winner: boolean | null }[]
  surface?: string
}

const tennisCache = new Map<string, Promise<unknown>>()

function cacheFetchJson(url: string, revalidate = 900): Promise<unknown> {
  const cached = tennisCache.get(url)
  if (cached) return cached

  const pending = (async () => {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as unknown
  })()

  tennisCache.set(url, pending)
  return pending
}

function normalizePerson(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function objectName(obj: Json): string {
  return String(
    obj.displayName ??
    obj.fullName ??
    obj.name ??
    obj.shortName ??
    obj.athleteDisplayName ??
    ''
  ).trim()
}

function deepObjects(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const item of node) deepObjects(item, out)
    return out
  }
  if (!node || typeof node !== 'object') return out

  const obj = node as Json
  out.push(obj)
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepObjects(value, out)
  }
  return out
}

function extractRankings(body: unknown): Map<string, number> {
  const result = new Map<string, number>()
  for (const obj of deepObjects(body)) {
    const athlete =
      (obj.athlete && typeof obj.athlete === 'object' ? obj.athlete as Json : null) ??
      (obj.player && typeof obj.player === 'object' ? obj.player as Json : null)

    const name = athlete ? objectName(athlete) : objectName(obj)
    if (!name) continue

    const rank =
      toNum(obj.currentRank) ??
      toNum(obj.rank) ??
      toNum(obj.ranking) ??
      toNum((obj.current && typeof obj.current === 'object' ? (obj.current as Json).rank : null))

    if (rank != null && rank > 0 && rank < 5000) {
      const key = normalizePerson(name)
      if (key && (!result.has(key) || rank < (result.get(key) ?? Infinity))) result.set(key, rank)
    }
  }
  return result
}

function competitorName(obj: Json): string {
  if (obj.athlete && typeof obj.athlete === 'object') {
    const n = objectName(obj.athlete as Json)
    if (n) return n
  }
  if (obj.team && typeof obj.team === 'object') {
    const n = objectName(obj.team as Json)
    if (n) return n
  }
  return objectName(obj)
}

function extractSurface(obj: Json): string | undefined {
  const keys = ['surface', 'courtType', 'court', 'playingSurface']
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object') {
      const v = objectName(value as Json)
      if (v) return v
    }
  }
  return undefined
}

function extractTennisMatches(body: unknown): TennisMatch[] {
  const matches: TennisMatch[] = []
  const seen = new Set<string>()

  for (const obj of deepObjects(body)) {
    const competitors = Array.isArray(obj.competitors) ? obj.competitors as unknown[] : null
    if (!competitors || competitors.length < 2 || competitors.length > 4) continue

    const players = competitors
      .filter((c): c is Json => !!c && typeof c === 'object')
      .map((c) => ({
        name: competitorName(c),
        winner: typeof c.winner === 'boolean' ? c.winner : null,
      }))
      .filter((p) => p.name)

    if (players.length < 2) continue

    const signature = players.map((p) => normalizePerson(p.name)).sort().join('|')
    if (!signature || seen.has(signature)) continue
    seen.add(signature)

    matches.push({
      players,
      surface: extractSurface(obj),
    })
  }

  return matches
}

function tennisRecord(matches: TennisMatch[], playerName: string): { wins: number; losses: number } {
  const target = normalizePerson(playerName)
  let wins = 0
  let losses = 0

  for (const match of matches) {
    const player = match.players.find((p) => normalizePerson(p.name) === target)
    if (!player || player.winner == null) continue
    if (player.winner) wins += 1
    else losses += 1
  }
  return { wins, losses }
}

function tennisH2H(matches: TennisMatch[], playerName: string, opponentName: string): { wins: number; losses: number } {
  const playerKey = normalizePerson(playerName)
  const oppKey = normalizePerson(opponentName)
  let wins = 0
  let losses = 0

  for (const match of matches) {
    const player = match.players.find((p) => normalizePerson(p.name) === playerKey)
    const opp = match.players.find((p) => normalizePerson(p.name) === oppKey)
    if (!player || !opp || player.winner == null) continue
    if (player.winner) wins += 1
    else losses += 1
  }

  return { wins, losses }
}

function compactDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function fetchTennisContext(prop: Prop): Promise<MatchupContext> {
  const now = new Date()
  const start = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  const range = `${compactDate(start)}-${compactDate(now)}`

  const tourCandidates: Array<'atp' | 'wta'> = ['atp', 'wta']
  let matchedTour: 'atp' | 'wta' | null = null
  let playerRank: number | null = null
  let opponentRank: number | null = null
  let matches: TennisMatch[] = []

  for (const tour of tourCandidates) {
    try {
      const [rankingsBody, scoreboardBody] = await Promise.all([
        cacheFetchJson(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`, 1800),
        cacheFetchJson(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${range}`, 900),
      ])

      const rankings = extractRankings(rankingsBody)
      const currentMatches = extractTennisMatches(scoreboardBody)
      const pKey = normalizePerson(prop.player)
      const oKey = normalizePerson(prop.opponent)

      const pRank = rankings.get(pKey) ?? null
      const oRank = rankings.get(oKey) ?? null
      const appearsInMatches = currentMatches.some((m) =>
        m.players.some((p) => normalizePerson(p.name) === pKey || normalizePerson(p.name) === oKey)
      )

      if (pRank != null || oRank != null || appearsInMatches) {
        matchedTour = tour
        playerRank = pRank
        opponentRank = oRank
        matches = currentMatches
        break
      }
    } catch {
      // Try the other tour before giving up.
    }
  }

  if (!matchedTour) {
    return {
      signal: 'Unavailable',
      description: 'ESPN tennis rankings/recent-results data could not be matched to this player.',
      source: 'ESPN',
    }
  }

  const playerRecord = tennisRecord(matches, prop.player)
  const oppRecord = tennisRecord(matches, prop.opponent)
  const h2h = tennisH2H(matches, prop.player, prop.opponent)

  const playerMatches = playerRecord.wins + playerRecord.losses
  const oppMatches = oppRecord.wins + oppRecord.losses
  const playerWinRate = playerMatches ? playerRecord.wins / playerMatches : null
  const oppWinRate = oppMatches ? oppRecord.wins / oppMatches : null

  let score = 0
  const notes: string[] = []

  if (playerRank != null && opponentRank != null) {
    const gap = opponentRank - playerRank
    if (gap >= 25) score += 1
    else if (gap <= -25) score -= 1
    notes.push(`Rank #${playerRank} vs #${opponentRank}`)
  } else if (playerRank != null) {
    notes.push(`Player rank #${playerRank}`)
  } else if (opponentRank != null) {
    notes.push(`Opponent rank #${opponentRank}`)
  }

  if (playerWinRate != null && oppWinRate != null && playerMatches >= 3 && oppMatches >= 3) {
    const formGap = playerWinRate - oppWinRate
    if (formGap >= 0.15) score += 1
    else if (formGap <= -0.15) score -= 1
    notes.push(
      `45-day form ${playerRecord.wins}-${playerRecord.losses} vs ${oppRecord.wins}-${oppRecord.losses}`
    )
  } else {
    if (playerMatches) notes.push(`45-day form ${playerRecord.wins}-${playerRecord.losses}`)
    if (oppMatches) notes.push(`Opponent 45-day form ${oppRecord.wins}-${oppRecord.losses}`)
  }

  const h2hMatches = h2h.wins + h2h.losses
  if (h2hMatches >= 2) {
    if (h2h.wins - h2h.losses >= 2) score += 1
    else if (h2h.losses - h2h.wins >= 2) score -= 1
    notes.push(`Recent H2H ${h2h.wins}-${h2h.losses}`)
  }

  const surfaces = matches
    .filter((m) => m.players.some((p) => normalizePerson(p.name) === normalizePerson(prop.player)))
    .map((m) => m.surface)
    .filter((v): v is string => !!v)
  if (surfaces.length) notes.push(`Recent surface data: ${surfaces[0]}`)

  const signal: MatchupSignal = score >= 2 ? 'Favorable' : score <= -2 ? 'Tough' : 'Neutral'
  const metric = notes.length ? notes.join(' · ') : `${matchedTour.toUpperCase()} recent-results context`

  return {
    signal,
    metric,
    description:
      `${matchedTour.toUpperCase()} tennis context: ${metric}. ` +
      `Matchup signal: ${signal.toLowerCase()}. Rankings, recent form and recent H2H are used when ESPN exposes them. ` +
      `Serve/return splits are not yet included.`,
    source: 'ESPN',
  }
}

async function fetchOpponentContext(prop: Prop): Promise<MatchupContext> {
  if (prop.sport === 'Tennis') {
    return fetchTennisContext(prop)
  }

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

    return {
      signal,
      metric: `${value.toFixed(1)} ${config.label}`,
      description: `${prop.opponentAbbr} is at ${value.toFixed(1)} ${config.label}. Matchup signal: ${signal.toLowerCase()}.${rankText}`,
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
  riskFactors.push('Player role and injury context are still not scored')

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
    role: prop.sport === 'Tennis'
      ? prop.role.replace(
          'Player role, usage, injuries and recent-form data are not connected yet, so confidence is capped at 6/10.',
          'Tennis ranking, recent-form and H2H context are now included when available. Serve/return splits and injuries are not connected yet, so 8-10 ratings remain locked.',
        )
      : prop.role.replace(
          'Player role, usage, injuries and recent-form data are not connected yet, so confidence is capped at 6/10.',
          'Opponent matchup is now included. Player role, usage, injuries and recent-form data are not connected yet, so 8-10 ratings remain locked.',
        ),
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
