import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api.js'
import type { MeResponse } from './api.js'
import type { PublicConfig } from './api.js'
import { Home } from './Home.js'
import { Profile } from './Profile.js'
import { LinkDevice } from './LinkDevice.js'
import { About, Privacy } from './StaticPages.js'

export function App() {
  const [me, setMe] = useState<MeResponse>({ authenticated: false })
  const [configuration, setConfiguration] = useState<PublicConfig>({ githubAuthConfigured: false })
  const location = useLocation()
  useEffect(() => { void api<MeResponse>('/api/v1/me').then(setMe).catch(() => setMe({ authenticated: false })) }, [location.key])
  useEffect(() => { void api<PublicConfig>('/api/v1/config').then(setConfiguration) }, [])

  const signOut = async () => {
    await api('/api/v1/logout', { method: 'POST', body: '{}' })
    setMe({ authenticated: false })
    window.location.assign('/')
  }

  return <div className="appShell">
    <header className="siteHeader"><div className="headerInner">
      <Link className="brand" to="/"><img src="/logo.svg" alt=""/><strong>DSH Community</strong><span>BETA</span></Link>
      <nav><NavLink to="/">Leaderboard</NavLink><NavLink to="/about">About</NavLink></nav>
      {me.authenticated && me.identity !== undefined
        ? <div className="account"><Link to={`/u/${me.identity.githubLogin}`}><img src={me.identity.avatarUrl} alt=""/><span>@{me.identity.githubLogin}</span></Link><button onClick={() => { void signOut() }}>Sign out</button></div>
        : configuration.githubAuthConfigured
          ? <a className="githubButton" href={`/auth/github/start?returnTo=${encodeURIComponent(location.pathname + location.search)}`}><GithubIcon/>Sign in with GitHub</a>
          : <span className="githubButton pending" title="GitHub OAuth credentials have not been configured"><GithubIcon/>GitHub setup pending</span>}
    </div></header>
    <main><Routes>
      <Route path="/" element={<Home me={me}/>} />
      <Route path="/u/:login" element={<Profile/>} />
      <Route path="/link" element={<LinkDevice me={me}/>} />
      <Route path="/about" element={<About/>} />
      <Route path="/privacy" element={<Privacy/>} />
      <Route path="*" element={<section className="staticPage"><span className="kicker">404</span><h1>That page is off the map.</h1><Link className="primaryButton" to="/">Back to leaderboard</Link></section>} />
    </Routes></main>
    <footer><div><span>DSH Community · self-reported aggregate usage</span><nav><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><a href="https://github.com/kestiny18/dsh-plugins">GitHub</a></nav></div></footer>
  </div>
}

function GithubIcon(){return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.2 1.2A11 11 0 0 1 12 6.4c1 0 2 .1 2.9.4 2.2-1.5 3.2-1.2 3.2-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.5 5.7.4.4.8 1.1.8 2.2v2.8c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .7Z"/></svg>}
