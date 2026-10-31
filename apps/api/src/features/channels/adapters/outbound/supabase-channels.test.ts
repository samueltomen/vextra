import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  ChannelLimitError,
  ChannelNameTakenError,
} from '../../application/channels.ts'
import {
  SupabaseChannelDeliveryQueue,
  SupabaseChannelRepository,
  SupabaseChannelSecrets,
  SupabaseIncidentReminders,
} from './supabase-channels.ts'

type Result = Readonly<{
  data?: unknown
  error?: Readonly<{ code?: string }> | null
}>

function client(result: Result) {
  const calls: Array<[string, unknown[]]> = []
  const chain: Record<string, unknown> = {}
  const resolved = { data: result.data ?? null, error: result.error ?? null }

  for (const method of [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'rpc',
  ]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args])

      return method === 'rpc' ? Promise.resolve(resolved) : chain
    })
  }

  chain['single'] = vi.fn(async () => resolved)
  chain['maybeSingle'] = vi.fn(async () => resolved)
  chain['then'] = (resolve: (value: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(resolve)

  return { calls, supabase: chain as unknown as SupabaseClient }
}

const ROW = {
  created_at: '2026-10-31T10:00:00.000Z',
  enabled: true,
  id: 'c1',
  kind: 'slack',
  name: 'Ops',
  target_hint: 'hooks.slack.com/…abcd',
}

describe('SupabaseChannelRepository', () => {
  it('lists and creates channels without ever selecting the secret target', async () => {
    const listed = client({ data: [ROW] })

    await expect(
      new SupabaseChannelRepository(listed.supabase).list('tenant-a'),
    ).resolves.toEqual([
      {
        createdAtMs: Date.parse(ROW.created_at),
        enabled: true,
        id: 'c1',
        kind: 'slack',
        name: 'Ops',
        targetHint: 'hooks.slack.com/…abcd',
      },
    ])
    expect(listed.calls).toContainEqual(['eq', ['tenant_id', 'tenant-a']])
    expect(JSON.stringify(listed.calls)).not.toMatch(/"[^"]*\btarget\b[^_]/u)

    const created = client({ data: ROW })

    await new SupabaseChannelRepository(created.supabase).create('tenant-a', {
      kind: 'slack',
      name: 'Ops',
      target: 'https://hooks.slack.com/services/T/B/abcd',
      targetHint: 'hooks.slack.com/…abcd',
    })
    expect(created.calls).toContainEqual([
      'insert',
      [
        {
          kind: 'slack',
          name: 'Ops',
          target: 'https://hooks.slack.com/services/T/B/abcd',
          target_hint: 'hooks.slack.com/…abcd',
          tenant_id: 'tenant-a',
        },
      ],
    ])
  })

  it('enables, disables and removes within the tenant', async () => {
    const hit = client({ data: [{ id: 'c1' }] })
    const miss = client({ data: [] })

    await expect(
      new SupabaseChannelRepository(hit.supabase).setEnabled('t', 'c1', false),
    ).resolves.toBe(true)
    expect(hit.calls).toContainEqual(['update', [{ enabled: false }]])
    await expect(
      new SupabaseChannelRepository(hit.supabase).remove('t', 'c1'),
    ).resolves.toBe(true)
    await expect(
      new SupabaseChannelRepository(miss.supabase).remove('t', 'c1'),
    ).resolves.toBe(false)
  })

  it('maps Postgres error codes to domain errors', async () => {
    const repo = (code: string) =>
      new SupabaseChannelRepository(client({ error: { code } }).supabase)
    const input = {
      kind: 'slack' as const,
      name: 'Ops',
      target: 'x',
      targetHint: 'x',
    }

    await expect(repo('23505').create('t', input)).rejects.toBeInstanceOf(
      ChannelNameTakenError,
    )
    await expect(repo('54000').create('t', input)).rejects.toBeInstanceOf(
      ChannelLimitError,
    )
    await expect(repo('XX000').list('t')).rejects.toThrow(
      'channel query failed',
    )
  })
})

describe('SupabaseChannelSecrets', () => {
  it('reads the target of one channel of the tenant with the service client', async () => {
    const { calls, supabase } = client({
      data: { kind: 'slack', target: 'https://hooks.slack.com/x' },
    })

    await expect(
      new SupabaseChannelSecrets(supabase).findTarget('tenant-a', 'c1'),
    ).resolves.toEqual({ kind: 'slack', target: 'https://hooks.slack.com/x' })
    expect(calls).toContainEqual(['eq', ['tenant_id', 'tenant-a']])
    expect(calls).toContainEqual(['eq', ['id', 'c1']])
    await expect(
      new SupabaseChannelSecrets(client({ data: null }).supabase).findTarget(
        't',
        'c',
      ),
    ).resolves.toBeNull()
    await expect(
      new SupabaseChannelSecrets(
        client({ error: { code: 'x' } }).supabase,
      ).findTarget('t', 'c'),
    ).rejects.toThrow('channel secret query failed')
  })
})

describe('SupabaseChannelDeliveryQueue', () => {
  it('claims and completes deliveries through the dedicated RPCs', async () => {
    const claimed = client({
      data: [
        {
          attempts: 1,
          channel_kind: 'slack',
          channel_name: 'Ops',
          delivery_id: 'd1',
          kind: 'incident_opened',
          monitor_id: 'm1',
          monitor_name: null,
          opened_at: '2026-10-31T10:00:00.000Z',
          target: 'https://hooks.slack.com/x',
        },
      ],
    })

    await expect(
      new SupabaseChannelDeliveryQueue(claimed.supabase).claim(20),
    ).resolves.toEqual([
      {
        attempts: 1,
        channelKind: 'slack',
        channelName: 'Ops',
        deliveryId: 'd1',
        event: 'incident_opened',
        monitorId: 'm1',
        monitorName: null,
        openedAtMs: Date.parse('2026-10-31T10:00:00.000Z'),
        target: 'https://hooks.slack.com/x',
      },
    ])
    expect(claimed.calls).toContainEqual([
      'rpc',
      ['claim_channel_deliveries', { p_batch_size: 20 }],
    ])

    const completed = client({ data: true })

    await new SupabaseChannelDeliveryQueue(completed.supabase).complete({
      deliveryId: 'd1',
      errorCode: null,
      success: true,
    })
    expect(completed.calls).toContainEqual([
      'rpc',
      [
        'complete_channel_delivery',
        { p_delivery_id: 'd1', p_error_code: null, p_success: true },
      ],
    ])
  })

  it('fails closed on RPC errors', async () => {
    const failing = new SupabaseChannelDeliveryQueue(
      client({ error: { code: 'x' } }).supabase,
    )

    await expect(failing.claim(1)).rejects.toThrow('channel claim failed')
    await expect(
      failing.complete({ deliveryId: 'd', errorCode: null, success: true }),
    ).rejects.toThrow('channel completion failed')
  })
})

describe('SupabaseIncidentReminders', () => {
  it('returns the number of reminders enqueued by the RPC', async () => {
    await expect(
      new SupabaseIncidentReminders(client({ data: 2 }).supabase).enqueue(),
    ).resolves.toBe(2)
    await expect(
      new SupabaseIncidentReminders(
        client({ error: { code: 'x' } }).supabase,
      ).enqueue(),
    ).rejects.toThrow('reminder enqueue failed')
  })
})
