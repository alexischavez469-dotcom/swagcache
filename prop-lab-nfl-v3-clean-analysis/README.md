# NFL Prop Lab v2

NFL-only prop analysis.

## Required env vars
- SPORTSGAMEODDS_API_KEY
- NFLMETA_API_KEY

## What changed
- Removed the "Context enriched" badge
- Favorable matchup badge uses a green outline
- Tough matchup badge uses a red outline
- Matchup section explains the actual opponent strength/weakness for that day's matchup
- Role & Usage uses NFLMeta season usage and explains how that role affects the exact prop
- Recent section attempts to show the last 5 relevant ESPN game-log values for the prop type
- Live scores and upcoming games remain in the Scores & Games tab

## Data sources
- FanDuel props + fair market: SportsGameOdds
- Opponent defense + recent player game logs: ESPN public endpoints
- Player role/season usage + scores/schedule: NFLMeta
