import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { LIFT_ABBR, WORKOUT_LIFTS, formatDate, sortSessionsDesc } from '../lib/workout'

export default function History() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([]) // [{ session, results }]

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [sessions, allResults] = await Promise.all([
        db.sessions.where('user_id').equals(session.user.id).toArray(),
        db.liftResults.toArray(),
      ])

      const resultsBySession = new Map()
      for (const r of allResults) {
        if (!resultsBySession.has(r.session_id)) resultsBySession.set(r.session_id, [])
        resultsBySession.get(r.session_id).push(r)
      }

      const completed = sortSessionsDesc(sessions.filter(s => s.is_complete))
        .map(s => ({ session: s, results: resultsBySession.get(s.id) ?? [] }))

      setRows(completed)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">5×5</span>
      </div>
    )
  }

  return (
    <div className="screen history-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/home')}>‹ Back</button>
        <span className="workout-nav-title">History</span>
        <span style={{ width: 60 }} />
      </nav>

      {rows.length === 0 ? (
        <div className="history-empty">
          <p>No workouts logged yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {rows.map(({ session, results }) => (
            <button
              key={session.id}
              className="history-item"
              onClick={() => navigate(`/session/${session.id}`)}
            >
              <div className="history-item-header">
                <span className="history-item-date">{formatDate(session.date)}</span>
                <span className="history-item-type">Workout {session.type}</span>
              </div>
              <div className="history-item-lifts">
                {(WORKOUT_LIFTS[session.type] ?? []).map(name => {
                  const r = results.find(x => x.exercise_name === name)
                  if (!r) return null
                  return (
                    <span key={name} className="history-lift-chip">
                      <span className={`lift-dot ${r.failed ? 'lift-dot--fail' : 'lift-dot--pass'}`} />
                      {LIFT_ABBR[name] ?? name}
                    </span>
                  )
                })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
