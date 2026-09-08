import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

const DEFAULTS = [
  { name: 'Bench Press', weight_lbs: 135, sets_required: 3, target_reps: 8 },
  { name: 'Overhead Press', weight_lbs: 75, sets_required: 3, target_reps: 8 },
  { name: 'Dumbbell Shoulder Press', weight_lbs: 25, sets_required: 3, target_reps: 10 },
  { name: 'Triceps Pushdown', weight_lbs: 35, sets_required: 3, target_reps: 10 },
  { name: 'Barbell Row', weight_lbs: 115, sets_required: 3, target_reps: 8 },
  { name: 'Lat Pulldown', weight_lbs: 100, sets_required: 3, target_reps: 10 },
  { name: 'Pullups', weight_lbs: 136, sets_required: 3, target_reps: 6 },
  { name: 'Squat', weight_lbs: 140, sets_required: 3, target_reps: 8 },
  { name: 'Deadlift', weight_lbs: 215, sets_required: 3, target_reps: 6 },
  { name: 'Leg Curl', weight_lbs: 100, sets_required: 3, target_reps: 10 },
  { name: 'Leg Extension', weight_lbs: 100, sets_required: 3, target_reps: 10 },
  { name: 'Hip Abductor', weight_lbs: 87.5, sets_required: 3, target_reps: 12 },
]

export default function Onboarding({ onComplete }) {
  const [weights, setWeights] = useState(
    Object.fromEntries(DEFAULTS.map(e => [e.name, String(e.weight_lbs)]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleWeight(name, value) {
    setWeights(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date().toISOString()

      const exercises = DEFAULTS.map(ex => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        name: ex.name,
        weight_lbs: parseFloat(weights[ex.name]) || ex.weight_lbs,
        sets_required: ex.sets_required,
        target_reps: ex.target_reps,
        failure_streak: 0,
        updated_at: now,
      }))

      await db.exercises.bulkPut(exercises)

      // best-effort push to Supabase; if offline, sync runs later
      try {
        await supabase.from('exercises').upsert(exercises)
      } catch (error) {
        console.warn('Supabase onboarding seed failed', error)
      }

      onComplete()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="screen onboarding-screen">
      <div className="onboarding-inner">
        <div className="onboarding-header">
          <span className="auth-logo">JorrelWorksOut</span>
          <h1 className="onboarding-title">Set your starting weights</h1>
          <p className="onboarding-subtitle">You can change these any time</p>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          {DEFAULTS.map(ex => (
            <div className="onboarding-row" key={ex.name}>
              <div className="onboarding-lift">
                <span className="onboarding-lift-name">{ex.name}</span>
                <span className="onboarding-lift-meta">
                  {ex.sets_required}×{ex.target_reps}
                </span>
              </div>
              <div className="onboarding-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="2.5"
                  value={weights[ex.name]}
                  onChange={e => handleWeight(ex.name, e.target.value)}
                  required
                />
                <span className="onboarding-unit">lbs</span>
              </div>
            </div>
          ))}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}
