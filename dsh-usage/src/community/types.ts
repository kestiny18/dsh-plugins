export interface CommunityIdentity {
  githubLogin: string
  displayName: string
  avatarUrl: string
  profileUrl: string
}

export interface CommunityStatus {
  configured: boolean
  joined: boolean
  syncEnabled: boolean
  identity?: CommunityIdentity
  link?: { verificationUri: string; userCode: string; expiresAt: number }
  lastSyncedAt?: number
  lastError?: string
  syncInProgress: boolean
}

export interface CommunityResult<T> {
  ok: boolean
  value?: T
  error?: string
}

export interface CommunityEmptyRequest {}
export interface CommunitySyncRequest { enabled: boolean }
