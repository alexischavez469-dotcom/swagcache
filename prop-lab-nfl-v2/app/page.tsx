import { PropLabClient } from '@/components/prop-lab-client'
import { getLiveProps } from '@/lib/sportsgameodds'
import { getNFLGames } from '@/lib/nflmeta'

export const revalidate = 20

export default async function Page() {
  const [propsResult, gamesResult] = await Promise.all([
    getLiveProps(),
    getNFLGames(),
  ])

  return (
    <PropLabClient
      props={propsResult.props}
      live={propsResult.live}
      error={propsResult.error}
      games={gamesResult.games}
      gamesError={gamesResult.error}
    />
  )
}
