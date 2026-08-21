import type { LeaderboardRow, Period, PublicIdentity } from '../shared.js'

export interface MeResponse { authenticated: boolean; identity?: PublicIdentity & { userId: string } }
export interface PublicConfig { githubAuthConfigured: boolean }
export interface LeaderboardResponse {
  period: Period
  generatedAt: number
  selfReported: true
  summary: { today: number; sevenDays: number; thirtyDays: number; allTime: number; participants: number }
  rows: LeaderboardRow[]
  yourStanding?: LeaderboardRow
}
export interface ProfileResponse {
  identity: { githubLogin: string; displayName: string; avatarUrl: string; githubUrl: string }
  windows: { period: Period; rank: number | null; totalTokens: number }[]
  days: Array<Record<string, string | number>>
  models: Array<Record<string, string | number>>
  selfReported: true
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }), ...init?.headers },
  })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${String(response.status)})`)
  return payload
}
