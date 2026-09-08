import { useState } from 'react'
import { enableLocalMode, supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handle(action) {
    setLoading(true)
    setError(null)

    const { error } = action === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) setError(error.message)
    // On success, onAuthStateChange in useAuth fires and App.jsx redirects
  }

  const ready = email && password

  return (
    <div className="screen auth-screen">
      <div className="auth-inner">
        <div className="auth-header">
          <span className="auth-logo">JorrelWorksOut</span>
        </div>

        <div className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary" disabled={loading || !ready} onClick={() => handle('signin')}>
            {loading ? '…' : 'Sign in'}
          </button>
          <button className="btn-ghost" disabled={loading || !ready} onClick={() => handle('signup')}>
            Create account
          </button>
          <button className="btn-ghost" disabled={loading} onClick={enableLocalMode}>
            Continue locally
          </button>
          <p className="auth-hint">
            Local mode works offline on this phone. Supabase sign-in can be added once the cloud schema is applied.
          </p>
        </div>
      </div>
    </div>
  )
}
