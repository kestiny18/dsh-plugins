import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { CommunityResult } from '../community/types.js'
import type { CommunityStatus } from '../community/types.js'
import type { CommunityClientContext } from '../community/remote.js'
import css from './CommunitySettings.module.css'

export function CommunitySettings({ ctx }: { ctx: CommunityClientContext }) {
  const [status, setStatus] = useState<CommunityStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const call = useCallback(async (
    operation: () => Promise<RemoteResult<CommunityResult<CommunityStatus>>>,
  ): Promise<CommunityResult<CommunityStatus> | undefined> => {
    setBusy(true)
    try {
      const remote = await operation()
      if (!remote.ok) {
        setError(remote.error.message)
        return undefined
      }
      const result = remote.value
      if (result.value !== undefined) setStatus(result.value)
      setError(result.ok ? undefined : result.error ?? 'Community request failed.')
      return result
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Community request failed.')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void call(() => ctx.remote.communityUsage.status({})) }, [call, ctx])

  useEffect(() => {
    if (status?.link === undefined) return
    const timer = window.setInterval(() => {
      void call(() => ctx.remote.communityUsage.pollLink({}))
    }, 3_000)
    return () => { window.clearInterval(timer) }
  }, [call, ctx, status?.link])

  const connect = async () => {
    const result = await call(() => ctx.remote.communityUsage.startLink({}))
    const uri = result?.value?.link?.verificationUri
    if (uri !== undefined) window.open(uri, '_blank', 'noopener,noreferrer')
  }

  const lastSync = status?.lastSyncedAt === undefined
    ? 'Never synced'
    : `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`

  return (
    <section className={css.card} aria-labelledby="dsh-community-title">
      <div className={css.heading}>
        <div>
          <span className={css.eyebrow}>OPTIONAL</span>
          <h3 id="dsh-community-title">DSH Community</h3>
          <p>Share aggregate token totals for public rankings. Local Usage always works independently.</p>
        </div>
        <span className={status?.joined ? css.connected : css.private}>{status?.joined ? 'Connected' : 'Private'}</span>
      </div>

      {status?.identity === undefined
        ? (
          <div className={css.joinRow}>
            <div>
              <strong>Join with GitHub</strong>
              <span>Your GitHub identity is linked separately from uploading data.</span>
            </div>
            <button type="button" disabled={busy || status?.configured === false} onClick={() => { void connect() }}>
              Connect GitHub
            </button>
          </div>
        )
        : (
          <div className={css.identity}>
            <img src={status.identity.avatarUrl} alt="" />
            <span><strong>{status.identity.displayName}</strong><small>@{status.identity.githubLogin}</small></span>
            <a href={status.identity.profileUrl} target="_blank" rel="noreferrer">View profile</a>
          </div>
        )}

      {status?.link !== undefined
        ? <p className={css.code}>Browser not open? Visit the Community and enter <strong>{status.link.userCode}</strong>.</p>
        : null}
      {status?.configured === false
        ? <p className={css.error}>Set <code>communityUrl</code> in the dsh-usage plugin config after deploying the Community app.</p>
        : null}

      <div className={css.syncRow}>
        <div>
          <strong>Community Sync</strong>
          <span>{lastSync} · Absolute aggregate snapshots every 30 minutes</span>
        </div>
        <label className={css.switch}>
          <input
            type="checkbox"
            checked={status?.syncEnabled ?? false}
            disabled={busy || !status?.joined}
            onChange={(event) => {
              void call(() => ctx.remote.communityUsage.setSync({ enabled: event.target.checked }))
            }}
          />
          <span aria-hidden />
          <span className={css.srOnly}>Enable Community Sync</span>
        </label>
      </div>

      {status?.syncEnabled
        ? <button className={css.syncButton} type="button" disabled={busy} onClick={() => { void call(() => ctx.remote.communityUsage.syncNow({})) }}>
            {busy || status.syncInProgress ? 'Syncing…' : 'Sync now'}
          </button>
        : null}
      {error !== undefined || status?.lastError !== undefined
        ? <p className={css.error} role="alert">{error ?? status?.lastError}</p>
        : null}
      <p className={css.privacy}>No prompts, messages, paths, hostnames, cost, or raw private model names are uploaded.</p>
    </section>
  )
}
