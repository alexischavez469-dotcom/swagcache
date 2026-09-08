# Prop Lab v4

Live FanDuel props via SportsGameOdds, plus best-effort public ESPN context.

## Environment variable
SPORTSGAMEODDS_API_KEY

## Context feeds
- NFL/NCAAF/NBA/MLB/Soccer: opponent team defensive statistics from ESPN when available
- Tennis: ATP/WTA ranking, recent 45-day win/loss form, recent head-to-head, and surface metadata when ESPN exposes it

## Scoring
- Market-only confidence: 1-6
- Market + context: up to 7
- 8-10 intentionally reserved for deeper role/usage, serve-return splits, recent player-level stat logs, and injuries

No additional API key is required for ESPN.
