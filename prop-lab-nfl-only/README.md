# NFL Prop Lab

NFL-only prop analysis app.

## Required Vercel environment variables
- `SPORTSGAMEODDS_API_KEY` for live FanDuel prop lines
- `NFLMETA_API_KEY` for NFLMeta player usage, current scores, and schedule

## Data
- FanDuel props and market fair line: SportsGameOdds
- Opponent pass/run matchup summary: ESPN public team stats
- Actual player season usage: NFLMeta player search + season stats
- Live scores / upcoming schedule: NFLMeta live-scores + games

## Scoring
- market + matchup + actual NFLMeta usage can move confidence up to 8/10
- 9-10 remain reserved for future injury/news and deeper recent-game role confirmation
- only the top 30 props are NFLMeta-enriched per refresh to protect free-tier quota
