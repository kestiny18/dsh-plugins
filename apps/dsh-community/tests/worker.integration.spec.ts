import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Snapshot } from '../src/shared.js'
import worker from '../src/worker/index.js'
import { canonicalJson, sha256 } from '../src/worker/crypto.js'

const BASE_URL = 'https://dshcommunity.com'

interface UsageInput {
  requests?: number
  usageUnavailableRequests?: number
  uncachedInputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  outputTokens?: number
}

function buckets(input: UsageInput = {}) {
  return {
    requests: input.requests ?? 1,
    usageUnavailableRequests: input.usageUnavailableRequests ?? 0,
    uncachedInputTokens: input.uncachedInputTokens ?? 0,
    cacheReadTokens: input.cacheReadTokens ?? 0,
    cacheWriteTokens: input.cacheWriteTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
  }
}

async function snapshot(
  revision: number,
  dailyUsage: Snapshot['dailyUsage'],
  modelUsage: Snapshot['modelUsage'],
): Promise<Snapshot> {
  const body = {
    protocolVersion: 1 as const,
    taxonomyVersion: 1 as const,
    pluginVersion: '0.2.3',
    revision,
    dailyUsage,
    modelUsage,
  }
  return { ...body, snapshotDigest: await sha256(canonicalJson(body)) }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return await worker.fetch(new Request(`${BASE_URL}${path}`, init), env)
}

async function upload(deviceCredential: string, value: Snapshot): Promise<Response> {
  return await request('/api/v1/snapshots', {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${deviceCredential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(value),
  })
}

async function seedUser(userId: string, login: string): Promise<void> {
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,display_name,avatar_url,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(userId, login, `https://avatars.githubusercontent.com/u/${login.length}`, now, now),
    env.DB.prepare("INSERT INTO identities(id,user_id,provider,provider_id,provider_login,login_key,created_at,updated_at) VALUES(?,?,'github',?,?,?,?,?)")
      .bind(`identity-${userId}`, userId, `github-${userId}`, login, login.toLowerCase(), now, now),
  ])
}

async function seedDevice(deviceId: string, userId: string, credential: string): Promise<void> {
  const now = Date.now()
  await env.DB.prepare('INSERT INTO devices(id,user_id,installation_id_hash,credential_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(deviceId, userId, `installation-${deviceId}`, await sha256(credential), now, now).run()
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM daily_usage'),
    env.DB.prepare('DELETE FROM model_usage'),
    env.DB.prepare('DELETE FROM devices'),
    env.DB.prepare('DELETE FROM device_links'),
    env.DB.prepare('DELETE FROM web_sessions'),
    env.DB.prepare('DELETE FROM oauth_attempts'),
    env.DB.prepare('DELETE FROM identities'),
    env.DB.prepare('DELETE FROM users'),
  ])
})

describe('Community Worker integration', () => {
  it('replaces a device snapshot and removes days and models omitted by a newer revision', async () => {
    await seedUser('user-1', 'alice')
    await seedDevice('device-1', 'user-1', 'credential-1')
    const first = await snapshot(1, [
      { day: '2026-08-23', ...buckets({ uncachedInputTokens: 10 }) },
      { day: '2026-08-24', ...buckets({ cacheReadTokens: 20 }) },
    ], [
      { provider: 'deepseek-official', model: 'deepseek-chat', ...buckets({ uncachedInputTokens: 10 }) },
      { provider: 'deepseek-official', model: 'deepseek-reasoner', ...buckets({ cacheReadTokens: 20 }) },
    ])
    expect((await upload('credential-1', first)).status).toBe(200)

    const second = await snapshot(2, [
      { day: '2026-08-24', ...buckets({ outputTokens: 30 }) },
    ], [
      { provider: 'deepseek-official', model: 'deepseek-chat', ...buckets({ outputTokens: 30 }) },
    ])
    expect((await upload('credential-1', second)).status).toBe(200)

    expect((await env.DB.prepare('SELECT day,output_tokens,revision FROM daily_usage WHERE device_id=? ORDER BY day')
      .bind('device-1').all()).results).toEqual([
      { day: '2026-08-24', output_tokens: 30, revision: 2 },
    ])
    expect((await env.DB.prepare('SELECT provider,model,output_tokens,revision FROM model_usage WHERE device_id=? ORDER BY provider,model')
      .bind('device-1').all()).results).toEqual([
      { provider: 'deepseek-official', model: 'deepseek-chat', output_tokens: 30, revision: 2 },
    ])

    expect((await upload('credential-1', await snapshot(3, [], []))).status).toBe(200)
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM daily_usage WHERE device_id=?').bind('device-1').first('count')).toBe(0)
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM model_usage WHERE device_id=?').bind('device-1').first('count')).toBe(0)
  })

  it('enforces idempotent, conflicting, and stale revisions through the API', async () => {
    await seedUser('user-1', 'alice')
    await seedDevice('device-1', 'user-1', 'credential-1')
    const first = await snapshot(1, [{ day: '2026-08-24', ...buckets({ uncachedInputTokens: 10 }) }], [])
    expect((await upload('credential-1', first)).status).toBe(200)

    const repeated = await upload('credential-1', first)
    expect(repeated.status).toBe(200)
    expect(await repeated.json()).toMatchObject({ accepted: true, idempotent: true, revision: 1 })

    const conflict = await upload('credential-1', await snapshot(1, [{ day: '2026-08-24', ...buckets({ outputTokens: 11 }) }], []))
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'This revision was already accepted with a different digest.' })

    expect((await upload('credential-1', await snapshot(2, [], []))).status).toBe(200)
    const stale = await upload('credential-1', first)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: 'Snapshot revision is older than the accepted revision.' })
  })

  it('authenticates and revokes device credentials', async () => {
    await seedUser('user-1', 'alice')
    await seedDevice('device-1', 'user-1', 'credential-1')
    const value = await snapshot(1, [], [])

    expect((await request('/api/v1/snapshots', { method: 'PUT', body: JSON.stringify(value) })).status).toBe(401)
    expect((await upload('not-the-credential', value)).status).toBe(401)
    expect((await upload('credential-1', value)).status).toBe(200)
    expect((await request('/api/v1/device/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer credential-1', 'content-type': 'application/json' },
      body: '{}',
    })).status).toBe(200)
    expect((await upload('credential-1', await snapshot(2, [], []))).status).toBe(401)
  })

  it('delivers an approved device credential and stores only its hash on the device', async () => {
    await seedUser('user-1', 'alice')
    const webToken = 'web-session-token'
    await env.DB.prepare('INSERT INTO web_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
      .bind(await sha256(webToken), 'user-1', Date.now() + 60_000, Date.now()).run()

    const created = await request('/api/v1/device-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: '11111111-1111-4111-8111-111111111111' }),
    })
    expect(created.status).toBe(201)
    const link = await created.json() as { deviceCode: string; userCode: string }

    const approved = await request('/api/v1/device-links/approve', {
      method: 'POST',
      headers: {
        origin: BASE_URL,
        cookie: `dsh_session=${webToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userCode: link.userCode }),
    })
    expect(approved.status).toBe(200)

    const token = await request('/api/v1/device-links/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceCode: link.deviceCode }),
    })
    expect(token.status).toBe(200)
    const payload = await token.json() as { status: string; deviceCredential: string }
    expect(payload.status).toBe('approved')
    expect(payload.deviceCredential).toHaveLength(64)
    const device = await env.DB.prepare('SELECT credential_hash FROM devices WHERE user_id=?').bind('user-1').first<{ credential_hash: string }>()
    expect(device?.credential_hash).toBe(await sha256(payload.deviceCredential))
    expect(device?.credential_hash).not.toContain(payload.deviceCredential)
  })

  it('aggregates multiple devices by user in the public leaderboard', async () => {
    await seedUser('user-1', 'alice')
    await seedUser('user-2', 'bob')
    await seedDevice('device-1', 'user-1', 'credential-1')
    await seedDevice('device-2', 'user-1', 'credential-2')
    await seedDevice('device-3', 'user-2', 'credential-3')

    expect((await upload('credential-1', await snapshot(1, [{ day: '2026-08-24', ...buckets({ uncachedInputTokens: 100 }) }], []))).status).toBe(200)
    expect((await upload('credential-2', await snapshot(1, [{ day: '2026-08-24', ...buckets({ cacheReadTokens: 200 }) }], []))).status).toBe(200)
    expect((await upload('credential-3', await snapshot(1, [{ day: '2026-08-24', ...buckets({ outputTokens: 250 }) }], []))).status).toBe(200)

    const response = await request('/api/v1/leaderboard?period=all')
    expect(response.status).toBe(200)
    const payload = await response.json() as { summary: { allTime: number; participants: number }; rows: Array<{ githubLogin: string; totalTokens: number; rank: number }> }
    expect(payload.summary).toMatchObject({ allTime: 550, participants: 2 })
    expect(payload.rows).toEqual([
      expect.objectContaining({ githubLogin: 'alice', totalTokens: 300, rank: 1 }),
      expect.objectContaining({ githubLogin: 'bob', totalTokens: 250, rank: 2 }),
    ])
  })

  it('starts GitHub OAuth with PKCE and no additional profile scope', async () => {
    const response = await request('/auth/github/start?returnTo=%2Flink%3Fcode%3DABCD-EFGH')
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.origin).toBe('https://github.com')
    expect(location.pathname).toBe('/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('test-github-client-id')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(location.searchParams.has('state')).toBe(true)
    expect(location.searchParams.has('scope')).toBe(false)
  })
})
