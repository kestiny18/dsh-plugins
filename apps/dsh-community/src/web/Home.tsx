import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Period } from '../shared.js'
import { api } from './api.js'
import type { LeaderboardResponse, MeResponse } from './api.js'

const periods: Array<{ value: Period; label: string }> = [{value:'today',label:'Today (UTC)'},{value:'7d',label:'7 Days'},{value:'30d',label:'30 Days'},{value:'all',label:'All Time'}]
const integer = new Intl.NumberFormat('en-US')
export function compact(value:number){return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value)}

export function Home({ me }: { me: MeResponse }) {
  const [period,setPeriod]=useState<Period>('7d')
  const [data,setData]=useState<LeaderboardResponse>()
  const [error,setError]=useState<string>()
  useEffect(()=>{setError(undefined);void api<LeaderboardResponse>(`/api/v1/leaderboard?period=${period}`).then(setData).catch(cause=>setError(cause instanceof Error?cause.message:'Unable to load leaderboard'))},[period,me.authenticated])
  return <div className="pageStack">
    <section className="hero"><span className="kicker">PUBLIC BUILD SIGNALS</span><h1>See how the DSH community <em>builds with AI</em></h1><p>Real aggregate token usage from DSH users. Opt-in, replay-aware, and self-reported.</p></section>
    <section className="statsGrid" aria-label="Community totals">
      <Stat label="Today (UTC)" value={data?.summary.today}/><Stat label="7 Days" value={data?.summary.sevenDays}/><Stat label="30 Days" value={data?.summary.thirtyDays}/><Stat label="All Time" value={data?.summary.allTime}/><Stat label="Participants" value={data?.summary.participants} plain/>
    </section>
    {me.authenticated ? <section className="standingCard"><div><span className="kicker">YOUR STANDING · {period.toUpperCase()}</span>{data?.yourStanding===undefined?<strong>Not ranked in this window yet</strong>:<strong>#{data.yourStanding.rank} · {compact(data.yourStanding.totalTokens)} tokens</strong>}</div><span>{data?.yourStanding===undefined?'Enable Community Sync in DSH Usage to appear here.':`${integer.format(data.yourStanding.requests)} requests`}</span></section>:null}
    <section className="leaderboardCard">
      <div className="tableToolbar"><div className="periodTabs">{periods.map(item=><button className={period===item.value?'active':''} key={item.value} onClick={()=>setPeriod(item.value)}>{item.label}</button>)}</div><span>{data===undefined?'Loading…':`Updated ${new Date(data.generatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC`}</span></div>
      {error !== undefined
        ? <div className="stateMessage error">{error}</div>
        : data?.rows.length === 0
          ? <div className="stateMessage"><strong>No rankings yet.</strong><span>The first successful non-zero sync will start the board.</span></div>
          : <Leaderboard rows={data?.rows ?? []}/>
      }
    </section>
  </div>
}

function Stat({label,value,plain=false}:{label:string;value:number|undefined;plain?:boolean}){return <div className="statCard"><span>{label}</span><strong>{value===undefined?'—':plain?integer.format(value):compact(value)}</strong></div>}
function Leaderboard({rows}:{rows:LeaderboardResponse['rows']}){return <div className="tableScroll"><table><thead><tr><th>#</th><th>User</th><th>Total tokens</th><th>Uncached input</th><th>Cache read</th><th>Cache write</th><th>Output</th><th>Requests</th></tr></thead><tbody>{rows.map(row=><tr key={row.githubLogin} className={row.isViewer?'viewerRow':''}><td><span className={`rank rank${Math.min(row.rank,4)}`}>{row.rank}</span></td><td><Link className="userCell" to={row.profileUrl}><img src={row.avatarUrl} alt=""/><span>{row.githubLogin}</span>{row.isViewer?<small>You</small>:null}</Link><details className="mobileBreakdown"><summary>Details</summary><div><span>Input {compact(row.uncachedInputTokens)}</span><span>Cache {compact(row.cacheReadTokens+row.cacheWriteTokens)}</span><span>Output {compact(row.outputTokens)}</span><span>{integer.format(row.requests)} requests</span></div></details></td><td>{compact(row.totalTokens)}</td><td>{compact(row.uncachedInputTokens)}</td><td>{compact(row.cacheReadTokens)}</td><td>{compact(row.cacheWriteTokens)}</td><td>{compact(row.outputTokens)}</td><td>{integer.format(row.requests)}</td></tr>)}</tbody></table></div>}
