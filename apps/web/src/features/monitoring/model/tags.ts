export const MAX_TAGS = 10
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,23}$/

/** Normalizes user input to a valid tag, or `null` when it cannot be one. */
export function normalizeTag(input: string): string | null {
  const tag = input.trim().toLowerCase().replaceAll(/\s+/g, '-')

  return TAG_PATTERN.test(tag) ? tag : null
}

export function collectTags(
  monitors: readonly Readonly<{ tags: readonly string[] }>[],
): readonly Readonly<{ count: number; tag: string }>[] {
  const counts = new Map<string, number>()

  for (const monitor of monitors) {
    for (const tag of monitor.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ count, tag }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function matchesTag(
  tags: readonly string[],
  selected: string | null,
): boolean {
  return selected === null || tags.includes(selected)
}
