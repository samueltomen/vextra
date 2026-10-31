import type { PublicStatusPage } from '@vextra/contracts'

export type BadgeMetric = 'status' | 'uptime'

export type Badge = Readonly<{ color: string; label: string; message: string }>

const GREEN = '#2da44e'
const YELLOW = '#bf8700'
const RED = '#cf222e'
const GREY = '#6e7781'

export function buildBadge(
  page: Pick<PublicStatusPage, 'monitors'>,
  metric: BadgeMetric,
): Badge {
  const active = page.monitors.filter((monitor) => monitor.status !== 'paused')

  if (metric === 'uptime') {
    if (active.length === 0) {
      return { color: GREY, label: 'uptime 30 j', message: 'n/a' }
    }

    const average =
      active.reduce((sum, monitor) => sum + monitor.uptime30d, 0) /
      active.length

    return {
      color: average >= 99.9 ? GREEN : average >= 99 ? YELLOW : RED,
      label: 'uptime 30 j',
      message: `${(Math.floor(average * 100) / 100).toFixed(2)} %`,
    }
  }

  if (active.length === 0) {
    return { color: GREY, label: 'statut', message: 'inconnu' }
  }

  return active.some((monitor) => monitor.status === 'late')
    ? { color: RED, label: 'statut', message: 'incident' }
    : { color: GREEN, label: 'statut', message: 'opérationnel' }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const CHAR_WIDTH = 6.6
const PADDING = 10

/** Flat two-part badge; attributes only (no inline CSS, safe under a strict CSP). */
export function renderBadgeSvg(badge: Badge): string {
  const labelWidth = Math.ceil(badge.label.length * CHAR_WIDTH + PADDING * 2)
  const messageWidth = Math.ceil(
    badge.message.length * CHAR_WIDTH + PADDING * 2,
  )
  const width = labelWidth + messageWidth
  const label = escapeXml(badge.label)
  const message = escapeXml(badge.message)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${message}"><title>${label}: ${message}</title><clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${badge.color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${labelWidth / 2}" y="14">${label}</text><text x="${labelWidth + messageWidth / 2}" y="14">${message}</text></g></svg>`
}
