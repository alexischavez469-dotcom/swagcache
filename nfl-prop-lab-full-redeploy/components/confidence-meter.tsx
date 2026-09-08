import { cn } from '@/lib/utils'

export function ConfidenceMeter({ score }: { score: number }) {
  const tone =
    score >= 8
      ? 'text-primary'
      : score >= 6
        ? 'text-warning'
        : 'text-destructive'
  const barTone =
    score >= 8 ? 'bg-primary' : score >= 6 ? 'bg-warning' : 'bg-destructive'

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-baseline gap-0.5 font-mono">
        <span className={cn('text-lg font-semibold leading-none', tone)}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/10</span>
      </div>
      <div
        className="flex gap-0.5"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-label={`Confidence score ${score} out of 10`}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-1 rounded-full',
              i < score ? barTone : 'bg-secondary',
            )}
          />
        ))}
      </div>
    </div>
  )
}
