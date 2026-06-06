import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { pushRun } from '../lib/sync'
import { parseDuration } from '../lib/runUtils'

const TODAY_ISO = new Date().toISOString().split('T')[0]

export default function LogRun() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [date, setDate] = useState(searchParams.get('date') || TODAY_ISO)
  const [distance, setDistance] = useState('')
  const [durationHr, setDurationHr] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [avgPaceMin, setAvgPaceMin] = useState('')
  const [avgPaceSec, setAvgPaceSec] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [z2TimeMin, setZ2TimeMin] = useState('')
  const [z2TimeSec, setZ2TimeSec] = useState('')
  const [avgCadence, setAvgCadence] = useState('')
  const [elevationGain, setElevationGain] = useState('')
  const [avgPower, setAvgPower] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }

    const durationStr = (durationHr || durationMin || durationSec)
      ? `${durationHr || '0'}:${String(parseInt(durationMin) || 0).padStart(2,'0')}:${String(parseInt(durationSec) || 0).padStart(2,'0')}`
      : ''
    const z2Str = (z2TimeMin || z2TimeSec)
      ? `${z2TimeMin || '0'}:${String(parseInt(z2TimeSec) || 0).padStart(2,'0')}`
      : ''
    const durationSecs = parseDuration(durationStr)
    const z2Secs = parseDuration(z2Str)
    if (z2Secs != null && durationSecs != null && z2Secs > durationSecs) {
      setError('Z2 time exceeds total duration')
      setSaving(false)
      return
    }

    const run = {
      id:               crypto.randomUUID(),
      user_id:          session.user.id,
      date,
      distance:         distance ? parseFloat(distance) : null,
      duration_seconds: durationSecs,
      avg_pace:         (avgPaceMin || avgPaceSec) ? `${avgPaceMin || '0'}:${String(parseInt(avgPaceSec) || 0).padStart(2,'0')}` : null,
      avg_hr:           avgHr ? parseInt(avgHr) : null,
      z2_time_seconds:  z2Secs,
      avg_cadence:      avgCadence ? parseInt(avgCadence) : null,
      elevation_gain:   elevationGain ? parseFloat(elevationGain) : null,
      avg_power:        avgPower ? parseInt(avgPower) : null,
      calories:         calories ? parseInt(calories) : null,
      notes:            notes || null,
      created_at:       new Date().toISOString(),
    }

    await db.runs.put(run)
    pushRun(session.user.id, run).catch(() => {})
    navigate('/run/history', { replace: true })
  }

  return (
    <div className="screen detail-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/run')}>‹ Back</button>
        <span className="workout-nav-title">Log Run</span>
        <button className="workout-nav-btn" onClick={handleSave} disabled={saving || !date}>
          {saving ? '…' : 'Save'}
        </button>
      </nav>

      <div className="detail-body">
        <div className="log-run-card">
          <div className="log-run-row">
            <span className="log-run-label">Date</span>
            <input
              type="date"
              max={TODAY_ISO}
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ minHeight: 'unset', padding: '6px 10px', fontSize: '0.95rem' }}
            />
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Distance</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" step="0.01" placeholder="0.0" value={distance} onChange={e => setDistance(e.target.value)} />
              <span className="log-run-unit">mi</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Duration</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" placeholder="0" value={durationHr} onChange={e => setDurationHr(e.target.value)} />
              <span className="log-run-time-sep">:</span>
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" max="59" placeholder="00" value={durationMin} onChange={e => setDurationMin(e.target.value)} />
              <span className="log-run-time-sep">:</span>
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" max="59" placeholder="00" value={durationSec} onChange={e => setDurationSec(e.target.value)} />
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Pace</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" placeholder="0" value={avgPaceMin} onChange={e => setAvgPaceMin(e.target.value)} />
              <span className="log-run-time-sep">:</span>
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" max="59" placeholder="00" value={avgPaceSec} onChange={e => setAvgPaceSec(e.target.value)} />
              <span className="log-run-unit">/mi</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg HR</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={avgHr} onChange={e => setAvgHr(e.target.value)} />
              <span className="log-run-unit">bpm</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Z2 Time</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" placeholder="0" value={z2TimeMin} onChange={e => setZ2TimeMin(e.target.value)} />
              <span className="log-run-time-sep">:</span>
              <input className="log-run-input log-run-input--time-part" type="number" inputMode="numeric" min="0" max="59" placeholder="00" value={z2TimeSec} onChange={e => setZ2TimeSec(e.target.value)} />
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Cadence</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={avgCadence} onChange={e => setAvgCadence(e.target.value)} />
              <span className="log-run-unit">spm</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Elevation</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="0" value={elevationGain} onChange={e => setElevationGain(e.target.value)} />
              <span className="log-run-unit">ft</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Power</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={avgPower} onChange={e => setAvgPower(e.target.value)} />
              <span className="log-run-unit">W</span>
            </div>
          </div>
          <div className="log-run-row log-run-row--last">
            <span className="log-run-label">Calories</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={calories} onChange={e => setCalories(e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{error}</p>}

        <div className="detail-field">
          <label className="detail-field-label">Notes</label>
          <textarea
            className="note-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it feel?"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
