const LABELS_STORAGE_KEY = 'vextra.monitor-labels.v1'

type StoredLabels = Record<string, string>

function readLabels(): StoredLabels {
  try {
    const raw = window.localStorage.getItem(LABELS_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string' &&
          entry[1].trim().length > 0,
      ),
    )
  } catch {
    return {}
  }
}

export function getLocalMonitorLabels(): Readonly<Record<string, string>> {
  return readLabels()
}

export function getLocalMonitorLabel(monitorId: string): string | null {
  return readLabels()[monitorId] ?? null
}

export function saveLocalMonitorLabel(monitorId: string, label: string): void {
  const normalizedLabel = label.trim()

  if (!normalizedLabel) {
    return
  }

  window.localStorage.setItem(
    LABELS_STORAGE_KEY,
    JSON.stringify({ ...readLabels(), [monitorId]: normalizedLabel }),
  )
}
