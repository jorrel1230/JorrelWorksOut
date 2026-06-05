import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sheet from '../components/Sheet'

const TODAY_ISO = new Date().toISOString().split('T')[0]

export default function RunHome() {
  const navigate = useNavigate()
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [logDate, setLogDate] = useState(TODAY_ISO)

  function startLoggedRun() {
    setShowLogSheet(false)
    navigate(`/run/log?date=${logDate}`)
  }

  return (
    <div className="screen run-home-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/dashboard')}>‹ Back</button>
        <span className="workout-nav-title">Run</span>
        <div style={{ width: 60 }} />
      </nav>

      <div className="run-home-body">
        <div className="home-cta">
          <button className="btn-primary" onClick={() => navigate('/run/log')}>
            Log a Run
          </button>
          <button className="home-log-btn" onClick={() => { setLogDate(TODAY_ISO); setShowLogSheet(true) }}>
            + Log past run
          </button>
        </div>

        <nav className="home-nav">
          <button className="btn-ghost home-nav-btn" onClick={() => navigate('/run/history')}>
            History
          </button>
          <button className="btn-ghost home-nav-btn" onClick={() => navigate('/run/progress')}>
            Progress
          </button>
        </nav>
      </div>

      {showLogSheet && (
        <Sheet title="Log Past Run" onCancel={() => setShowLogSheet(false)}>
          <div className="log-sheet-field">
            <label className="detail-field-label">Date</label>
            <input
              type="date"
              max={TODAY_ISO}
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={!logDate} onClick={startLoggedRun}>
            Continue
          </button>
        </Sheet>
      )}
    </div>
  )
}
