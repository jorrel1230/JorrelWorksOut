import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { ACCOUNT_ACCESS_KEY, LOCAL_AUTH_KEY, resolveAccount, storedAccount } from './lib/accountAccess.js'
import { LOCAL_USER_ID } from './lib/model.js'
import { syncAccount } from './lib/sync.js'
import { Account } from './ui/Account.jsx'
import { ResourceEditor, ResourceList } from './ui/Resources.jsx'
import { WorkoutEditor, WorkoutList } from './ui/Workouts.jsx'
import { hasPendingWrites } from './ui/editor.js'

const navigation = [['workouts', 'Workouts'], ['runs', 'Runs'], ['exercises', 'Exercise catalog'], ['trainingPlans', 'Training plans'], ['account', 'Account / data']]

export default function App() {
  const [user, setUser] = useState(() => {
    try { return storedAccount(localStorage) }
    catch { return undefined }
  })
  const [authError, setAuthError] = useState('')
  const [path, setPath] = useState(window.location.hash.slice(2) || 'workouts')
  const [revision, setRevision] = useState(0)
  const [syncStatus, setSyncStatus] = useState('Not yet synced.')
  const currentUser = useRef(user)
  const authChange = useCallback(next => {
    currentUser.current = next
    setUser(next)
    setSyncStatus('Not yet synced for this account.')
  }, [])
  useEffect(() => {
    let active = true
    function applySession(session, error) {
      if (!active) return
      if (error) setAuthError(error.message)
      try { authChange(resolveAccount(localStorage, session)) }
      catch (err) { setAuthError(err.message); authChange(null) }
    }
    supabase.auth.getSession().then(({ data, error }) => applySession(data.session, error))
      .catch(error => applySession(null, error))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))
    function storage(event) {
      if (event.key === LOCAL_AUTH_KEY || event.key === ACCOUNT_ACCESS_KEY) {
        try { authChange(storedAccount(localStorage) || null) }
        catch (err) { setAuthError(err.message); authChange(null) }
      }
    }
    window.addEventListener('storage', storage)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('storage', storage) }
  }, [authChange])

  const userId = user?.id
  const runSync = useCallback(async () => {
    if (!userId) return
    if (!navigator.onLine) { setSyncStatus('Offline. Local changes are retained for retry.'); return }
    setSyncStatus('Syncing in the background…')
    try {
      const result = await syncAccount(supabase, userId, () => currentUser.current?.id === userId && storedAccount(localStorage)?.id === userId)
      if (currentUser.current?.id === userId) { setSyncStatus(result.message); setRevision(value => value + 1) }
    } catch (err) { if (currentUser.current?.id === userId) setSyncStatus(`Sync paused: ${err.message}`) }
  }, [userId])
  useEffect(() => {
    const start = setTimeout(runSync, 0)
    const interval = setInterval(runSync, 60_000)
    const offline = () => setSyncStatus('Offline. Local changes are retained for retry.')
    window.addEventListener('online', runSync)
    window.addEventListener('offline', offline)
    return () => { clearTimeout(start); clearInterval(interval); window.removeEventListener('online', runSync); window.removeEventListener('offline', offline) }
  }, [runSync])
  useEffect(() => {
    const hash = () => setPath(window.location.hash.slice(2) || 'workouts')
    const unload = event => {
      if (hasPendingWrites()) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('hashchange', hash)
    window.addEventListener('beforeunload', unload)
    return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('beforeunload', unload) }
  }, [])
  function saved() { setRevision(value => value + 1); void runSync() }
  const [route, id] = path.split('/')
  const props = { userId, revision, onSaved: saved }
  let page
  if (user === undefined) page = <p role="status">Opening account…</p>
  else if (!user || route === 'account') page = <Account key={userId || 'signed-out'} user={user} revision={revision} syncStatus={syncStatus} onSync={runSync} onAuthChange={authChange} />
  else if (route === 'workouts') page = id ? <WorkoutEditor {...props} id={id} /> : <WorkoutList {...props} />
  else if (['runs', 'exercises', 'trainingPlans'].includes(route)) page = id ? <ResourceEditor {...props} table={route} id={id} /> : <ResourceList {...props} table={route} />
  else page = <section><h2>Page not found</h2><p>Old screen links have been replaced. Choose a section above. Your saved data is unchanged.</p></section>
  return <div onClickCapture={event => {
    if (event.target.closest('a') && hasPendingWrites() && !window.confirm('An editor draft is still saving or could not be saved. Stay here to retry, or leave anyway?')) event.preventDefault()
  }}>
    <header><h1>JorrelWorksOut</h1><a href="#main" onClick={event => { event.preventDefault(); document.getElementById('main').focus() }}>Skip to content</a>
      <nav aria-label="Main navigation"><ul>{navigation.map(([key, title]) => <li key={key}><a href={`#/${key}`} aria-current={route === key ? 'page' : undefined}>{title}</a></li>)}</ul></nav>
      {user && <p>{userId === LOCAL_USER_ID ? 'Local mode' : `${user.email || 'Cloud account'}${user.cached ? ' (local access; sign in to authorize cloud)' : ''}`} · {navigator.onLine ? 'Online' : 'Offline'}</p>}
    </header>
    {authError && <p role="alert">Account initialization: {authError}</p>}
    <main id="main" tabIndex={-1} key={`${userId}/${path}`}>{page}</main>
  </div>
}
