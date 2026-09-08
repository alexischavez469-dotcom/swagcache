export type Sport = 'NFL' | 'NCAAF' | 'NBA' | 'MLB' | 'NHL' | 'Soccer'

export type Recommendation = 'More' | 'Less'

export type RiskLevel = 'Low' | 'Medium' | 'High'

export interface BookLine {
  book: string
  line: number
}

export interface Prop {
  id: string
  sport: Sport
  player: string
  team: string
  teamAbbr: string
  opponent: string
  opponentAbbr: string
  gameTime: string
  propType: string
  prizePicksLine: number
  recommendation: Recommendation
  confidence: number // 1-10
  consensus: BookLine[]
  matchupAnalysis: string
  role: string
  recentPerformance: number[] // last games, same stat
  recentLabel: string
  riskLevel: RiskLevel
  riskFactors: string[]
}

export const SPORTS: Sport[] = ['NFL', 'NCAAF', 'NBA', 'MLB', 'NHL', 'Soccer']
