import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { WORKOUT_LIFTS, nextWorkoutType, sortSessionsDesc } from '../lib/workout'
import Sheet from '../components/Sheet'

const TODAY = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
})
const TODAY_ISO = new Date().toISOString().split('T')[0]

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [nextType, setNextType] = useState('A')
  const [lifts, setLifts] = useState([])

  const [showLogSheet, setShowLogSheet] = useState(false)
  const [logDate, setLogDate] = useState(TODAY_ISO)
  const [logType, setLogType] = useState('A')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id

      const [exercises, allSessions] = await Promise.all([
        db.exercises.where('user_id').equals(userId).toArray(),
        db.sessions.where('user_id').equals(userId).toArray(),
      ])

      const completed = sortSessionsDesc(allSessions.filter(s => s.is_complete))

      const type = nextWorkoutType(completed[0] ?? null)
      setNextType(type)
      setLogType(type)

      const exerciseMap = Object.fromEntries(exercises.map(e => [e.name, e]))
      setLifts(WORKOUT_LIFTS[type].map(name => exerciseMap[name]).filter(Boolean))
      setLoading(false)
    }

    load()
  }, [])

  function openLogSheet() {
    setLogDate(TODAY_ISO)
    setShowLogSheet(true)
  }

  function startLoggedWorkout() {
    setShowLogSheet(false)
    navigate('/workout', { state: { prefill: { date: logDate, type: logType } } })
  }

  if (loading) {
    return (
      <div className="screen home-loading">
        <span className="splash-title">JWO</span>
      </div>
    )
  }

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <button className="workout-nav-btn" onClick={() => navigate('/dashboard')}>‹ Back</button>
        <span className="home-logo">Lift</span>
        <button className="home-settings-btn" onClick={() => navigate('/edit-weights')} aria-label="Edit weights">
          ⚙
        </button>
      </header>

      <section className="home-next">
        <p className="home-next-label">Next up</p>
        <h1 className="home-next-type">Workout {nextType}</h1>
        <p className="home-next-date">{TODAY}</p>
      </section>

      <section className="home-lifts">
        {lifts.map(ex => (
          <div className="home-lift-row" key={ex.name}>
            <span className="home-lift-name">{ex.name}</span>
            <span className="home-lift-weight">{ex.weight_lbs} lbs</span>
          </div>
        ))}
      </section>

      <div className="home-cta">
        <button className="btn-primary" onClick={() => navigate('/workout')}>
          Start Workout
        </button>
        <button className="home-log-btn" onClick={openLogSheet}>
          + Log past workout
        </button>
      </div>

      <nav className="home-nav">
        <button className="btn-ghost home-nav-btn" onClick={() => navigate('/history')}>
          History
        </button>
        <button className="btn-ghost home-nav-btn" onClick={() => navigate('/progress')}>
          Progress
        </button>
      </nav>

      {showLogSheet && (
        <Sheet title="Log Past Workout" onCancel={() => setShowLogSheet(false)}>
          <div className="log-sheet-field">
            <label className="detail-field-label">Date</label>
            <input
              type="date"
              max={TODAY_ISO}
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
            />
          </div>
          <div className="log-sheet-field">
            <label className="detail-field-label">Workout type</label>
            <div className="streak-btns">
              {['Push', 'Pull', 'Legs'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`streak-btn ${logType === t ? 'streak-btn--active' : ''}`}
                  style={{ minWidth: 64 }}
                  onClick={() => setLogType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary"
            disabled={!logDate}
            onClick={startLoggedWorkout}
          >
            Start
          </button>
        </Sheet>
      )}
    </div>
  )
}
