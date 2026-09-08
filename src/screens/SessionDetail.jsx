import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { formatDate, SETS_REQUIRED, WORKOUT_LIFTS } from '../lib/workout'
import SetCircle from '../components/SetCircle'
import Sheet from '../components/Sheet'

function partialRepsToSets(partialReps) {
  return partialReps.map(r => (r === 0 ? null : r))
}

function setsToPartialReps(sets) {
  return sets.map(s => s ?? 0)
}

function recompute(sets, lift) {
  const req = lift.setsRequired ?? SETS_REQUIRED(lift.exerciseName)
  const completed = sets.filter(s => s !== null).length
  return { sets_completed: completed, failed: completed < req, partial_reps: setsToPartialReps(sets) }
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [results, setResults] = useState([])

  const [editMode, setEditMode] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLifts, setEditLifts] = useState([])
  const [saving, setSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pickerTarget, setPickerTarget] = useState(null) // { liftIdx, setIdx }

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [sess, res] = await Promise.all([
        db.sessions.get(id),
        db.liftResults.where('session_id').equals(id).toArray(),
      ])
      const order = WORKOUT_LIFTS[sess?.type] ?? []
      const sorted = [...res].sort((a, b) =>
        order.indexOf(a.exercise_name) - order.indexOf(b.exercise_name)
      )
      setSession(sess)
      setResults(sorted)
      setLoading(false)
    }
    load()
  }, [id])

  function enterEdit() {
    setEditDate(session.date)
    setEditNote(session.note ?? '')
    setEditLifts(results.map(r => ({
      exerciseName: r.exercise_name,
      weightLbs: r.weight_lbs,
      setsRequired: r.sets_required ?? SETS_REQUIRED(r.exercise_name),
      targetReps: r.target_reps ?? 8,
      sets: partialRepsToSets(r.partial_reps),
    })))
    setEditMode(true)
  }

  function handleSetTap(liftIdx, setIdx) {
    const completing = editLifts[liftIdx].sets[setIdx] === null
    setEditLifts(prev => prev.map((lift, li) => {
      if (li !== liftIdx) return lift
      const sets = [...lift.sets]
      sets[setIdx] = completing ? (lift.targetReps ?? 8) : null
      return { ...lift, sets }
    }))
  }

  function handlePlus(liftIdx) {
    const nextIdx = editLifts[liftIdx].sets.findIndex(s => s === null)
    if (nextIdx === -1) return
    setPickerTarget({ liftIdx, setIdx: nextIdx })
  }

  function handleRepSelect(reps) {
    const { liftIdx, setIdx } = pickerTarget
    setEditLifts(prev => prev.map((lift, li) => {
      if (li !== liftIdx) return lift
      const sets = [...lift.sets]
      sets[setIdx] = reps
      return { ...lift, sets }
    }))
    setPickerTarget(null)
  }

  async function handleSave() {
    setSaving(true)

    const updatedSession = { ...session, date: editDate, note: editNote || null }
    await db.sessions.put(updatedSession)

    const updatedResults = editLifts.map((lift, i) => {
      const orig = results[i]
      const { sets_completed, failed, partial_reps } = recompute(lift.sets, lift)
      return {
        ...orig,
        exercise_name: lift.exerciseName,
        weight_lbs: lift.weightLbs,
        sets_completed,
        partial_reps,
        failed,
      }
    })
    await db.liftResults.bulkPut(updatedResults)

    // Best-effort Supabase push
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (authSession) {
        await supabase.from('workout_sessions').upsert({ ...updatedSession, user_id: authSession.user.id })
        await supabase.from('lift_results').upsert(updatedResults)
      }
    } catch (error) {
      console.warn('Supabase workout update failed', error)
    }

    setSession(updatedSession)
    setResults(updatedResults)
    setEditMode(false)
    setSaving(false)
  }

  async function handleDelete() {
    await db.liftResults.where('session_id').equals(id).delete()
    await db.sessions.delete(id)

    try {
      await supabase.from('workout_sessions').delete().eq('id', id)
    } catch (error) {
      console.warn('Supabase workout delete failed', error)
    }

    navigate('/history', { replace: true })
  }

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">5×5</span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="screen" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text2)' }}>Session not found.</p>
        <button className="btn-ghost" onClick={() => navigate('/history')}>‹ Back</button>
      </div>
    )
  }

  // ── View mode ──────────────────────────────────────────────────────────────

  if (!editMode) {
    return (
      <div className="screen detail-screen">
        <nav className="detail-nav">
          <button className="workout-nav-btn" onClick={() => navigate('/history')}>‹ Back</button>
          <span className="workout-nav-title">Workout {session.type}</span>
          <button className="workout-nav-btn" onClick={enterEdit}>Edit</button>
        </nav>

        <div className="detail-body">
          <p className="detail-date">{formatDate(session.date)}</p>

          <div className="detail-lifts">
            {results.map(r => (
              <div className="detail-lift-row" key={r.exercise_name}>
                <div className="detail-lift-info">
                  <span className="detail-lift-name">{r.exercise_name}</span>
                  <span className="detail-lift-meta">
                    {r.sets_completed}/{r.sets_required ?? SETS_REQUIRED(r.exercise_name)} sets · {r.weight_lbs} lbs
                  </span>
                </div>
                <span className={`summary-badge ${r.failed ? 'summary-badge--fail' : 'summary-badge--success'}`}>
                  {r.failed ? '✗ Failed' : '✓ Done'}
                </span>
              </div>
            ))}
          </div>

          {session.note && (
            <div className="detail-note">
              <p className="summary-note-label">Note</p>
              <p className="summary-note-body">{session.note}</p>
            </div>
          )}

          <button
            className="detail-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete workout
          </button>
        </div>

        {showDeleteConfirm && (
          <Sheet
            title="Delete this workout?"
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
        <span className="workout-nav-title">Edit Workout</span>
        <button className="workout-nav-btn" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
      </nav>

      <div className="detail-body">
        <div className="detail-field">
          <label className="detail-field-label">Date</label>
          <input
            type="date"
            max={today}
            value={editDate}
            onChange={e => setEditDate(e.target.value)}
          />
        </div>

        <div className="detail-field">
          <label className="detail-field-label">Note</label>
          <textarea
            className="note-textarea"
            value={editNote}
            onChange={e => setEditNote(e.target.value)}
            placeholder="How did it feel?"
            rows={3}
          />
        </div>

        <p className="detail-field-label" style={{ marginBottom: '0.5rem' }}>Lifts</p>

        {editLifts.map((lift, li) => (
          <div className="lift-card" key={lift.exerciseName}>
            <div className="lift-card-header">
              <span className="lift-card-name">{lift.exerciseName}</span>
              <div className="onboarding-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="2.5"
                  value={lift.weightLbs}
                  onChange={e => setEditLifts(prev => prev.map((l, i) =>
                    i === li ? { ...l, weightLbs: parseFloat(e.target.value) || l.weightLbs } : l
                  ))}
                />
                <span className="onboarding-unit">lbs</span>
              </div>
            </div>
            <div className="set-row">
              <div className="set-circles">
                {lift.sets.map((reps, si) => (
                  <SetCircle key={si} reps={reps} onTap={() => handleSetTap(li, si)} />
                ))}
              </div>
              <button
                className="plus-btn"
                type="button"
                onClick={() => handlePlus(li)}
                disabled={lift.sets.every(s => s !== null)}
              >+</button>
            </div>
          </div>
        ))}
      </div>

      {pickerTarget && (
        <Sheet title="Reps completed" onCancel={() => setPickerTarget(null)}>
          <div className="rep-grid">
            {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
              <button key={n} className="rep-btn" onClick={() => handleRepSelect(n)}>{n}</button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
