import type { Prop } from '@/lib/props-data'

function text(prop: Prop): string {
  return `${prop.propType} ${prop.player}`.toLowerCase()
}

function footballRole(prop: Prop): string {
  const p = text(prop)
  if (p.includes('passing') || p.includes('completion') || p.includes('pass attempt')) {
    return `${prop.player} is being evaluated as the team's primary passer. This prop benefits from sustained passing volume, neutral/negative game script, and staying competitive enough to keep throwing. A run-heavy lead or low attempt count hurts it.`
  }
  if (p.includes('receiving') || p.includes('reception')) {
    return `${prop.player} is being evaluated as a receiving option in ${prop.teamAbbr}'s passing game. This prop benefits from route participation, target volume, and a matchup that forces or allows ${prop.teamAbbr} to throw. Low target share or a run-heavy script is the main usage risk.`
  }
  if (p.includes('rushing') || p.includes('rush ')) {
    return `${prop.player} is being evaluated as a ball carrier for ${prop.teamAbbr}. This prop benefits from early-down carries, goal-line work, and a game script where ${prop.teamAbbr} can stay committed to the run. Falling behind or losing carries to a committee hurts it.`
  }
  return `${prop.player}'s exact football role metric is not available from the current feed. The prop should be interpreted through expected playing time, touches, and game script rather than the market line alone.`
}

function basketballRole(prop: Prop): string {
  const p = text(prop)
  if (p.includes('assist')) return `${prop.player}'s assist prop depends on primary/secondary ball-handling duties, minutes, and teammate shot conversion. More on-ball creation and stable starter minutes help; reduced usage or lineup changes hurt.`
  if (p.includes('rebound')) return `${prop.player}'s rebound prop benefits from strong minutes, interior positioning, and opponent shot volume/missed shots. Smaller lineups, foul trouble, or reduced frontcourt minutes hurt it.`
  if (p.includes('point') || p.includes('three')) return `${prop.player}'s scoring prop depends on minutes, shot volume, offensive usage, and role in the closing lineup. A larger scoring burden helps; low usage or blowout risk can suppress attempts.`
  return `${prop.player}'s basketball prop depends primarily on minutes and usage within ${prop.teamAbbr}'s rotation. Starter-level playing time and a stable role help; rotation volatility is the main usage risk.`
}

function baseballRole(prop: Prop): string {
  const p = text(prop)
  if (p.includes('strikeout') || p.includes('pitch')) return `${prop.player}'s pitching prop depends on start length, pitch count, opponent contact profile, and whether the game stays close enough for a normal workload. Early removal is the biggest usage risk.`
  return `${prop.player}'s hitting prop depends on lineup spot and expected plate appearances. Batting near the top of the order and a competitive game help maximize opportunities; a low lineup slot or pinch-hit risk hurts volume.`
}

function soccerRole(prop: Prop): string {
  const p = text(prop)
  if (p.includes('pass')) return `${prop.player}'s passing prop benefits from playing a full match, operating in buildup, and ${prop.teamAbbr} controlling possession. A low-possession game or early substitution reduces opportunities.`
  if (p.includes('shot') || p.includes('goal')) return `${prop.player}'s attacking prop benefits from advanced positioning, minutes, and involvement in the final third. More team possession and attacking responsibility help; deeper positioning or substitution risk hurt.`
  if (p.includes('tackle') || p.includes('foul')) return `${prop.player}'s defensive-action prop benefits from facing sustained pressure and remaining on the pitch. A dominant possession game for ${prop.teamAbbr} can actually reduce defensive opportunities.`
  return `${prop.player}'s soccer prop is driven mainly by expected minutes, position, and how much of the match ${prop.teamAbbr} controls. Early substitution is the largest generic role risk.`
}

function tennisRole(prop: Prop): string {
  const p = text(prop)
  if (p.includes('ace')) return `${prop.player}'s ace prop is driven by serve quality, number of service games, and how long the match lasts. A close match with more sets/games creates more ace opportunities; a short straight-set match reduces volume.`
  if (p.includes('game')) return `${prop.player}'s games prop depends on competitiveness and match length. A close matchup or tiebreak-heavy match helps volume; a one-sided straight-set result can kill the over quickly.`
  if (p.includes('break')) return `${prop.player}'s break-point prop depends on return pressure and opponent serve vulnerability. Longer return games and weaker opposing service performance create more chances.`
  return `${prop.player}'s tennis prop is mainly affected by match length, competitiveness, and the specific serve/return matchup. Unlike team sports, there is no substitution risk, but a short straight-set match can sharply reduce volume.`
}

export function buildRoleUsageSummary(prop: Prop): string {
  if (prop.sport === 'NFL' || prop.sport === 'NCAAF') return footballRole(prop)
  if (prop.sport === 'NBA') return basketballRole(prop)
  if (prop.sport === 'MLB') return baseballRole(prop)
  if (prop.sport === 'Soccer') return soccerRole(prop)
  if (prop.sport === 'Tennis') return tennisRole(prop)
  return `${prop.player}'s role is not fully described by the current data feed.`
}
