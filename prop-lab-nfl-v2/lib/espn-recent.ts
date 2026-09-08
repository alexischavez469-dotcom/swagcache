import 'server-only'
import type { Prop } from '@/lib/props-data'

type Json = Record<string, unknown>

function norm(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function deepObjects(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const item of node) deepObjects(item, out)
    return out
  }
  if (!node || typeof node !== 'object') return out
  const obj = node as Json
  out.push(obj)
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') deepObjects(v, out)
  }
  return out
}

function nameOf(obj: Json): string {
  return String(obj.displayName ?? obj.fullName ?? obj.name ?? '').trim()
}

async function espnPlayerId(playerName: string): Promise<string | null> {
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&limit=10&type=player`
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4500) })
    if (!res.ok) return null
    const body = await res.json() as unknown
    const target = norm(playerName)
    for (const obj of deepObjects(body)) {
      const name = nameOf(obj)
      if (!name) continue
      const id = obj.id ?? obj.uid
      if (id && norm(name) === target) return String(id).replace(/^.*:/, '')
    }
  } catch {}
  return null
}

function statValue(stats: Json[], names: string[]): number | null {
  const wanted = names.map(norm)
  for (const st of stats) {
    const n = norm(String(st.name ?? st.abbreviation ?? st.displayName ?? ''))
    if (!n) continue
    if (wanted.includes(n) || wanted.some((w) => n.includes(w) || w.includes(n))) {
      const value = toNum(st.value ?? st.displayValue)
      if (value != null) return value
    }
  }
  return null
}

function summarizeGame(obj: Json, prop: Prop): { label: string; value: string } | null {
  const stats = deepObjects(obj).filter((x) =>
    'value' in x || 'displayValue' in x
  )
  const p = prop.propType.toLowerCase()

  let value: number | null = null
  let suffix = ''

  if (p.includes('receiv') && p.includes('yard')) {
    value = statValue(stats, ['receivingYards', 'recYds'])
    suffix = 'yd'
  } else if (p.includes('reception')) {
    value = statValue(stats, ['receptions', 'rec'])
    suffix = 'rec'
  } else if (p.includes('rush') && p.includes('yard')) {
    value = statValue(stats, ['rushingYards', 'rushYds'])
    suffix = 'yd'
  } else if (p.includes('passing') && p.includes('yard')) {
    value = statValue(stats, ['passingYards', 'passYds'])
    suffix = 'yd'
  } else if (p.includes('completion')) {
    value = statValue(stats, ['completions', 'cmp'])
    suffix = 'cmp'
  } else if (p.includes('pass attempt')) {
    value = statValue(stats, ['passingAttempts', 'att'])
    suffix = 'att'
  } else if (p.includes('touchdown')) {
    value = statValue(stats, ['passingTouchdowns', 'rushingTouchdowns', 'receivingTouchdowns', 'touchdowns'])
    suffix = 'TD'
  } else {
    value =
      statValue(stats, ['receivingYards', 'rushingYards', 'passingYards', 'receptions'])
    suffix = ''
  }

  if (value == null) return null

  const date =
    String(obj.date ?? obj.gameDate ?? obj.eventDate ?? '').slice(0, 10) ||
    String(obj.shortName ?? obj.name ?? 'Game')

  return { label: date, value: `${value}${suffix ? ` ${suffix}` : ''}` }
}

export async function getRecentESPNStats(prop: Prop): Promise<Array<{ label: string; value: string }>> {
  const id = await espnPlayerId(prop.player)
  if (!id) return []

  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${id}/gamelog`,
    `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${id}/gamelog`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const body = await res.json() as unknown
      const rows = deepObjects(body)
      const games: Array<{ label: string; value: string }> = []

      for (const row of rows) {
        const summary = summarizeGame(row, prop)
        if (summary) games.push(summary)
        if (games.length >= 5) break
      }

      const deduped = games.filter((g, i, a) =>
        a.findIndex((x) => x.label === g.label && x.value === g.value) === i
      )
      if (deduped.length) return deduped.slice(0, 5)
    } catch {}
  }
  return []
}
