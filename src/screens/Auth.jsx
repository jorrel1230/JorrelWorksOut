import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSendCode(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({ email })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('code')
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    setLoading(false)
    if (error) setError(error.message)
    // On success, onAuthStateChange in useAuth fires and App.jsx redirects
  }

  function handleBack() {
    setStep('email')
    setCode('')
    setError(null)
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-inner">
        <div className="auth-header">
          <span className="auth-logo">5×5</span>
          <p className="auth-subtitle">Stronglifts 5x5 Tracker</p>
        </div>

        {step === 'email' ? (
          <form className="auth-form" onSubmit={handleSendCode}>
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
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <div className="auth-sent">
            <p className="auth-sent-title">Check your email</p>
            <p className="auth-sent-body">
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
                className="auth-code-input"
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying…' : 'Sign in'}
              </button>
            </form>
            <button className="btn-ghost" onClick={handleBack}>
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
