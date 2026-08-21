import { snapshotSchema } from '../shared.js'
import type { LeaderboardRow, Period, PublicIdentity } from '../shared.js'
import { canonicalJson, openSecret, pkceChallenge, randomToken, sealSecret, sha256 } from './crypto.js'

export interface Env {
  DB: D1Database
  BASE_URL: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  SESSION_SECRET: string
  ALLOWED_ORIGIN?: string
}

interface Viewer extends PublicIdentity { userId: string }
interface UsageSqlRow {
  user_id: string
  provider_login: string
  display_name: string
  avatar_url: string
  requests: number
  uncached_input_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  output_tokens: number
}

const PUBLIC_MODELS = new Set([
  'anthropic/claude-3-5-haiku', 'anthropic/claude-3-5-sonnet', 'anthropic/claude-3-7-sonnet',
  'anthropic/claude-haiku-4-5', 'anthropic/claude-opus-4', 'anthropic/claude-sonnet-4',
  'deepseek-official/deepseek-chat', 'deepseek-official/deepseek-reasoner',
  'deepseek-official/deepseek-v4-flash', 'deepseek-official/deepseek-v4-pro',
  'google/gemini-2.0-flash', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro',
  'openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4o', 'openai/gpt-4o-mini',
  'openai/gpt-5', 'openai/gpt-5-mini', 'openai/o3', 'openai/o4-mini', 'other/other',
])
const MAX_BODY_BYTES = 1_000_000
const DAY_MS = 86_400_000
const SESSION_SECONDS = 30 * 24 * 60 * 60

const securityHeaders = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
} as const

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders, ...headers },
  })
}

function redirect(location: string, headers?: HeadersInit): Response {
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store', ...securityHeaders, ...headers } })
}

function oauthRedirect(location: string, sessionToken: string): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store', ...securityHeaders })
  headers.append('set-cookie', cookie('dsh_session', sessionToken, SESSION_SECONDS))
  headers.append('set-cookie', cookie('dsh_oauth_state', '', 0))
  return new Response(null, { status: 302, headers })
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${String(maxAge)}`
}

function cookies(request: Request): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0) result[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  }
  return result
}

function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') === true && !value.startsWith('//') ? value : '/'
}

function assertSameOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin')
  return origin !== null && origin === (env.ALLOWED_ORIGIN ?? new URL(env.BASE_URL).origin)
}

async function body<T = unknown>(request: Request): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.')
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.')
  try { return JSON.parse(text) as T } catch { throw new HttpError(400, 'Request body must be valid JSON.') }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function viewer(request: Request, env: Env): Promise<Viewer | undefined> {
  const token = cookies(request).dsh_session
  if (token === undefined) return undefined
  const row = await env.DB.prepare(`
    SELECT u.id AS user_id, u.display_name, u.avatar_url, i.provider_login
    FROM web_sessions s JOIN users u ON u.id=s.user_id
    JOIN identities i ON i.user_id=u.id AND i.provider='github'
    WHERE s.token_hash=? AND s.expires_at>?
  `).bind(await sha256(token), Date.now()).first<{
    user_id: string; display_name: string; avatar_url: string; provider_login: string
  }>()
  return row === null ? undefined : {
    userId: row.user_id,
    githubLogin: row.provider_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    profileUrl: `${env.BASE_URL}/u/${encodeURIComponent(row.provider_login)}`,
  }
}

async function requireViewer(request: Request, env: Env): Promise<Viewer> {
  const result = await viewer(request, env)
  if (result === undefined) throw new HttpError(401, 'Sign in with GitHub first.')
  return result
}

function startOfUtcDay(now = Date.now()): number {
  const value = new Date(now)
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

function dayString(ms: number): string { return new Date(ms).toISOString().slice(0, 10) }
export function periodStart(period: Period, now = Date.now()): string | undefined {
  if (period === 'all') return undefined
  const days = period === 'today' ? 1 : period === '7d' ? 7 : 30
  return dayString(startOfUtcDay(now) - (days - 1) * DAY_MS)
}

export type RevisionDecision = 'accept' | 'idempotent' | 'stale' | 'conflict'
export function snapshotRevisionDecision(currentRevision: number, currentDigest: string | null, incomingRevision: number, incomingDigest: string): RevisionDecision {
  if (incomingRevision < currentRevision) return 'stale'
  if (incomingRevision > currentRevision) return 'accept'
  return currentDigest === incomingDigest ? 'idempotent' : 'conflict'
}

function parsePeriod(value: string | null): Period {
  return value === 'today' || value === '30d' || value === 'all' ? value : '7d'
}

function total(row: UsageSqlRow): number {
  return row.uncached_input_tokens + row.cache_read_tokens + row.cache_write_tokens + row.output_tokens
}

function toLeaderboardRow(row: UsageSqlRow, rank: number, viewerId?: string): LeaderboardRow {
  return {
    rank,
    githubLogin: row.provider_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    profileUrl: `/u/${encodeURIComponent(row.provider_login)}`,
    requests: row.requests,
    uncachedInputTokens: row.uncached_input_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    outputTokens: row.output_tokens,
    totalTokens: total(row),
    isViewer: row.user_id === viewerId,
  }
}

async function usageRows(env: Env, start?: string): Promise<UsageSqlRow[]> {
  const where = start === undefined ? '' : 'AND d.day>=?'
  const statement = env.DB.prepare(`
    SELECT u.id AS user_id, i.provider_login, u.display_name, u.avatar_url,
      SUM(d.requests) AS requests,
      SUM(d.uncached_input_tokens) AS uncached_input_tokens,
      SUM(d.cache_read_tokens) AS cache_read_tokens,
      SUM(d.cache_write_tokens) AS cache_write_tokens,
      SUM(d.output_tokens) AS output_tokens
    FROM users u JOIN identities i ON i.user_id=u.id AND i.provider='github'
    JOIN devices v ON v.user_id=u.id JOIN daily_usage d ON d.device_id=v.id
    WHERE u.profile_public=1 ${where}
    GROUP BY u.id, i.provider_login, u.display_name, u.avatar_url
  `)
  return (start === undefined ? await statement.all<UsageSqlRow>() : await statement.bind(start).all<UsageSqlRow>()).results
}

async function leaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const period = parsePeriod(url.searchParams.get('period'))
  const current = await viewer(request, env)
  const rows = (await usageRows(env, periodStart(period))).sort((a, b) => total(b) - total(a) || a.provider_login.localeCompare(b.provider_login))
  const ranked = rows.map((row, index) => toLeaderboardRow(row, index + 1, current?.userId))
  const starts = {
    today: periodStart('today'), seven: periodStart('7d'), thirty: periodStart('30d'), all: undefined,
  }
  const summaries = await Promise.all([
    usageRows(env, starts.today), usageRows(env, starts.seven), usageRows(env, starts.thirty), usageRows(env),
  ])
  const sum = (items: UsageSqlRow[]) => items.reduce((value, row) => value + total(row), 0)
  return json({
    period,
    generatedAt: Date.now(),
    selfReported: true,
    summary: { today: sum(summaries[0]), sevenDays: sum(summaries[1]), thirtyDays: sum(summaries[2]), allTime: sum(summaries[3]), participants: summaries[3].length },
    rows: ranked.slice(0, 100),
    yourStanding: current === undefined ? undefined : ranked.find(row => row.isViewer),
  })
}

async function publicProfile(_request: Request, env: Env, login: string): Promise<Response> {
  const user = await env.DB.prepare(`
    SELECT u.id AS user_id, u.display_name, u.avatar_url, i.provider_login
    FROM users u JOIN identities i ON i.user_id=u.id AND i.provider='github'
    WHERE i.login_key=? AND u.profile_public=1
  `).bind(login.toLowerCase()).first<{ user_id: string; display_name: string; avatar_url: string; provider_login: string }>()
  if (user === null) throw new HttpError(404, 'This Community profile is not public yet.')
  const days = (await env.DB.prepare(`
    SELECT d.day, SUM(d.requests) AS requests,
      SUM(d.uncached_input_tokens) AS uncachedInputTokens,
      SUM(d.cache_read_tokens) AS cacheReadTokens,
      SUM(d.cache_write_tokens) AS cacheWriteTokens,
      SUM(d.output_tokens) AS outputTokens
    FROM devices v JOIN daily_usage d ON d.device_id=v.id
    WHERE v.user_id=? GROUP BY d.day ORDER BY d.day
  `).bind(user.user_id).all()).results
  const models = (await env.DB.prepare(`
    SELECT m.provider, m.model, SUM(m.requests) AS requests,
      SUM(m.uncached_input_tokens) AS uncachedInputTokens,
      SUM(m.cache_read_tokens) AS cacheReadTokens,
      SUM(m.cache_write_tokens) AS cacheWriteTokens,
      SUM(m.output_tokens) AS outputTokens
    FROM devices v JOIN model_usage m ON m.device_id=v.id
    WHERE v.user_id=? GROUP BY m.provider, m.model ORDER BY (SUM(m.uncached_input_tokens)+SUM(m.cache_read_tokens)+SUM(m.cache_write_tokens)+SUM(m.output_tokens)) DESC
  `).bind(user.user_id).all()).results
  const windows = await Promise.all((['today', '7d', '30d', 'all'] as const).map(async period => {
    const ranked = (await usageRows(env, periodStart(period))).sort((a, b) => total(b) - total(a))
    const index = ranked.findIndex(row => row.user_id === user.user_id)
    return { period, rank: index < 0 ? null : index + 1, totalTokens: index < 0 ? 0 : total(ranked[index] as UsageSqlRow) }
  }))
  return json({
    identity: {
      githubLogin: user.provider_login,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      githubUrl: `https://github.com/${encodeURIComponent(user.provider_login)}`,
    },
    windows,
    days,
    models,
    selfReported: true,
  })
}

async function oauthStart(request: Request, env: Env): Promise<Response> {
  if (env.GITHUB_CLIENT_ID === undefined || env.GITHUB_CLIENT_SECRET === undefined) {
    throw new HttpError(503, 'GitHub sign-in is not configured yet.')
  }
  const state = randomToken()
  const verifier = randomToken(48)
  const expiresAt = Date.now() + 10 * 60 * 1000
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'))
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_attempts WHERE expires_at<=?').bind(Date.now()),
    env.DB.prepare('INSERT INTO oauth_attempts(state_hash,verifier,return_to,expires_at,created_at) VALUES(?,?,?,?,?)')
      .bind(await sha256(state), verifier, returnTo, expiresAt, Date.now()),
  ])
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
  authorize.searchParams.set('redirect_uri', `${env.BASE_URL}/auth/github/callback`)
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('code_challenge', await pkceChallenge(verifier))
  authorize.searchParams.set('code_challenge_method', 'S256')
  authorize.searchParams.set('scope', 'read:user')
  return redirect(authorize.toString(), { 'set-cookie': cookie('dsh_oauth_state', state, 600) })
}

async function oauthCallback(request: Request, env: Env): Promise<Response> {
  if (env.GITHUB_CLIENT_ID === undefined || env.GITHUB_CLIENT_SECRET === undefined) {
    throw new HttpError(503, 'GitHub sign-in is not configured yet.')
  }
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  if (state === null || code === null || cookies(request).dsh_oauth_state !== state) throw new HttpError(400, 'GitHub sign-in state is invalid.')
  const attempt = await env.DB.prepare('SELECT verifier,return_to,expires_at FROM oauth_attempts WHERE state_hash=?')
    .bind(await sha256(state)).first<{ verifier: string; return_to: string; expires_at: number }>()
  if (attempt === null || attempt.expires_at <= Date.now()) throw new HttpError(400, 'GitHub sign-in expired. Please try again.')
  await env.DB.prepare('DELETE FROM oauth_attempts WHERE state_hash=?').bind(await sha256(state)).run()
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'dsh-community' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.BASE_URL}/auth/github/callback`,
      code_verifier: attempt.verifier,
    }),
  })
  const tokenPayload = await tokenResponse.json() as { access_token?: string; error_description?: string }
  if (!tokenResponse.ok || tokenPayload.access_token === undefined) throw new HttpError(502, tokenPayload.error_description ?? 'GitHub token exchange failed.')
  const profileResponse = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${tokenPayload.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'dsh-community', 'x-github-api-version': '2022-11-28' },
  })
  const profile = await profileResponse.json() as { id?: number; login?: string; name?: string | null; avatar_url?: string }
  if (!profileResponse.ok || profile.id === undefined || profile.login === undefined || profile.avatar_url === undefined) throw new HttpError(502, 'GitHub profile lookup failed.')
  const providerId = String(profile.id)
  const existing = await env.DB.prepare("SELECT user_id FROM identities WHERE provider='github' AND provider_id=?").bind(providerId).first<{ user_id: string }>()
  const userId = existing?.user_id ?? crypto.randomUUID()
  const now = Date.now()
  const displayName = profile.name?.trim() || profile.login
  if (existing === null) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,display_name,avatar_url,created_at,updated_at) VALUES(?,?,?,?,?)').bind(userId, displayName, profile.avatar_url, now, now),
      env.DB.prepare("INSERT INTO identities(id,user_id,provider,provider_id,provider_login,login_key,created_at,updated_at) VALUES(?,?,'github',?,?,?,?,?)")
        .bind(crypto.randomUUID(), userId, providerId, profile.login, profile.login.toLowerCase(), now, now),
    ])
  } else {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET display_name=?,avatar_url=?,updated_at=? WHERE id=?').bind(displayName, profile.avatar_url, now, userId),
      env.DB.prepare("UPDATE identities SET provider_login=?,login_key=?,updated_at=? WHERE provider='github' AND provider_id=?").bind(profile.login, profile.login.toLowerCase(), now, providerId),
    ])
  }
  const sessionToken = randomToken()
  await env.DB.prepare('INSERT INTO web_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(await sha256(sessionToken), userId, now + SESSION_SECONDS * 1000, now).run()
  return oauthRedirect(attempt.return_to, sessionToken)
}

async function createDeviceLink(request: Request, env: Env): Promise<Response> {
  const payload = await body<{ installationId?: string }>(request)
  if (payload.installationId === undefined || !/^[0-9a-f-]{36}$/iu.test(payload.installationId)) throw new HttpError(400, 'installationId must be a random UUID.')
  const deviceCode = randomToken(36)
  const userCode = `${randomToken(5).slice(0, 4)}-${randomToken(5).slice(0, 4)}`.toUpperCase()
  const expiresAt = Date.now() + 10 * 60 * 1000
  await env.DB.batch([
    env.DB.prepare('DELETE FROM device_links WHERE expires_at<=?').bind(Date.now()),
    env.DB.prepare(`INSERT INTO device_links(id,device_code_hash,user_code,installation_id_hash,status,expires_at,created_at) VALUES(?,?,?,?, 'pending',?,?)`)
      .bind(crypto.randomUUID(), await sha256(deviceCode), userCode, await sha256(payload.installationId), expiresAt, Date.now()),
  ])
  return json({ deviceCode, userCode, verificationUri: `${env.BASE_URL}/link?code=${encodeURIComponent(userCode)}`, expiresAt }, 201)
}

async function approveDeviceLink(request: Request, env: Env): Promise<Response> {
  if (!assertSameOrigin(request, env)) throw new HttpError(403, 'Invalid request origin.')
  const current = await requireViewer(request, env)
  const payload = await body<{ userCode?: string }>(request)
  const userCode = payload.userCode?.trim().toUpperCase()
  if (userCode === undefined) throw new HttpError(400, 'A device code is required.')
  const link = await env.DB.prepare('SELECT id,status,expires_at FROM device_links WHERE user_code=?').bind(userCode).first<{ id: string; status: string; expires_at: number }>()
  if (link === null || link.expires_at <= Date.now()) throw new HttpError(404, 'This device code is invalid or expired.')
  if (link.status === 'approved') return json({ approved: true })
  const credential = randomToken(48)
  await env.DB.prepare("UPDATE device_links SET user_id=?,credential_ciphertext=?,status='approved',approved_at=? WHERE id=? AND status='pending'")
    .bind(current.userId, await sealSecret(credential, env.SESSION_SECRET), Date.now(), link.id).run()
  return json({ approved: true })
}

async function pollDeviceLink(request: Request, env: Env): Promise<Response> {
  const payload = await body<{ deviceCode?: string }>(request)
  if (payload.deviceCode === undefined) throw new HttpError(400, 'deviceCode is required.')
  const link = await env.DB.prepare(`
    SELECT id,user_id,installation_id_hash,credential_ciphertext,status,expires_at
    FROM device_links WHERE device_code_hash=?
  `).bind(await sha256(payload.deviceCode)).first<{
    id: string; user_id: string | null; installation_id_hash: string; credential_ciphertext: string | null; status: string; expires_at: number
  }>()
  if (link === null || link.expires_at <= Date.now()) return json({ status: 'expired' })
  if (link.status !== 'approved' || link.user_id === null || link.credential_ciphertext === null) return json({ status: 'pending' })
  const credential = await openSecret(link.credential_ciphertext, env.SESSION_SECRET)
  const credentialHash = await sha256(credential)
  const now = Date.now()
  const existing = await env.DB.prepare('SELECT id FROM devices WHERE user_id=? AND installation_id_hash=?').bind(link.user_id, link.installation_id_hash).first<{ id: string }>()
  const deviceId = existing?.id ?? crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO devices(id,user_id,installation_id_hash,credential_hash,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,installation_id_hash) DO UPDATE SET credential_hash=excluded.credential_hash,updated_at=excluded.updated_at
  `).bind(deviceId, link.user_id, link.installation_id_hash, credentialHash, now, now).run()
  const identity = await env.DB.prepare(`SELECT u.display_name,u.avatar_url,i.provider_login FROM users u JOIN identities i ON i.user_id=u.id AND i.provider='github' WHERE u.id=?`)
    .bind(link.user_id).first<{ display_name: string; avatar_url: string; provider_login: string }>()
  if (identity === null) throw new HttpError(500, 'Linked identity is unavailable.')
  return json({ status: 'approved', deviceCredential: credential, identity: {
    githubLogin: identity.provider_login,
    displayName: identity.display_name,
    avatarUrl: identity.avatar_url,
    profileUrl: `${env.BASE_URL}/u/${encodeURIComponent(identity.provider_login)}`,
  } })
}

async function authenticatedDevice(request: Request, env: Env): Promise<{ id: string; userId: string; revision: number; digest: string | null }> {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ') !== true) throw new HttpError(401, 'A device credential is required.')
  const row = await env.DB.prepare('SELECT id,user_id,accepted_revision,snapshot_digest FROM devices WHERE credential_hash=?')
    .bind(await sha256(authorization.slice(7))).first<{ id: string; user_id: string; accepted_revision: number; snapshot_digest: string | null }>()
  if (row === null) throw new HttpError(401, 'The device credential is invalid.')
  return { id: row.id, userId: row.user_id, revision: row.accepted_revision, digest: row.snapshot_digest }
}

async function acceptSnapshot(request: Request, env: Env): Promise<Response> {
  const device = await authenticatedDevice(request, env)
  const parsed = snapshotSchema.safeParse(await body(request))
  if (!parsed.success) throw new HttpError(400, 'Snapshot does not match protocolVersion 1.')
  const snapshot = parsed.data
  const earliestDay = '2020-01-01'
  const latestDay = dayString(startOfUtcDay() + DAY_MS)
  if (snapshot.dailyUsage.some(row => row.day < earliestDay || row.day > latestDay)) throw new HttpError(400, 'Snapshot contains a day outside the accepted UTC range.')
  const pairs = new Set(snapshot.modelUsage.map(row => `${row.provider}/${row.model}`))
  if ([...pairs].some(pair => !PUBLIC_MODELS.has(pair))) throw new HttpError(400, 'Snapshot contains a model outside taxonomyVersion 1.')
  if (new Set(snapshot.dailyUsage.map(row => row.day)).size !== snapshot.dailyUsage.length || pairs.size !== snapshot.modelUsage.length) {
    throw new HttpError(400, 'Snapshot contains duplicate aggregate keys.')
  }
  const { snapshotDigest: _digest, ...digestBody } = snapshot
  const computed = await sha256(canonicalJson(digestBody))
  if (computed !== snapshot.snapshotDigest) throw new HttpError(400, 'snapshotDigest does not match the request body.')
  const revisionDecision = snapshotRevisionDecision(device.revision, device.digest, snapshot.revision, snapshot.snapshotDigest)
  if (revisionDecision === 'stale') throw new HttpError(409, 'Snapshot revision is older than the accepted revision.')
  if (revisionDecision === 'conflict') throw new HttpError(409, 'This revision was already accepted with a different digest.')
  if (revisionDecision === 'idempotent') return json({ accepted: true, idempotent: true, revision: device.revision })
  const now = Date.now()
  const statements: D1PreparedStatement[] = []
  for (const row of snapshot.dailyUsage) statements.push(env.DB.prepare(`
    INSERT INTO daily_usage(device_id,day,requests,usage_unavailable_requests,uncached_input_tokens,cache_read_tokens,cache_write_tokens,output_tokens,revision,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(device_id,day) DO UPDATE SET
      requests=excluded.requests,usage_unavailable_requests=excluded.usage_unavailable_requests,
      uncached_input_tokens=excluded.uncached_input_tokens,cache_read_tokens=excluded.cache_read_tokens,
      cache_write_tokens=excluded.cache_write_tokens,output_tokens=excluded.output_tokens,revision=excluded.revision,updated_at=excluded.updated_at
      WHERE excluded.revision>daily_usage.revision
  `).bind(device.id, row.day, row.requests, row.usageUnavailableRequests, row.uncachedInputTokens, row.cacheReadTokens, row.cacheWriteTokens, row.outputTokens, snapshot.revision, now))
  for (const row of snapshot.modelUsage) statements.push(env.DB.prepare(`
    INSERT INTO model_usage(device_id,provider,model,requests,usage_unavailable_requests,uncached_input_tokens,cache_read_tokens,cache_write_tokens,output_tokens,revision,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(device_id,provider,model) DO UPDATE SET
      requests=excluded.requests,usage_unavailable_requests=excluded.usage_unavailable_requests,
      uncached_input_tokens=excluded.uncached_input_tokens,cache_read_tokens=excluded.cache_read_tokens,
      cache_write_tokens=excluded.cache_write_tokens,output_tokens=excluded.output_tokens,revision=excluded.revision,updated_at=excluded.updated_at
      WHERE excluded.revision>model_usage.revision
  `).bind(device.id, row.provider, row.model, row.requests, row.usageUnavailableRequests, row.uncachedInputTokens, row.cacheReadTokens, row.cacheWriteTokens, row.outputTokens, snapshot.revision, now))
  statements.push(env.DB.prepare('UPDATE devices SET accepted_revision=?,snapshot_digest=?,last_synced_at=?,updated_at=? WHERE id=? AND accepted_revision<?')
    .bind(snapshot.revision, snapshot.snapshotDigest, now, now, device.id, snapshot.revision))
  const nonzero = [...snapshot.dailyUsage, ...snapshot.modelUsage].some(row => row.requests > 0 || row.uncachedInputTokens + row.cacheReadTokens + row.cacheWriteTokens + row.outputTokens > 0)
  if (nonzero) statements.push(env.DB.prepare('UPDATE users SET profile_public=1,updated_at=? WHERE id=?').bind(now, device.userId))
  await env.DB.batch(statements)
  const accepted = await env.DB.prepare('SELECT accepted_revision,snapshot_digest FROM devices WHERE id=?').bind(device.id).first<{ accepted_revision: number; snapshot_digest: string | null }>()
  if (accepted?.accepted_revision !== snapshot.revision || accepted.snapshot_digest !== snapshot.snapshotDigest) {
    throw new HttpError(409, 'A newer snapshot won the revision race; refresh and retry with a new revision.')
  }
  return json({ accepted: true, idempotent: false, revision: snapshot.revision })
}

async function me(request: Request, env: Env): Promise<Response> {
  const current = await viewer(request, env)
  return json({ authenticated: current !== undefined, identity: current })
}

async function logout(request: Request, env: Env): Promise<Response> {
  if (!assertSameOrigin(request, env)) throw new HttpError(403, 'Invalid request origin.')
  const token = cookies(request).dsh_session
  if (token !== undefined) await env.DB.prepare('DELETE FROM web_sessions WHERE token_hash=?').bind(await sha256(token)).run()
  return json({ signedOut: true }, 200, { 'set-cookie': cookie('dsh_session', '', 0) })
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/api/v1/config') {
    return json({ githubAuthConfigured: env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined })
  }
  if (request.method === 'GET' && url.pathname === '/auth/github/start') return await oauthStart(request, env)
  if (request.method === 'GET' && url.pathname === '/auth/github/callback') return await oauthCallback(request, env)
  if (request.method === 'GET' && url.pathname === '/api/v1/leaderboard') return await leaderboard(request, env)
  if (request.method === 'GET' && url.pathname === '/api/v1/me') return await me(request, env)
  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/users/')) return await publicProfile(request, env, decodeURIComponent(url.pathname.slice('/api/v1/users/'.length)))
  if (request.method === 'POST' && url.pathname === '/api/v1/device-links') return await createDeviceLink(request, env)
  if (request.method === 'POST' && url.pathname === '/api/v1/device-links/approve') return await approveDeviceLink(request, env)
  if (request.method === 'POST' && url.pathname === '/api/v1/device-links/token') return await pollDeviceLink(request, env)
  if (request.method === 'PUT' && url.pathname === '/api/v1/snapshots') return await acceptSnapshot(request, env)
  if (request.method === 'POST' && url.pathname === '/api/v1/logout') return await logout(request, env)
  throw new HttpError(404, 'API route not found.')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters')
      return await route(request, env)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('dsh-community request failed', error instanceof Error ? error.message : 'unknown error')
      return json({ error: 'Internal server error.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
