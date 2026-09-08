export type Sport = 'NFL' | 'NCAAF' | 'NBA' | 'MLB' | 'Soccer' | 'Tennis'

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
  fanDuelLine: number
  recommendation: Recommendation
  confidence: number // 1-10; market-only props are capped at 6
  consensus: BookLine[]
  matchupAnalysis: string
  role: string
  recentPerformance: number[]
  recentLabel: string
  riskLevel: RiskLevel
  riskFactors: string[]
  analysisStage: 'Market only' | 'Context enriched'
  matchupSignal?: 'Favorable' | 'Neutral' | 'Tough' | 'Unavailable'
  matchupMetric?: string
  matchupSource?: string
}

export const SPORTS: Sport[] = ['NFL', 'NCAAF', 'NBA', 'MLB', 'Soccer', 'Tennis']
