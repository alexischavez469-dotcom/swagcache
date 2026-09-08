import 'server-only'
import type { NflGame, Prop } from '@/lib/props-data'

type Json = Record<string, unknown>
const BASE = 'https://nflmeta.org/api/v1'

function key(): string | null {
  return process.env.NFLMETA_API_KEY ?? process.env.NFLMETA_KEY ?? null
}

async function nflFetch(path: string, revalidate = 300): Promise<Json> {
  const apiKey = key()
  if (!apiKey) throw new Error('NFLMETA_API_KEY is not configured')

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-NFLMeta-Key': apiKey, accept: 'application/json' },
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as Json
      detail = String(body.error ?? body.message ?? '')
    } catch {}
    throw new Error(`NFLMeta request failed (${res.status})${detail ? `: ${detail}` : ''}`)
  }

  return await res.json() as Json
}

function arr(v: unknown): Json[] {
  if (Array.isArray(v)) return v.filter((x): x is Json => !!x && typeof x === 'object')
  return []
}

function dataRows(body: Json): Json[] {
  const d = body.data
  if (Array.isArray(d)) return arr(d)
  if (d && typeof d === 'object') {
    const obj = d as Json
    for (const candidate of ['players', 'rows', 'games', 'items', 'results', 'data']) {
      const rows = arr(obj[candidate])
      if (rows.length) return rows
    }
    return [obj]
  }
  return []
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(String(v).replace(/[%,$]/g, ''))
  return Number.isFinite(n) ? n : null
}

function val(row: Json, keys: string[]): number | null {
  for (const k of keys) {
    if (k in row) {
      const n = num(row[k])
      if (n != null) return n
    }
  }
  return null
}

function str(row: Json, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

async function findPlayer(playerName: string, teamAbbr: string): Promise<{ playerKey: string; position?: string } | null> {
  const body = await nflFetch(`/players?search=${encodeURIComponent(playerName)}&limit=8`, 3600)
  const rows = dataRows(body)
  const target = norm(playerName)

  const scored = rows
    .map((row) => {
      const name = str(row, ['display_name', 'displayName', 'full_name', 'fullName', 'name', 'football_name']) ?? ''
      const team = str(row, ['latest_team_abbr', 'team_abbr', 'team', 'teamAbbr']) ?? ''
      const score =
        (norm(name) === target ? 3 : norm(name).includes(target) || target.includes(norm(name)) ? 2 : 0) +
        (norm(team) === norm(teamAbbr) ? 2 : 0)
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)

  const row = scored[0]?.row
  if (!row || scored[0].score === 0) return null

  const playerKey = str(row, ['player_key', 'playerKey'])
  if (!playerKey) return null
  return {
    playerKey,
    position: str(row, ['position', 'position_group', 'positionGroup']) ?? undefined,
  }
}

function seasonYear(): number {
  return new Date().getUTCFullYear()
}

function usageSummary(prop: Prop, row: Json, position?: string): { summary: string; metric: string; scoreDelta: number } {
  const p = prop.propType.toLowerCase()

  const snaps = val(row, ['offensive_snaps', 'offense_snaps', 'snaps_offense', 'off_snaps', 'snap_count', 'snaps'])
  const snapPct = val(row, ['offensive_snap_pct', 'offense_snap_pct', 'snap_pct', 'snap_percentage', 'snap_share'])
  const targets = val(row, ['targets', 'receiving_targets'])
  const receptions = val(row, ['receptions'])
  const recYds = val(row, ['receiving_yards', 'rec_yards'])
  const carries = val(row, ['rushing_attempts', 'rush_attempts', 'carries'])
  const rushYds = val(row, ['rushing_yards', 'rush_yards'])
  const passAtt = val(row, ['passing_attempts', 'pass_attempts'])
  const passYds = val(row, ['passing_yards', 'pass_yards'])
  const games = val(row, ['games', 'games_played'])

  const bits: string[] = []
  if (position) bits.push(position)
  if (snapPct != null) bits.push(`${snapPct.toFixed(snapPct > 1 ? 0 : 2)}${snapPct > 1 ? '%' : ''} snap share`)
  else if (snaps != null) bits.push(`${snaps} offensive snaps`)

  let scoreDelta = 0
  let impact = ''

  if (p.includes('receiv') || p.includes('reception')) {
    if (targets != null) bits.push(`${targets} targets${games ? ` (${(targets/games).toFixed(1)}/game)` : ''}`)
    if (receptions != null) bits.push(`${receptions} catches`)
    if (recYds != null) bits.push(`${recYds} rec yds`)
    const tpg = games && targets != null ? targets / games : null
    if (tpg != null && tpg >= 7) scoreDelta = 1
    if (tpg != null && tpg <= 3) scoreDelta = -1
    impact = tpg != null
      ? `His ${tpg.toFixed(1)} targets per game ${tpg >= 7 ? 'give this prop strong volume support' : tpg <= 3 ? 'make this a lower-volume role' : 'suggest a moderate receiving workload'}.`
      : 'Receiving opportunity is evaluated from his season targets and snap involvement when available.'
  } else if (p.includes('rush')) {
    if (carries != null) bits.push(`${carries} carries${games ? ` (${(carries/games).toFixed(1)}/game)` : ''}`)
    if (rushYds != null) bits.push(`${rushYds} rush yds`)
    const cpg = games && carries != null ? carries / games : null
    if (cpg != null && cpg >= 14) scoreDelta = 1
    if (cpg != null && cpg <= 6) scoreDelta = -1
    impact = cpg != null
      ? `His ${cpg.toFixed(1)} carries per game ${cpg >= 14 ? 'support a featured rushing role' : cpg <= 6 ? 'point to committee or limited rushing volume' : 'show a moderate rushing workload'}.`
      : 'Rushing opportunity is evaluated from season carries and snap involvement when available.'
  } else if (p.includes('pass') || p.includes('completion')) {
    if (passAtt != null) bits.push(`${passAtt} pass attempts${games ? ` (${(passAtt/games).toFixed(1)}/game)` : ''}`)
    if (passYds != null) bits.push(`${passYds} pass yds`)
    const apg = games && passAtt != null ? passAtt / games : null
    if (apg != null && apg >= 32) scoreDelta = 1
    if (apg != null && apg <= 25) scoreDelta = -1
    impact = apg != null
      ? `${apg.toFixed(1)} attempts per game ${apg >= 32 ? 'provide healthy passing volume' : apg <= 25 ? 'signal a lower-volume passing environment' : 'put him near a normal passing workload'}.`
      : 'Passing opportunity is evaluated from season attempts and snap involvement when available.'
  } else {
    impact = 'NFLMeta season usage is included when relevant fields are available.'
  }

  return {
    summary: `${prop.player} is operating as a ${position ?? 'skill-position player'} for ${prop.teamAbbr}. ${bits.length ? bits.join(' · ') : 'Current NFLMeta usage fields were limited'}. ${impact} For this specific ${prop.propType} prop, that role ${scoreDelta > 0 ? 'creates above-average opportunity' : scoreDelta < 0 ? 'creates limited opportunity' : 'provides a roughly neutral volume profile'}.`,
    metric: bits.join(' · ') || 'NFLMeta usage available, but no prop-specific usage field matched',
    scoreDelta,
  }
}

async function usageForProp(prop: Prop): Promise<{ summary: string; metric: string; scoreDelta: number } | null> {
  const found = await findPlayer(prop.player, prop.teamAbbr)
  if (!found) return null

  const body = await nflFetch(`/players/${encodeURIComponent(found.playerKey)}/career/seasons?season=${seasonYear()}&season_type=REG`, 1800)
  const rows = dataRows(body)
  const row = rows[0]
  if (!row) return null

  return usageSummary(prop, row, found.position)
}

export async function enrichPropsWithNFLMeta(props: Prop[]): Promise<Prop[]> {
  if (!key()) return props

  const cache = new Map<string, Promise<{ summary: string; metric: string; scoreDelta: number } | null>>()

  // Enrich only the top 30 props to protect free-tier quota.
  const top = props.slice(0, 30)
  const rest = props.slice(30)

  const enriched = await Promise.all(top.map(async (prop) => {
    const cacheKey = `${prop.player}|${prop.propType}`
    let pending = cache.get(cacheKey)
    if (!pending) {
      pending = usageForProp(prop).catch(() => null)
      cache.set(cacheKey, pending)
    }

    const usage = await pending
    if (!usage) {
      return {
        ...prop,
        role: `${prop.player}'s live NFLMeta usage fields were unavailable for this prop. The matchup and market data are still shown, but this pick should not get extra confidence from role/usage.`,
        usageSource: 'NFLMeta',
      }
    }

    const aligned =
      (usage.scoreDelta > 0 && prop.recommendation === 'More') ||
      (usage.scoreDelta < 0 && prop.recommendation === 'Less')
    const conflicting =
      (usage.scoreDelta > 0 && prop.recommendation === 'Less') ||
      (usage.scoreDelta < 0 && prop.recommendation === 'More')

    const confidence = Math.max(1, Math.min(8, prop.confidence + (aligned ? 1 : conflicting ? -1 : 0)))

    const riskFactors = prop.riskFactors.filter((x) => {
      const t = x.toLowerCase()
      return !t.includes('role/usage summary') &&
        !t.includes('role, usage') &&
        !t.includes('recent form and injuries') &&
        !t.includes('injury status are still not scored')
    })
    if (conflicting) riskFactors.push('NFLMeta usage profile conflicts with the market lean')
    if (usage.scoreDelta === 0) riskFactors.push('Usage profile is moderate and adds limited directional edge')

    return {
      ...prop,
      confidence,
      role: usage.summary,
      usageMetric: usage.metric,
      usageSource: 'NFLMeta',
      riskFactors,
    }
  }))

  return [...enriched, ...rest].sort((a, b) => b.confidence - a.confidence)
}

function statusFrom(row: Json): NflGame['status'] {
  const raw = String(row.status ?? row.state ?? row.game_status ?? '').toLowerCase()
  if (raw.includes('live') || raw.includes('progress') || raw.includes('quarter') || raw.includes('halftime')) return 'live'
  if (raw.includes('final') || raw.includes('complete')) return 'final'
  if (raw.includes('scheduled') || raw.includes('pre') || raw.includes('upcoming')) return 'scheduled'
  return 'unknown'
}

function gameFrom(row: Json): NflGame | null {
  const away = str(row, ['away_team', 'away', 'awayTeam', 'visitor', 'visitor_team'])
  const home = str(row, ['home_team', 'home', 'homeTeam', 'host', 'host_team'])
  if (!away || !home) return null

  return {
    id: String(row.id ?? row.game_id ?? `${away}-${home}-${row.kickoff_at ?? row.game_date ?? ''}`),
    away,
    home,
    awayScore: val(row, ['away_score', 'awayScore']),
    homeScore: val(row, ['home_score', 'homeScore']),
    kickoff: str(row, ['kickoff_at', 'kickoffAt', 'game_date', 'date']) ?? undefined,
    status: statusFrom(row),
    detail: str(row, ['status_detail', 'detail', 'clock', 'summary']) ?? undefined,
    week: val(row, ['week']),
  }
}

export async function getNFLGames(): Promise<{ games: NflGame[]; error?: string }> {
  if (!key()) return { games: [], error: 'NFLMETA_API_KEY is not configured' }

  try {
    const current = await nflFetch('/live-scores', 20)
    let games = dataRows(current).map(gameFrom).filter((g): g is NflGame => !!g)

    // If live-scores does not include enough future schedule, supplement with the games index.
    if (games.filter((g) => g.status === 'scheduled').length < 4) {
      try {
        const schedule = await nflFetch(`/games?season=${seasonYear()}&limit=40`, 900)
        const extra = dataRows(schedule).map(gameFrom).filter((g): g is NflGame => !!g)
        const byId = new Map(games.map((g) => [g.id, g]))
        for (const g of extra) if (!byId.has(g.id)) byId.set(g.id, g)
        games = [...byId.values()]
      } catch {}
    }

    games.sort((a, b) => {
      const ta = a.kickoff ? Date.parse(a.kickoff) : Number.MAX_SAFE_INTEGER
      const tb = b.kickoff ? Date.parse(b.kickoff) : Number.MAX_SAFE_INTEGER
      return ta - tb
    })

    return { games: games.slice(0, 32) }
  } catch (e) {
    return { games: [], error: e instanceof Error ? e.message : 'NFLMeta scores request failed' }
  }
}
