import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { formatDate } from '../lib/workout'
import { formatDuration } from '../lib/runUtils'

export default function RunHistory() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const all = await db.runs.where('user_id').equals(session.user.id).toArray()
      all.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1
      })
      setRuns(all)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">…</span>
      </div>
    )
  }

  return (
    <div className="screen history-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/run')}>‹ Back</button>
        <span className="workout-nav-title">Run History</span>
        <div style={{ width: 60 }} />
      </nav>

      {runs.length === 0 ? (
        <p className="history-empty">No runs logged yet.</p>
      ) : (
        <div className="history-list">
          {runs.map(run => (
            <button
              key={run.id}
              className="history-item"
              onClick={() => navigate(`/run/${run.id}`)}
            >
              <div className="history-item-header">
                <span className="history-item-date">{formatDate(run.date)}</span>
              </div>
              <div className="run-history-meta">
                {run.distance != null && <span>{run.distance} mi</span>}
                {run.distance != null && run.duration_seconds != null && <span>·</span>}
                {run.duration_seconds != null && <span>{formatDuration(run.duration_seconds)}</span>}
                {run.avg_hr != null && <span className="run-history-hr">· {run.avg_hr} bpm</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
