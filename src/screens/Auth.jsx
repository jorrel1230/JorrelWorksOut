import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const redirectTo = window.location.origin + import.meta.env.BASE_URL

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-inner">
        <div className="auth-header">
          <span className="auth-logo">5×5</span>
          <p className="auth-subtitle">Stronglifts 5x5 Tracker</p>
        </div>

        {sent ? (
          <div className="auth-sent">
            <p className="auth-sent-title">Check your email</p>
            <p className="auth-sent-body">
              We sent a magic link to <strong>{email}</strong>. Tap it to sign in.
            </p>
            <button className="btn-ghost" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
