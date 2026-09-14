import { useEffect, useRef, useState } from 'react'
import { LOCAL_USER_ID } from '../lib/model.js'
import { exportData, listRecords } from '../lib/repository.js'
import { queueStatus, readImportBatches } from '../lib/sync.js'
import { supabase } from '../lib/supabase.js'
import { forgetAccount, rememberSession, selectLocalAccount, storedAccount } from '../lib/accountAccess.js'
import { Feedback, Field, RecordDetails } from './Fields.jsx'
import { downloadJson } from './editor.js'

export function Account({ user, syncStatus, onSync, onAuthChange, revision }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState(null)
  const [settings, setSettings] = useState([])
  const [batches, setBatches] = useState(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    let active = true
    if (user) Promise.all([queueStatus(user.id), listRecords('runSettings', user.id)]).then(([nextQueue, rows]) => {
      if (active) { setQueue(nextQueue); setSettings(rows) }
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [user, revision, syncStatus])
  async function authenticate(event) {
    event.preventDefault()
    setBusy(true); setError(''); setStatus('Contacting account service…')
    try {
      const action = event.nativeEvent.submitter?.value
      const { data, error } = action === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!active.current) return
      if (data.session) {
        onAuthChange(rememberSession(localStorage, data.session))
        setPassword('')
        setStatus('Signed in. Local account data is separate from local-mode data.')
      } else setStatus('Check your email to confirm the account, then sign in.')
    } catch (err) { setError(err.message); setStatus('Account request failed. Local records are unchanged.') }
    finally { setBusy(false) }
  }
  function localMode() {
    try { onAuthChange(selectLocalAccount(localStorage)); setStatus('Using local mode.') }
    catch (err) { setError(err.message) }
  }
  function signOut() {
    setError('')
    try {
      // Revoke app access synchronously, even if token refresh/logout cannot reach the network.
      onAuthChange(forgetAccount(localStorage))
      void supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    } catch (err) { setError(err.message) }
  }
  async function exportLocal() {
    try { downloadJson(await exportData(user.id), `jorrelworksout-${user.id}-${new Date().toISOString().slice(0, 10)}.json`); setStatus('JSON export prepared. Keep it private; it contains this account’s fitness records and drafts.') }
    catch (err) { setError(err.message) }
  }
  async function audit() {
    setError('')
    try { setBatches(await readImportBatches(supabase, user.id, () => storedAccount(localStorage)?.id === user.id)) }
    catch (err) { setError(err.message) }
  }
  return <section><h2>Account and data</h2><Feedback status={status} error={error} />
    <p>{user ? user.id === LOCAL_USER_ID ? 'Local mode — this device only.' : user.cached ? `Local access to ${user.email || user.id}. Sign in to renew cloud authorization.` : `Signed in as ${user.email || user.id}.` : 'Sign in to access your account history, or continue locally.'}</p>
    <p>Accounts are separate. Signing out immediately removes this app’s remembered identity, even offline, and never deletes IndexedDB history. Server session revocation is best-effort. Local-mode records are not automatically reassigned or uploaded when you sign in.</p>
    {(!user || user.cached || user.id === LOCAL_USER_ID) && <><form onSubmit={authenticate}><fieldset disabled={busy}><legend>Email account</legend>
      <Field label="Email" type="email" required value={email} onChange={setEmail} />
      <Field label="Password" type="password" required value={password} onChange={setPassword} />
      <button type="submit" value="signin">Sign in</button>{' '}<button type="submit" value="signup">Create account</button>
    </fieldset></form>{!user && <p><button onClick={localMode}>Continue locally</button></p>}</>}
    {user && <><p><button disabled={busy} onClick={signOut}>Sign out</button>{' '}{user.id !== LOCAL_USER_ID && <button onClick={localMode}>Switch to local mode</button>}</p>
      <h3>Local data</h3><button onClick={exportLocal}>Export this account’s local data as JSON</button>
      <p>Includes saved workouts, independent sets, legacy results, runs, catalog, plans, run settings, editor drafts and owned pending queue entries. No credentials. Export is a backup for inspection; there is no import or restore button in this version.</p>
      <h3>Sync</h3><p role="status">{syncStatus}</p>
      {queue && <p>{queue.pending} pending cloud changes for this account. {queue.unverified} old entries with unverified ownership retained on this device.</p>}
      <p>Offline saves do not wait for the cloud. Retry occurs on reconnect, after saves, and once per minute while open. Keep the app open to finish syncing. Cloud history is merged without clearing local-only records.</p>
      {user.id !== LOCAL_USER_ID && <button onClick={onSync}>Sync / retry now</button>}
      <details><summary>Preserved run settings (read-only)</summary>{settings.length ? settings.map(row => <RecordDetails key={row.id} row={row} />) : <p>No stored run settings.</p>}</details>
      {user.id !== LOCAL_USER_ID && <details><summary>Cloud import audit (read-only, requires connection)</summary><button onClick={audit}>Load import batches</button>
        {batches && (batches.length ? batches.map(row => <RecordDetails key={row.id} row={row} />) : <p>No import batches.</p>)}</details>}
    </>}
  </section>
}
