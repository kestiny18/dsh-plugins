import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Period } from '../shared.js'
import { api } from './api.js'
import type { LeaderboardResponse, MeResponse } from './api.js'
import { useI18n } from './i18n.js'

const periods: Period[] = ['today', '7d', '30d', 'all']
export function compact(value:number, locale='en-US'){return new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:2}).format(value)}

export function Home({ me }: { me: MeResponse }) {
  const { zh } = useI18n()
  const locale = zh ? 'zh-CN' : 'en-US'
  const integer = new Intl.NumberFormat(locale)
  const [period,setPeriod]=useState<Period>('7d')
  const [data,setData]=useState<LeaderboardResponse>()
  const [error,setError]=useState<string>()
  useEffect(()=>{setError(undefined);void api<LeaderboardResponse>(`/api/v1/leaderboard?period=${period}`).then(setData).catch(cause=>setError(cause instanceof Error?cause.message:(zh?'无法加载排行榜':'Unable to load leaderboard')))},[period,me.authenticated,zh])
  const periodLabel=(value:Period)=>value==='today'?(zh?'今天（UTC）':'Today (UTC)'):value==='7d'?(zh?'近 7 天':'7 Days'):value==='30d'?(zh?'近 30 天':'30 Days'):(zh?'全部时间':'All Time')
  return <div className="pageStack">
    <section className="hero"><span className="kicker">{zh?'公开构建信号':'PUBLIC BUILD SIGNALS'}</span><h1>{zh?<>看看 DSH 社区如何<em>使用 AI 构建</em></>:<>See how the DSH community <em>builds with AI</em></>}</h1><p>{zh?'来自 DSH 用户的真实聚合 Token 用量。自愿加入、感知 fork/seed、由用户自报。':'Real aggregate token usage from DSH users. Opt-in, replay-aware, and self-reported.'}</p><a className="heroCta" href="#join">{zh?'加入 Community ↓':'Join the Community ↓'}</a></section>
    <section className="statsGrid" aria-label={zh?'社区汇总':'Community totals'}>
      <Stat label={zh?'今天（UTC）':'Today (UTC)'} value={data?.summary.today} locale={locale}/><Stat label={zh?'近 7 天':'7 Days'} value={data?.summary.sevenDays} locale={locale}/><Stat label={zh?'近 30 天':'30 Days'} value={data?.summary.thirtyDays} locale={locale}/><Stat label={zh?'全部时间':'All Time'} value={data?.summary.allTime} locale={locale}/><Stat label={zh?'参与者':'Participants'} value={data?.summary.participants} plain locale={locale}/>
    </section>
    {me.authenticated ? <section className="standingCard"><div><span className="kicker">{zh?'你的排名':'YOUR STANDING'} · {periodLabel(period).toUpperCase()}</span>{data?.yourStanding===undefined?<strong>{zh?'此时段尚未上榜':'Not ranked in this window yet'}</strong>:<strong>#{data.yourStanding.rank} · {compact(data.yourStanding.totalTokens,locale)} tokens</strong>}</div><span>{data?.yourStanding===undefined?(zh?'在 DSH Usage 中开启 Community 同步即可上榜。':'Enable Community Sync in DSH Usage to appear here.'):`${integer.format(data.yourStanding.requests)} ${zh?'次请求':'requests'}`}</span></section>:null}
    <section className="leaderboardCard">
      <div className="tableToolbar"><div className="periodTabs">{periods.map(value=><button className={period===value?'active':''} key={value} onClick={()=>setPeriod(value)}>{periodLabel(value)}</button>)}</div><span>{data===undefined?(zh?'加载中…':'Loading…'):`${zh?'更新于':'Updated'} ${new Date(data.generatedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC`}</span></div>
      {error !== undefined
        ? <div className="stateMessage error">{error}</div>
        : data?.rows.length === 0
          ? <div className="stateMessage"><strong>{zh?'还没有排行数据。':'No rankings yet.'}</strong><span>{zh?'第一次成功的非零同步会启动排行榜。':'The first successful non-zero sync will start the board.'}</span></div>
          : <Leaderboard rows={data?.rows ?? []} zh={zh} locale={locale}/>}</section>
    <section className="joinGuide" id="join"><div className="guideHeading"><span className="kicker">{zh?'加入 COMMUNITY':'JOIN THE COMMUNITY'}</span><h2>{zh?'三步，让你的 Usage 出现在这里':'Three steps from local Usage to the leaderboard'}</h2><p>{zh?'登录不会自动上传；只有你明确开启同步后，聚合数据才会发送。':'Signing in never starts an upload. Aggregate data is sent only after you explicitly enable sync.'}</p></div><div className="guideSteps">
      <article><span>01</span><h3>{zh?'安装或升级插件':'Install or upgrade'}</h3><p>{zh?'在运行 DSH 的终端执行下面命令，然后重启 DSH。':'Run this in the terminal that owns your DSH profile, then restart DSH.'}</p><code>npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.7.0 -- dsh plugin --profile web add dsh-usage</code></article>
      <article><span>02</span><h3>{zh?'连接 GitHub':'Connect GitHub'}</h3><p>{zh?'打开 DSH 的「设置 → Usage → DSH Community」，点击“连接 GitHub”。':'Open Settings → Usage → DSH Community and choose “Connect GitHub”.'}</p><a href="https://github.com/kestiny18/dsh-plugins/tree/main/dsh-usage">{zh?'查看插件说明 ↗':'Read plugin guide ↗'}</a></article>
      <article><span>03</span><h3>{zh?'明确开启同步':'Explicitly enable sync'}</h3><p>{zh?'打开 Community 同步开关。首次上传历史聚合快照，之后每 30 分钟刷新。':'Turn on Community Sync. The first aggregate snapshot includes local history, then refreshes every 30 minutes.'}</p><Link to="/privacy">{zh?'查看上传范围 →':'See exactly what is uploaded →'}</Link></article>
    </div></section>
  </div>
}

function Stat({label,value,plain=false,locale}:{label:string;value:number|undefined;plain?:boolean;locale:string}){return <div className="statCard"><span>{label}</span><strong>{value===undefined?'—':plain?new Intl.NumberFormat(locale).format(value):compact(value,locale)}</strong></div>}
function Leaderboard({rows,zh,locale}:{rows:LeaderboardResponse['rows'];zh:boolean;locale:string}){const integer=new Intl.NumberFormat(locale);return <div className="tableScroll"><table><thead><tr><th>#</th><th>{zh?'用户':'User'}</th><th>{zh?'总 Token':'Total tokens'}</th><th>{zh?'非缓存输入':'Uncached input'}</th><th>{zh?'缓存读取':'Cache read'}</th><th>{zh?'缓存写入':'Cache write'}</th><th>{zh?'输出':'Output'}</th><th>{zh?'请求数':'Requests'}</th></tr></thead><tbody>{rows.map(row=><tr key={row.githubLogin} className={row.isViewer?'viewerRow':''}><td><span className={`rank rank${Math.min(row.rank,4)}`}>{row.rank}</span></td><td><Link className="userCell" to={row.profileUrl}><img src={row.avatarUrl} alt=""/><span>{row.githubLogin}</span>{row.isViewer?<small>{zh?'你':'You'}</small>:null}</Link><details className="mobileBreakdown"><summary>{zh?'详情':'Details'}</summary><div><span>{zh?'输入':'Input'} {compact(row.uncachedInputTokens,locale)}</span><span>{zh?'缓存':'Cache'} {compact(row.cacheReadTokens+row.cacheWriteTokens,locale)}</span><span>{zh?'输出':'Output'} {compact(row.outputTokens,locale)}</span><span>{integer.format(row.requests)} {zh?'次请求':'requests'}</span></div></details></td><td>{compact(row.totalTokens,locale)}</td><td>{compact(row.uncachedInputTokens,locale)}</td><td>{compact(row.cacheReadTokens,locale)}</td><td>{compact(row.cacheWriteTokens,locale)}</td><td>{compact(row.outputTokens,locale)}</td><td>{integer.format(row.requests)}</td></tr>)}</tbody></table></div>}
