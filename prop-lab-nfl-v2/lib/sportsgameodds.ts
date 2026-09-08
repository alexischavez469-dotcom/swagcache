import 'server-only'
import type { BookLine, Prop, RiskLevel, Sport } from '@/lib/props-data'
import { enrichPropsWithMatchups } from '@/lib/matchup-context'
import { enrichPropsWithNFLMeta } from '@/lib/nflmeta'
import { getRecentESPNStats } from '@/lib/espn-recent'

const API_BASE = 'https://api.sportsgameodds.com/v2'

const SPORT_TO_LEAGUES: Record<Sport, string[]> = {
  NFL: ['NFL'],
}

const LEAGUE_TO_SPORT: Record<string, Sport> = {
  NFL: 'NFL',
}

const PRIMARY_BOOK = 'fanduel'

const BOOKMAKER_FILTER = PRIMARY_BOOK

const BOOK_ABBR: Record<string, string> = {
  draftkings: 'DK',
  fanduel: 'FD',
  betmgm: 'MGM',
  caesars: 'CZR',
  espnbet: 'ESPN',
  pinnacle: 'PIN',
}

const STAT_LABEL: Record<string, string> = {
  points: 'Points',
  rebounds: 'Rebounds',
  assists: 'Assists',
  points_rebounds_assists: 'Pts + Reb + Ast',
  points_rebounds: 'Pts + Reb',
  points_assists: 'Pts + Ast',
  rebounds_assists: 'Reb + Ast',
  threePointersMade: '3-Pointers Made',
  three_pointers_made: '3-Pointers Made',
  steals: 'Steals',
  blocks: 'Blocks',
  turnovers: 'Turnovers',
  passing_yards: 'Passing Yards',
  passing_touchdowns: 'Passing TDs',
  passing_completions: 'Completions',
  passing_attempts: 'Pass Attempts',
  rushing_yards: 'Rushing Yards',
  receiving_yards: 'Receiving Yards',
  receptions: 'Receptions',
  receiving_receptions: 'Receptions',
  rushing_attempts: 'Rush Attempts',
  longest_reception: 'Longest Reception',
  receiving_longest_reception: 'Longest Reception',
  longest_rush: 'Longest Rush',
  passing_interceptions: 'Interceptions Thrown',
  rushing_receiving_yards: 'Rush + Rec Yards',
  fantasy_score: 'Fantasy Score',
  hits: 'Hits',
  total_bases: 'Total Bases',
  runs_batted_in: 'RBIs',
  strikeouts: 'Strikeouts',
  shots_on_goal: 'Shots on Goal',
  goals: 'Goals',
  saves: 'Saves',
  shots_on_target: 'Shots on Target',
  passes_attempted: 'Passes Attempted',
  tackles: 'Tackles',
  clearances: 'Clearances',
  fouls_committed: 'Fouls Committed',
  fouls_drawn: 'Fouls Drawn',
  games: 'Games',
  serving_aces: 'Aces',
  aces: 'Aces',
  breakPoints: 'Break Points',
  break_points: 'Break Points',
  fantasyScore: 'Fantasy Score',
}

type Json = Record<string, unknown>

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace('+', ''))
  return Number.isFinite(n) ? n : null
}


function impliedProbFromAmerican(american: number | null): number | null {
  if (american == null) return null
  return american < 0 ? -american / (-american + 100) : 100 / (american + 100)
}

function titleize(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

function statLabel(statID: string, marketName?: string): string {
  if (STAT_LABEL[statID]) return STAT_LABEL[statID]
  const normalized = statID.replace(/[^A-Za-z0-9_]/g, '')
  if (STAT_LABEL[normalized]) return STAT_LABEL[normalized]
  // Unknown SportsGameOdds market names often include the player's name.
  // Prefer the stat identifier so cards do not read like "Player Player Receptions".
  const fromID = titleize(statID)
  if (fromID && fromID.length <= 36) return fromID
  if (marketName) {
    return marketName
      .replace(/Over\/Under/gi, '')
      .replace(/More\/Less/gi, '')
      .trim()
  }
  return 'Player Prop'
}


function teamAbbr(team: Json | undefined, fallback: string): string {
  const names = (team?.names as Json) ?? {}
  const short = (names.short as string) || (names.abbr as string)
  if (short) return short.toUpperCase().slice(0, 4)
  return fallback.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
}

function teamName(team: Json | undefined, fallback: string): string {
  const names = (team?.names as Json) ?? {}
  return (names.long as string) || (names.medium as string) || (team?.name as string) || fallback
}

function playerName(player: Json): string {
  const eventName = String(player.name ?? '').trim()
  if (eventName) return eventName
  const names = (player.names as Json) ?? {}
  const display = String(names.display ?? '').trim()
  if (display) return display
  return [names.firstName, names.lastName].filter(Boolean).join(' ').trim()
}

function formatGameTime(startsAt: unknown): string {
  if (typeof startsAt !== 'string') return 'TBD'
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return 'TBD'
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
}

function riskFromConfidence(c: number): RiskLevel {
  // Until role, matchup, injury and recent-form feeds are actually connected,
  // a market-only lean should never be labeled "Low risk".
  if (c >= 4) return 'Medium'
  return 'High'
}

interface OddGroup {
  over?: Json
  under?: Json
  statID: string
  statEntityID: string
  periodID: string
}

function getBookEntry(odd: Json | undefined, bookmaker: string): Json | null {
  if (!odd) return null
  const byBook = (odd.byBookmaker as Json) ?? {}
  const entry = byBook[bookmaker] as Json | undefined
  if (!entry || entry.available === false) return null
  return entry
}


function eventToProps(event: Json): Prop[] {
  const leagueID = String(event.leagueID ?? '')
  const sport = LEAGUE_TO_SPORT[leagueID]
  if (!sport) return []

  const teams = (event.teams as Json) ?? {}
  const home = teams.home as Json | undefined
  const away = teams.away as Json | undefined
  const homeID = String(home?.teamID ?? 'home')
  const awayID = String(away?.teamID ?? 'away')
  const players = (event.players as Json) ?? {}
  const odds = (event.odds as Json) ?? {}
  const gameTime = formatGameTime((event.status as Json)?.startsAt)

  const groups = new Map<string, OddGroup>()
  for (const raw of Object.values(odds)) {
    const odd = raw as Json
    if (String(odd.betTypeID) !== 'ou') continue
    const statEntityID = String(odd.statEntityID ?? odd.playerID ?? '')
    if (!statEntityID) continue
    const isTennisEntity = sport === 'Tennis' && ['home', 'away'].includes(statEntityID)
    if (!players[statEntityID] && !isTennisEntity) continue
    const statID = String(odd.statID ?? '')
    const periodID = String(odd.periodID ?? 'game')
    if (!statID || periodID !== 'game') continue
    const key = `${statID}|${statEntityID}|${periodID}`
    const group = groups.get(key) ?? { statID, statEntityID, periodID }
    if (String(odd.sideID) === 'over') group.over = odd
    if (String(odd.sideID) === 'under') group.under = odd
    groups.set(key, group)
  }

  const props: Prop[] = []

  for (const group of groups.values()) {
    const base = group.over ?? group.under
    if (!base) continue

    // Require a currently available FanDuel entry. Never substitute a fair line
    // or another sportsbook's threshold for the FanDuel line shown in the app.
    const fdOver = getBookEntry(group.over, PRIMARY_BOOK)
    const fdUnder = getBookEntry(group.under, PRIMARY_BOOK)
    const fd = fdOver ?? fdUnder
    const fanDuelLine = num(fd?.overUnder)
    if (fanDuelLine == null) continue

    const isTennisHome = sport === 'Tennis' && group.statEntityID === 'home'
    const isTennisAway = sport === 'Tennis' && group.statEntityID === 'away'
    const player = (players[group.statEntityID] as Json | undefined) ?? {}
    const playerTeamID = String(player.teamID ?? '')
    const isHome = isTennisHome || playerTeamID === homeID
    const isAway = isTennisAway || playerTeamID === awayID
    const teamObj = isHome ? home : isAway ? away : undefined
    const oppObj = isHome ? away : isAway ? home : undefined
    const teamFallback = isHome ? homeID : isAway ? awayID : playerTeamID || 'TEAM'
    const oppFallback = isHome ? awayID : isAway ? homeID : 'OPP'

    const name = sport === 'Tennis'
      ? teamName(teamObj, teamFallback)
      : playerName(player)
    if (!name) continue

    const consensus: BookLine[] = []
    const fairLine = num(base.fairOverUnder)

    // SportsGameOdds' fair line is the comparison for now. Keeping the request
    // FanDuel-only prevents a restricted bookmaker from failing the whole call.
    if (fairLine != null) {
      consensus.push({ book: 'FAIR', line: fairLine })
    }

    const marketLine = fairLine ?? fanDuelLine
    const delta = marketLine - fanDuelLine
    let recommendation: Prop['recommendation'] = delta >= 0 ? 'More' : 'Less'

    // When FanDuel and the fair line are the same, use the de-vigged fair
    // price to decide the side instead of arbitrarily calling it More.
    let probabilityEdge = 0
    if (Math.abs(delta) < 0.001) {
      const overProbRaw = impliedProbFromAmerican(num(group.over?.fairOdds))
      const underProbRaw = impliedProbFromAmerican(num(group.under?.fairOdds))
      if (overProbRaw != null && underProbRaw != null && overProbRaw + underProbRaw > 0) {
        const overProb = overProbRaw / (overProbRaw + underProbRaw)
        recommendation = overProb >= 0.5 ? 'More' : 'Less'
        probabilityEdge = Math.abs(overProb - 0.5)
      }
    }

    // Confidence reflects the FanDuel-vs-market gap, with fair-price probability as
    // a tiebreaker when both sides use the same threshold. Keep it conservative
    // until matchup, role, injury, and recent-form data are added.
    const scale = Math.max(1, Math.abs(fanDuelLine))
    const relativeGap = Math.abs(delta) / scale
    // Market-only confidence is intentionally capped at 6/10.
    // Scores 7-10 are reserved for props that also have matchup, role,
    // recent-form and availability context.
    const confidence = Math.max(1, Math.min(6, Math.round(2 + relativeGap * 18 + probabilityEdge * 8)))

    const propType = statLabel(group.statID, base.marketName as string | undefined)
    const nBooks = consensus.length
    const sideWord = recommendation === 'More' ? 'above' : 'below'
    const marketSource = fairLine != null ? 'market fair line' : 'FanDuel line'

    const matchupAnalysis = `${marketSource.charAt(0).toUpperCase() + marketSource.slice(1)} is ${marketLine}, ${Math.abs(delta).toFixed(1)} ${sideWord} the FanDuel line of ${fanDuelLine}. Opponent-defense matchup will be added after the live market feed is parsed.`

    const role = `${propType} projection for ${gameTime}. Live FanDuel line confirmed${nBooks ? ' and compared with the SportsGameOdds fair market line' : ''}. Player role, usage, injuries and recent-form data are not connected yet, so confidence is capped at 6/10.`

    const riskFactors: string[] = []
    if (Math.abs(delta) < 0.5) riskFactors.push('Very small gap between FanDuel and the market')
    if (nBooks < 2) riskFactors.push('Fair market comparison unavailable')
    if (fairLine == null) riskFactors.push('Fair market line unavailable; rating falls back to FanDuel pricing only')
    if (confidence <= 4) riskFactors.push('Market edge is thin')
    riskFactors.push('Market-only model: waiting for opponent matchup enrichment; role, recent form and injuries are not scored yet')

    props.push({
      id: `${event.eventID}-${group.statEntityID}-${group.statID}-${group.periodID}`,
      sport,
      player: name,
      team: teamName(teamObj, teamFallback),
      teamAbbr: teamAbbr(teamObj, teamFallback),
      opponent: teamName(oppObj, oppFallback),
      opponentAbbr: teamAbbr(oppObj, oppFallback),
      gameTime,
      propType,
      fanDuelLine,
      recommendation,
      confidence,
      consensus,
      matchupAnalysis,
      role,
      recentPerformance: [],
      recentLabel: '',
      riskLevel: riskFromConfidence(confidence),
      riskFactors,
    })
  }

  return props
}

async function fetchLeagueID(sport: Sport, leagueID: string, key: string): Promise<Prop[]> {
  const params = new URLSearchParams({
    leagueID,
    oddsAvailable: 'true',
    type: 'match',
    finalized: 'false',
    bookmakerID: BOOKMAKER_FILTER,
    limit: '10',
  })

  const res = await fetch(`${API_BASE}/events?${params.toString()}`, {
    headers: { 'x-api-key': key },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as Json
      detail = String(body.error ?? '')
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(`SportsGameOdds ${leagueID} request failed (${res.status})${detail ? `: ${detail}` : ''}`)
  }

  const json = (await res.json()) as Json
  if (json.success === false) {
    throw new Error(`SportsGameOdds ${leagueID} request failed: ${String(json.error ?? 'unknown API error')}`)
  }

  const data = Array.isArray(json.data) ? (json.data as Json[]) : []
  return data.flatMap(eventToProps).sort((a, b) => b.confidence - a.confidence).slice(0, 30)
}

async function fetchSport(sport: Sport, key: string): Promise<Prop[]> {
  const leagues = SPORT_TO_LEAGUES[sport]
  const settled = await Promise.allSettled(leagues.map((leagueID) => fetchLeagueID(sport, leagueID, key)))
  const props = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (props.length > 0) return props

  const firstError = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (firstError) throw firstError.reason
  return []
}

export interface PropsResult {
  props: Prop[]
  live: boolean
  error?: string
}

export async function getLiveProps(): Promise<PropsResult> {
  const key = process.env.SPORTSGAMEODDS_API_KEY?.trim()
  if (!key) {
    return {
      props: [],
      live: false,
      error: 'SPORTSGAMEODDS_API_KEY is not available to this deployment.',
    }
  }

  const sports: Sport[] = ['NFL']
  const settled = await Promise.allSettled(sports.map((sport) => fetchSport(sport, key)))

  const props = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  props.sort((a, b) => b.confidence - a.confidence)

  if (props.length > 0) {
    const matchupEnriched = await enrichPropsWithMatchups(props.slice(0, 60))
    const usageEnriched = await enrichPropsWithNFLMeta(matchupEnriched)

    const top = usageEnriched.slice(0, 20)
    const rest = usageEnriched.slice(20)
    const recentEnriched = await Promise.all(top.map(async (prop) => {
      const recentStats = await getRecentESPNStats(prop).catch(() => [])
      return recentStats.length
        ? { ...prop, recentStats, recentSource: 'ESPN' }
        : prop
    }))

    return { props: [...recentEnriched, ...rest], live: true }
  }

  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)))

  return {
    props: [],
    live: false,
    error: errors.length
      ? errors.slice(0, 2).join(' | ')
      : 'The API responded successfully, but no currently available FanDuel props were found for the configured leagues.',
  }
}
