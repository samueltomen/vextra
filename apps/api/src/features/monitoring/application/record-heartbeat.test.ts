import { describe, expect, it, vi } from 'vitest'

import { RecordHeartbeat, type HeartbeatRecorder } from './record-heartbeat.ts'

function createRecorder(
  overrides: Partial<HeartbeatRecorder> = {},
): HeartbeatRecorder {
  return {
    record: vi.fn(async () => true),
    ...overrides,
  }
}

describe('RecordHeartbeat', () => {
  it('hashes the token before sending anything to persistence', async () => {
    const recorder = createRecorder()
    const hashToken = vi.fn(async () => 'a'.repeat(64))
    const heartbeat = new RecordHeartbeat({ hashToken, recorder })
    const token = 'A'.repeat(43)

    await expect(heartbeat.execute(token)).resolves.toBe(true)
    expect(hashToken).toHaveBeenCalledWith(token)
    expect(recorder.record).toHaveBeenCalledWith('a'.repeat(64))
    expect(JSON.stringify(vi.mocked(recorder.record).mock.calls)).not.toContain(
      token,
    )
  })

  it('propagates a storage failure without substituting a heartbeat result', async () => {
    const heartbeat = new RecordHeartbeat({
      hashToken: async () => 'b'.repeat(64),
      recorder: createRecorder({
        record: async () => {
          throw new Error('database unavailable')
        },
      }),
    })

    await expect(heartbeat.execute('B'.repeat(43))).rejects.toThrow(
      'database unavailable',
    )
  })
})
