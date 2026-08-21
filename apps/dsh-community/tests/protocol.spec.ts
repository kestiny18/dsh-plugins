import { describe, expect, it } from 'vitest'
import { snapshotSchema } from '../src/shared.js'
import { canonicalJson, openSecret, sealSecret, sha256 } from '../src/worker/crypto.js'
import { periodStart, snapshotRevisionDecision } from '../src/worker/index.js'

describe('Community protocol boundary', () => {
  it('canonicalizes snapshot bodies and hashes them deterministically', async () => {
    const left = { revision: 1, dailyUsage: [], protocolVersion: 1 }
    const right = { protocolVersion: 1, dailyUsage: [], revision: 1 }
    expect(canonicalJson(left)).toBe(canonicalJson(right))
    expect(await sha256(canonicalJson(left))).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('enforces absolute snapshot revision semantics', () => {
    expect(snapshotRevisionDecision(4, 'same', 4, 'same')).toBe('idempotent')
    expect(snapshotRevisionDecision(4, 'old', 4, 'different')).toBe('conflict')
    expect(snapshotRevisionDecision(4, 'old', 3, 'different')).toBe('stale')
    expect(snapshotRevisionDecision(4, 'old', 5, 'different')).toBe('accept')
  })

  it('accepts only protocol V1 and bounded aggregate rows', () => {
    const parsed = snapshotSchema.safeParse({
      protocolVersion: 1,
      taxonomyVersion: 1,
      pluginVersion: '0.2.0',
      revision: 1,
      dailyUsage: [],
      modelUsage: [],
      snapshotDigest: 'a'.repeat(64),
    })
    expect(parsed.success).toBe(true)
    expect(snapshotSchema.safeParse({ ...parsed.data, protocolVersion: 2 }).success).toBe(false)
  })

  it('round-trips one-time device credentials without storing plaintext', async () => {
    const secret = 'a sufficiently long test secret for AES-GCM'
    const sealed = await sealSecret('device-credential', secret)
    expect(sealed).not.toContain('device-credential')
    expect(await openSecret(sealed, secret)).toBe('device-credential')
  })

  it('uses inclusive UTC leaderboard windows', () => {
    const now = Date.UTC(2026, 7, 21, 15)
    expect(periodStart('today', now)).toBe('2026-08-21')
    expect(periodStart('7d', now)).toBe('2026-08-15')
    expect(periodStart('30d', now)).toBe('2026-07-23')
    expect(periodStart('all', now)).toBeUndefined()
  })
})
