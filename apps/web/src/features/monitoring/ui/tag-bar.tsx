import { Tag } from 'lucide-react'

import { collectTags } from '../model/tags.ts'
import type { MonitorView } from '../model/monitor.ts'

export function TagBar({
  monitors,
  onSelect,
  selected,
}: Readonly<{
  monitors: readonly MonitorView[]
  onSelect: (tag: string | null) => void
  selected: string | null
}>) {
  const tags = collectTags(monitors)

  if (tags.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Filtrer par tag"
      className="flex flex-wrap items-center gap-2"
      role="group"
    >
      <Tag aria-hidden="true" className="text-muted" size={15} />
      {tags.map(({ count, tag }) => {
        const active = tag === selected

        return (
          <button
            aria-pressed={active}
            className={`min-h-8 rounded-full border px-3 text-xs transition-colors ${
              active
                ? 'border-action bg-action/10 text-action'
                : 'border-line text-muted hover:border-border-strong hover:text-ink'
            }`}
            key={tag}
            onClick={() => onSelect(active ? null : tag)}
            type="button"
          >
            {tag}
            <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
