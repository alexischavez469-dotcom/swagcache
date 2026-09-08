export type Sport = 'NFL'
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
  confidence: number
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
  usageMetric?: string
  usageSource?: string
}

export interface NflGame {
  id: string
  away: string
  home: string
  awayScore?: number | null
  homeScore?: number | null
  kickoff?: string
  status: 'scheduled' | 'live' | 'final' | 'unknown'
  detail?: string
  week?: number | null
}

export const SPORTS: Sport[] = ['NFL']
