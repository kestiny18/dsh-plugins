import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { CommunityResult, CommunityStatus } from '../community/types.js'
import type { CommunityClientContext } from '../community/remote.js'
import css from './CommunitySettings.module.css'

const COMMUNITY_URL = 'https://dshcommunity.com'

const copy = {
  zh: {
    optional: '可选功能', title: 'DSH Community', intro: '分享聚合 Token 总量，参与公开排行。本地 Usage 始终独立可用。',
    openSite: '访问 dshcommunity.com ↗', checking: '检查中', unavailable: '暂不可用', connected: '已连接', private: '未加入',
    serviceUnavailable: 'Community 本地服务暂不可用', serviceHint: '请确认插件已正确安装并重启 DSH；本地 Usage 数据不受影响。', retry: '重试',
    join: '使用 GitHub 加入', joinHint: 'GitHub 身份绑定与数据上传是两个独立步骤。', connect: '连接 GitHub',
    browserHint: '浏览器没有自动打开？访问 Community 并输入', configHint: '部署 Community 后，请在 dsh-usage 插件配置中设置 communityUrl。',
    sync: 'Community 同步', never: '从未同步', last: '上次同步', cadence: '每 30 分钟上传绝对聚合快照', enable: '开启 Community 同步',
    syncing: '同步中…', syncNow: '立即同步', profile: '查看主页', signOut: '退出登录', signOutHint: '仅断开当前 DSH，不删除账号或已上传数据。', privacy: '不会上传提示词、消息、路径、主机名、费用或未归一化的私有模型名称。', failed: 'Community 请求失败。',
  },
  en: {
    optional: 'OPTIONAL', title: 'DSH Community', intro: 'Share aggregate token totals for public rankings. Local Usage always works independently.',
    openSite: 'Visit dshcommunity.com ↗', checking: 'Checking', unavailable: 'Unavailable', connected: 'Connected', private: 'Private',
    serviceUnavailable: 'Local Community service is unavailable', serviceHint: 'Check that the plugin is installed and restart DSH. Local Usage data is unaffected.', retry: 'Retry',
    join: 'Join with GitHub', joinHint: 'Your GitHub identity is linked separately from uploading data.', connect: 'Connect GitHub',
    browserHint: 'Browser not open? Visit the Community and enter', configHint: 'Set communityUrl in the dsh-usage plugin config after deploying the Community app.',
    sync: 'Community Sync', never: 'Never synced', last: 'Last synced', cadence: 'Absolute aggregate snapshots every 30 minutes', enable: 'Enable Community Sync',
    syncing: 'Syncing…', syncNow: 'Sync now', profile: 'View profile', signOut: 'Sign out', signOutHint: 'Disconnects this DSH only. Your account and uploaded data remain.', privacy: 'No prompts, messages, paths, hostnames, cost, or raw private model names are uploaded.', failed: 'Community request failed.',
  },
} as const

function currentLanguage(): keyof typeof copy {
  const language = document.documentElement.lang || navigator.language
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function useCopy() {
  const [language, setLanguage] = useState(currentLanguage)
  useEffect(() => {
    const observer = new MutationObserver(() => { setLanguage(currentLanguage()) })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => { observer.disconnect() }
  }, [])
  return copy[language]
}

export function CommunitySettings({ ctx }: { ctx: CommunityClientContext }) {
  const t = useCopy()
  const [status, setStatus] = useState<CommunityStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const call = useCallback(async (
    operation: () => Promise<RemoteResult<CommunityResult<CommunityStatus>>>,
  ): Promise<CommunityResult<CommunityStatus> | undefined> => {
    setBusy(true)
    setError(undefined)
    try {
      const remote = await operation()
      if (!remote.ok) {
        setError(remote.error.message)
        return undefined
      }
      const result = remote.value
      if (result.value !== undefined) setStatus(result.value)
      setError(result.ok ? undefined : result.error ?? t.failed)
      return result
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failed)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [t.failed])

  const refresh = useCallback(() => call(() => ctx.remote.communityUsage.status({})), [call, ctx])
  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (status?.link === undefined) return
    const timer = window.setInterval(() => { void call(() => ctx.remote.communityUsage.pollLink({})) }, 3_000)
    return () => { window.clearInterval(timer) }
  }, [call, ctx, status?.link])

  const connect = async () => {
    const result = await call(() => ctx.remote.communityUsage.startLink({}))
    const uri = result?.value?.link?.verificationUri
    if (uri !== undefined) window.open(uri, '_blank', 'noopener,noreferrer')
  }

  const lastSync = status?.lastSyncedAt === undefined ? t.never : `${t.last} ${new Date(status.lastSyncedAt).toLocaleString()}`
  const unavailable = status === undefined && error !== undefined
  const badge = busy && status === undefined ? t.checking : unavailable ? t.unavailable : status?.joined ? t.connected : t.private
  const badgeClass = unavailable ? css.unavailable : status?.joined ? css.connected : css.private

  return <section className={css.card} aria-labelledby="dsh-community-title">
    <div className={css.heading}><div><span className={css.eyebrow}>{t.optional}</span><h3 id="dsh-community-title">{t.title}</h3><p>{t.intro}</p><a className={css.siteLink} href={COMMUNITY_URL} target="_blank" rel="noreferrer">{t.openSite}</a></div><span className={badgeClass}>{badge}</span></div>
    {unavailable
      ? <div className={css.unavailableRow} role="alert"><div><strong>{t.serviceUnavailable}</strong><span>{t.serviceHint}</span><small>{error}</small></div><button type="button" disabled={busy} onClick={() => { void refresh() }}>{t.retry}</button></div>
      : <>
        {status?.identity === undefined
          ? <div className={css.joinRow}><div><strong>{t.join}</strong><span>{t.joinHint}</span></div><button type="button" disabled={busy || status === undefined || status.configured === false} onClick={() => { void connect() }}>{t.connect}</button></div>
          : <div className={css.identity}><img src={status.identity.avatarUrl} alt=""/><span><strong>{status.identity.displayName}</strong><small>@{status.identity.githubLogin}</small></span><div className={css.identityActions}><a href={status.identity.profileUrl} target="_blank" rel="noreferrer">{t.profile}</a><button type="button" title={t.signOutHint} disabled={busy} onClick={() => { void call(() => ctx.remote.communityUsage.signOut({})) }}>{t.signOut}</button></div></div>}
        {status?.link !== undefined ? <p className={css.code}>{t.browserHint} <strong>{status.link.userCode}</strong>.</p> : null}
        {status?.configured === false ? <p className={css.error}>{t.configHint}</p> : null}
        <div className={css.syncRow}><div><strong>{t.sync}</strong><span>{lastSync} · {t.cadence}</span></div><label className={css.switch}><input type="checkbox" checked={status?.syncEnabled ?? false} disabled={busy || !status?.joined} onChange={(event) => { void call(() => ctx.remote.communityUsage.setSync({ enabled: event.target.checked })) }}/><span aria-hidden/><span className={css.srOnly}>{t.enable}</span></label></div>
        {status?.syncEnabled ? <button className={css.syncButton} type="button" disabled={busy} onClick={() => { void call(() => ctx.remote.communityUsage.syncNow({})) }}>{busy || status.syncInProgress ? t.syncing : t.syncNow}</button> : null}
        {error !== undefined || status?.lastError !== undefined ? <p className={css.error} role="alert">{error ?? status?.lastError}</p> : null}
      </>}
    <p className={css.privacy}>{t.privacy}</p>
  </section>
}
