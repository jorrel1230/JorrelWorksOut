import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { formatDate } from '../lib/workout'
import { pushRun } from '../lib/sync'
import { parseDuration, formatDuration, formatPace } from '../lib/runUtils'
import Sheet from '../components/Sheet'

const TODAY_ISO = new Date().toISOString().split('T')[0]

function Field({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="detail-lift-row">
      <div className="detail-lift-info">
        <span className="detail-lift-name">{label}</span>
      </div>
      <span className="detail-lift-meta" style={{ color: 'var(--red)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

export default function RunDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // edit fields
  const [editDate, setEditDate] = useState('')
  const [editDistance, setEditDistance] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editAvgPace, setEditAvgPace] = useState('')
  const [editAvgHr, setEditAvgHr] = useState('')
  const [editZ2Time, setEditZ2Time] = useState('')
  const [editAvgCadence, setEditAvgCadence] = useState('')
  const [editElevation, setEditElevation] = useState('')
  const [editAvgPower, setEditAvgPower] = useState('')
  const [editCalories, setEditCalories] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    db.runs.get(id).then(r => { setRun(r); setLoading(false) })
  }, [id])

  function enterEdit() {
    setEditDate(run.date)
    setEditDistance(run.distance != null ? String(run.distance) : '')
    setEditDuration(run.duration_seconds != null ? formatDuration(run.duration_seconds) : '')
    setEditAvgPace(run.avg_pace ?? '')
    setEditAvgHr(run.avg_hr != null ? String(run.avg_hr) : '')
    setEditZ2Time(run.z2_time_seconds != null ? formatDuration(run.z2_time_seconds) : '')
    setEditAvgCadence(run.avg_cadence != null ? String(run.avg_cadence) : '')
    setEditElevation(run.elevation_gain != null ? String(run.elevation_gain) : '')
    setEditAvgPower(run.avg_power != null ? String(run.avg_power) : '')
    setEditCalories(run.calories != null ? String(run.calories) : '')
    setEditNotes(run.notes ?? '')
    setEditMode(true)
  }

  async function handleSave() {
    setSaving(true)
    setEditError('')
    const { data: { session } } = await supabase.auth.getSession()

    const durationSecs = parseDuration(editDuration)
    const z2Secs = parseDuration(editZ2Time)
    if (z2Secs != null && durationSecs != null && z2Secs > durationSecs) {
      setEditError('Z2 time exceeds total duration')
      setSaving(false)
      return
    }

    const updated = {
      ...run,
      date:             editDate,
      distance:         editDistance ? parseFloat(editDistance) : null,
      duration_seconds: durationSecs,
      avg_pace:         editAvgPace || null,
      avg_hr:           editAvgHr ? parseInt(editAvgHr) : null,
      z2_time_seconds:  z2Secs,
      avg_cadence:      editAvgCadence ? parseInt(editAvgCadence) : null,
      elevation_gain:   editElevation ? parseFloat(editElevation) : null,
      avg_power:        editAvgPower ? parseInt(editAvgPower) : null,
      calories:         editCalories ? parseInt(editCalories) : null,
      notes:            editNotes || null,
    }

    await db.runs.put(updated)

    if (session) {
      pushRun(session.user.id, updated).catch(() => {})
    }

    setRun(updated)
    setEditMode(false)
    setSaving(false)
  }

  async function handleDelete() {
    await db.runs.delete(id)
    try { await supabase.from('runs').delete().eq('id', id) } catch (_) {}
    navigate('/run/history', { replace: true })
  }

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">…</span>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="screen" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text2)' }}>Run not found.</p>
        <button className="btn-ghost" onClick={() => navigate('/run/history')}>‹ Back</button>
      </div>
    )
  }

  // ── View mode ──────────────────────────────────────────────────────────────

  if (!editMode) {
    return (
      <div className="screen detail-screen">
        <nav className="detail-nav">
          <button className="workout-nav-btn" onClick={() => navigate('/run/history')}>‹ Back</button>
          <span className="workout-nav-title">Run</span>
          <button className="workout-nav-btn" onClick={enterEdit}>Edit</button>
        </nav>

        <div className="detail-body">
          <p className="detail-date">{formatDate(run.date)}</p>

          <div className="detail-lifts">
            <Field label="Distance"   value={run.distance != null ? `${run.distance} mi` : null} />
            <Field label="Duration"   value={run.duration_seconds != null ? formatDuration(run.duration_seconds) : null} />
            <Field label="Avg Pace"   value={run.avg_pace ? formatPace(run.avg_pace) : null} />
            <Field label="Avg HR"     value={run.avg_hr != null ? `${run.avg_hr} bpm` : null} />
            <Field label="Z2 Time"    value={run.z2_time_seconds != null ? formatDuration(run.z2_time_seconds) : null} />
            <Field label="Cadence"    value={run.avg_cadence != null ? `${run.avg_cadence} spm` : null} />
            <Field label="Elevation"  value={run.elevation_gain != null ? `${run.elevation_gain} ft` : null} />
            <Field label="Avg Power"  value={run.avg_power != null ? `${run.avg_power} W` : null} />
            <Field label="Calories"   value={run.calories != null ? `${run.calories} cal` : null} />
          </div>

          {run.notes && (
            <div className="detail-note">
              <p className="summary-note-label">Notes</p>
              <p className="summary-note-body">{run.notes}</p>
            </div>
          )}

          <button className="detail-delete-btn" onClick={() => setShowDeleteConfirm(true)}>
            Delete run
          </button>
        </div>

        {showDeleteConfirm && (
          <Sheet
            title="Delete this run?"
            body="This can't be undone."
            confirmLabel="Delete"
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────

  return (
    <div className="screen detail-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => setEditMode(false)}>Cancel</button>
        <span className="workout-nav-title">Edit Run</span>
        <button className="workout-nav-btn" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
      </nav>

      <div className="detail-body">
        <div className="log-run-card">
          <div className="log-run-row">
            <span className="log-run-label">Date</span>
            <input type="date" max={TODAY_ISO} value={editDate} onChange={e => setEditDate(e.target.value)} style={{ minHeight: 'unset', padding: '6px 10px', fontSize: '0.95rem' }} />
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Distance</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" step="0.01" placeholder="0.0" value={editDistance} onChange={e => setEditDistance(e.target.value)} />
              <span className="log-run-unit">mi</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Duration</span>
            <input className="log-run-input log-run-input--wide" type="text" inputMode="numeric" placeholder="0:00:00" value={editDuration} onChange={e => setEditDuration(e.target.value)} />
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Pace</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="text" inputMode="numeric" placeholder="0:00" value={editAvgPace} onChange={e => setEditAvgPace(e.target.value)} />
              <span className="log-run-unit">/mi</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg HR</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={editAvgHr} onChange={e => setEditAvgHr(e.target.value)} />
              <span className="log-run-unit">bpm</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Z2 Time</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input log-run-input--wide" type="text" inputMode="numeric" placeholder="0:00" value={editZ2Time} onChange={e => setEditZ2Time(e.target.value)} />
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Cadence</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={editAvgCadence} onChange={e => setEditAvgCadence(e.target.value)} />
              <span className="log-run-unit">spm</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Elevation</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="0" value={editElevation} onChange={e => setEditElevation(e.target.value)} />
              <span className="log-run-unit">ft</span>
            </div>
          </div>
          <div className="log-run-row">
            <span className="log-run-label">Avg Power</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={editAvgPower} onChange={e => setEditAvgPower(e.target.value)} />
              <span className="log-run-unit">W</span>
            </div>
          </div>
          <div className="log-run-row log-run-row--last">
            <span className="log-run-label">Calories</span>
            <div className="log-run-input-wrap">
              <input className="log-run-input" type="number" min="0" placeholder="—" value={editCalories} onChange={e => setEditCalories(e.target.value)} />
            </div>
          </div>
        </div>

        {editError && <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{editError}</p>}

        <div className="detail-field">
          <label className="detail-field-label">Notes</label>
          <textarea
            className="note-textarea"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            placeholder="How did it feel?"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
