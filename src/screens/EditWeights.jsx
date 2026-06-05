import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

const ALL_LIFTS = ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Deadlift']

export default function EditWeights() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exercises, setExercises] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const exs = await db.exercises.where('user_id').equals(session.user.id).toArray()
      const ordered = ALL_LIFTS.map(name => exs.find(e => e.name === name)).filter(Boolean)
      setExercises(ordered)
      setLoading(false)
    }
    load()
  }, [])

  function setWeight(idx, val) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, weight_lbs: val } : e))
  }

  function setStreak(idx, val) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, failure_streak: val } : e))
  }

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    const updated = exercises.map(e => ({
      ...e,
      weight_lbs: parseFloat(e.weight_lbs) || e.weight_lbs,
      failure_streak: parseInt(e.failure_streak) || 0,
      updated_at: now,
    }))

    for (const ex of updated) {
      await db.exercises.update(ex.id, {
        weight_lbs: ex.weight_lbs,
        failure_streak: ex.failure_streak,
        updated_at: now,
      })
    }

    try {
      await supabase.from('exercises').upsert(updated)
    } catch (_) {}

    setSaving(false)
    navigate('/home')
  }

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">5×5</span>
      </div>
    )
  }

  return (
    <div className="screen onboarding-screen">
      <nav className="detail-nav" style={{ position: 'sticky', top: 0 }}>
        <button className="workout-nav-btn" onClick={() => navigate('/home')}>Cancel</button>
        <span className="workout-nav-title">Edit Weights</span>
        <button className="workout-nav-btn" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
      </nav>

      <div className="onboarding-inner" style={{ paddingTop: '1rem' }}>
        {exercises.map((ex, idx) => (
          <div key={ex.name} className="editweights-card">
            <div className="onboarding-row">
              <div className="onboarding-lift">
                <span className="onboarding-lift-name">{ex.name}</span>
                <span className="onboarding-lift-meta">{ex.sets_required === 1 ? '1×5' : '5×5'}</span>
              </div>
              <div className="onboarding-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="2.5"
                  value={ex.weight_lbs}
                  onChange={e => setWeight(idx, e.target.value)}
                />
                <span className="onboarding-unit">lbs</span>
              </div>
            </div>
            <div className="streak-row">
              <span className="streak-label">Failure streak</span>
              <div className="streak-btns">
                {[0, 1, 2].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`streak-btn ${ex.failure_streak === n ? 'streak-btn--active' : ''}`}
                    onClick={() => setStreak(idx, n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
