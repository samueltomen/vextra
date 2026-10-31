import { describe, expect, it } from 'vitest'

import {
  getLocalMonitorLabel,
  getLocalMonitorLabels,
  saveLocalMonitorLabel,
} from './local-labels.ts'

describe('local monitor labels', () => {
  it('stores trimmed labels only in local storage', () => {
    saveLocalMonitorLabel('monitor-1', '  Backup DB  ')

    expect(getLocalMonitorLabel('monitor-1')).toBe('Backup DB')
    expect(getLocalMonitorLabels()).toEqual({ 'monitor-1': 'Backup DB' })
    expect(window.localStorage.getItem('vextra.monitor-labels.v1')).toContain(
      'Backup DB',
    )
  })

  it('ignores empty and malformed stored values', () => {
    saveLocalMonitorLabel('empty', '   ')
    window.localStorage.setItem('vextra.monitor-labels.v1', 'not-json')

    expect(getLocalMonitorLabels()).toEqual({})
    expect(getLocalMonitorLabel('missing')).toBeNull()
  })
})
