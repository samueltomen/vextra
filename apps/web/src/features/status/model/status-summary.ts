import type { PublicStatusPage } from '@vextra/contracts'

export type OverallStatus = 'degraded' | 'operational' | 'unknown'

export function summarizeOverallStatus(
  page: Pick<PublicStatusPage, 'monitors'>,
): OverallStatus {
  const active = page.monitors.filter((monitor) => monitor.status !== 'paused')

  if (active.length === 0) {
    return 'unknown'
  }

  return active.some((monitor) => monitor.status === 'late')
    ? 'degraded'
    : 'operational'
}

export function formatUptime(uptime: number): string {
  return `${uptime.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: uptime === 100 ? 0 : 2,
  })} %`
}
