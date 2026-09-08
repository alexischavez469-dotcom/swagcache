import { PropLabClient } from '@/components/prop-lab-client'
import { getLiveProps } from '@/lib/sportsgameodds'

export const revalidate = 300

export default async function Page() {
  const result = await getLiveProps()
  return <PropLabClient props={result.props} live={result.live} error={result.error} />
}
