'use client'

import { cn } from '@/lib/utils'
import { SPORTS, type Sport } from '@/lib/props-data'

type Filter = Sport | 'All'

export function SportFilter({
  active,
  onChange,
}: {
  active: Filter
  onChange: (value: Filter) => void
}) {
  const options: Filter[] = ['All', ...SPORTS]
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {options.map((sport) => {
          const isActive = active === sport
          return (
            <button
              key={sport}
              type="button"
              onClick={() => onChange(sport)}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border',
              )}
            >
              {sport}
            </button>
          )
        })}
      </div>
    </div>
  )
}
