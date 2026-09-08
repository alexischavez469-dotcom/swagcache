import { cn } from '@/lib/utils'

export function Sparkline({
  values,
  line,
  recommendation,
}: {
  values: number[]
  line: number
  recommendation: 'More' | 'Less'
}) {
  const max = Math.max(...values, line)
  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      {values.map((v, i) => {
        const hit = recommendation === 'More' ? v >= line : v <= line
        const height = Math.max(12, Math.round((v / max) * 40))
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {v}
            </span>
            <div
              className={cn(
                'w-5 rounded-sm',
                hit ? 'bg-primary' : 'bg-secondary',
              )}
              style={{ height }}
            />
          </div>
        )
      })}
    </div>
  )
}
