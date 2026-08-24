import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from './api.js'
import type { MeResponse } from './api.js'
import { useI18n } from './i18n.js'

export function LinkDevice({ me }: { me: MeResponse }) {
  const { zh } = useI18n()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string>()

  const approve = async () => {
    setState('busy')
    setError(undefined)
    try {
      await api('/api/v1/device-links/approve', {
        method: 'POST',
        body: JSON.stringify({ userCode: code }),
      })
      setState('done')
    } catch (cause) {
      setState('idle')
      setError(cause instanceof Error ? cause.message : (zh ? '无法连接此设备' : 'Unable to link device'))
    }
  }

  if (state === 'done') {
    return <section className="linkPage linkComplete">
      <span className="linkStatusIcon" aria-hidden>✓</span>
      <span className="kicker">{zh ? '设备连接完成' : 'DEVICE CONNECTED'}</span>
      <h1>{zh ? '当前 DSH 已连接。' : 'This DSH is connected.'}</h1>
      <p>{zh
        ? '现在可以返回 DSH。Community Sync 仍保持关闭，只有你在 Settings → Usage 中主动开启后才会上传聚合数据。'
        : 'You can return to DSH. Community Sync remains off and uploads aggregate data only after you explicitly enable it in Settings → Usage.'}</p>
      <button type="button" onClick={() => window.close()}>{zh ? '关闭此标签页' : 'Close this tab'}</button>
    </section>
  }

  const identity = me.authenticated ? me.identity : undefined
  return <section className="linkPage">
    <span className="kicker">{identity !== undefined
      ? (zh ? 'GITHUB 已验证 · 设备确认' : 'GITHUB VERIFIED · DEVICE CONFIRMATION')
      : (zh ? 'GITHUB 身份连接' : 'GITHUB IDENTITY CONNECTION')}</span>
    <h1>{identity !== undefined
      ? (zh ? '确认连接当前 DSH' : 'Confirm this DSH connection')
      : (zh ? '先用 GitHub 确认身份' : 'Verify your identity with GitHub')}</h1>
    <p>{identity !== undefined
      ? (zh
          ? 'GitHub 登录已经完成。最后确认把当前这套 DSH 安装连接到你的 Community 身份；这一步不会开启数据同步。'
          : 'GitHub sign-in is complete. One final confirmation links this DSH installation to your Community identity; it does not enable data sync.')
      : (zh
          ? 'Community 只读取你的公开 GitHub 个人资料，用来建立公开身份；登录本身不会上传任何 Usage 数据。'
          : 'Community reads only your public GitHub profile to establish your public identity. Signing in does not upload any Usage data.')}</p>

    {identity !== undefined && <div className="linkIdentity">
      <img src={identity.avatarUrl} alt="" />
      <div><strong>{identity.displayName}</strong><span>@{identity.githubLogin}</span></div>
      <span>{zh ? '已验证' : 'Verified'}</span>
    </div>}

    <label>
      <span>{zh ? '连接码 · 来自 Settings → Usage' : 'Connection code · from Settings → Usage'}</span>
      <input
        value={code}
        maxLength={9}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        onChange={event => setCode(event.target.value.toUpperCase())}
        placeholder="ABCD-EFGH"
      />
    </label>

    {identity !== undefined
      ? <button type="button" disabled={state === 'busy' || code.length < 4} onClick={() => void approve()}>
          {state === 'busy' ? (zh ? '正在连接…' : 'Connecting…') : (zh ? '确认连接当前 DSH' : 'Confirm this DSH connection')}
        </button>
      : <a className="primaryButton linkPrimary" href={`/auth/github/start?returnTo=${encodeURIComponent(`/link?code=${code}`)}`}>
          {zh ? '前往 GitHub' : 'Continue to GitHub'}
        </a>}

    <div className="linkAssurance">
      <strong>{zh ? '同步保持关闭' : 'Sync stays off'}</strong>
      <span>{zh
        ? '连接 GitHub 和上传聚合数据始终是两个独立选择。'
        : 'Connecting GitHub and uploading aggregate data remain separate choices.'}</span>
    </div>
    {error !== undefined && <p className="formError" role="alert">{error}</p>}
  </section>
}
