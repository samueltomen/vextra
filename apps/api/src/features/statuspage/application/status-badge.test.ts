import { describe, expect, it } from 'vitest'

import { buildBadge, renderBadgeSvg } from './status-badge.ts'

const monitor = (
  status: 'healthy' | 'late' | 'paused' | 'pending',
  uptime30d = 100,
) => ({ name: 'x', status, uptime30d })

describe('buildBadge status', () => {
  it('is green when nothing is late', () => {
    expect(
      buildBadge(
        { monitors: [monitor('healthy'), monitor('paused')] },
        'status',
      ),
    ).toMatchObject({ message: 'opérationnel' })
  })

  it('is red as soon as a monitor is late', () => {
    expect(
      buildBadge({ monitors: [monitor('healthy'), monitor('late')] }, 'status'),
    ).toMatchObject({ color: '#cf222e', message: 'incident' })
  })

  it('is unknown without any active monitor', () => {
    expect(buildBadge({ monitors: [] }, 'status').message).toBe('inconnu')
    expect(
      buildBadge({ monitors: [monitor('paused')] }, 'status').message,
    ).toBe('inconnu')
  })
})

describe('buildBadge uptime', () => {
  it('averages active monitors and truncates instead of rounding up', () => {
    expect(
      buildBadge(
        { monitors: [monitor('healthy', 99.999), monitor('healthy', 99.999)] },
        'uptime',
      ).message,
    ).toBe('99.99 %')
  })

  it('colours by availability threshold', () => {
    const color = (value: number) =>
      buildBadge({ monitors: [monitor('healthy', value)] }, 'uptime').color

    expect(color(99.95)).toBe('#2da44e')
    expect(color(99.5)).toBe('#bf8700')
    expect(color(90)).toBe('#cf222e')
  })

  it('shows n/a without an active monitor', () => {
    expect(buildBadge({ monitors: [] }, 'uptime').message).toBe('n/a')
  })
})

describe('renderBadgeSvg', () => {
  it('renders an accessible SVG with attributes only', () => {
    const svg = renderBadgeSvg({
      color: '#2da44e',
      label: 'statut',
      message: 'opérationnel',
    })

    expect(svg).toContain('role="img"')
    expect(svg).toContain('aria-label="statut: opérationnel"')
    expect(svg).not.toContain('<style')
    expect(svg).not.toContain('<script')
  })

  it('escapes markup in texts', () => {
    const svg = renderBadgeSvg({
      color: '#000',
      label: '<b>"x"</b>',
      message: 'a&b',
    })

    expect(svg).not.toContain('<b>')
    expect(svg).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
    expect(svg).toContain('a&amp;b')
  })
})
