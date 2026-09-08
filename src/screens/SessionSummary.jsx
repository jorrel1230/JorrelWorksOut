import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { computeProgression } from '../lib/progression'
import { WORKOUT_LIFTS, nextWorkoutType, formatDate } from '../lib/workout'
import { pushSession } from '../lib/sync'

export default function SessionSummary() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const savedRef = useRef(false)
  const [saving, setSaving] = useState(true)

  const hasWorkoutData = Boolean(state?.results)
  const type = state?.type ?? 'Push'
  const date = state?.date ?? new Date().toISOString().split('T')[0]
  const note = state?.note ?? ''
  const results = useMemo(() => state?.results ?? [], [state?.results])
  const allExercises = useMemo(() => state?.allExercises ?? [], [state?.allExercises])

  const exMap = useMemo(
    () => Object.fromEntries(allExercises.map(e => [e.name, e])),
    [allExercises],
  )

  const progressions = useMemo(() => results.map(r => {
    const prog = computeProgression(r.weightLbs, r.failureStreak, r.failed)
    return { ...r, ...prog }
  }), [results])

  const updatedExMap = useMemo(() => {
    const map = { ...exMap }
    for (const p of progressions) {
      if (map[p.exerciseName]) {
        map[p.exerciseName] = {
          ...map[p.exerciseName],
          weight_lbs: p.newWeight,
          failure_streak: p.newStreak,
        }
      }
    }
    return map
  }, [exMap, progressions])

  const nextType = nextWorkoutType({ type })
  const nextLifts = (WORKOUT_LIFTS[nextType] ?? []).map(name => ({
    name,
    weight_lbs: updatedExMap[name]?.weight_lbs ?? '—',
  }))

  const persist = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const userId = session.user.id
    const now = new Date().toISOString()
    const sessionId = crypto.randomUUID()

    for (const p of progressions) {
      const ex = exMap[p.exerciseName]
      if (ex) {
        await db.exercises.update(ex.id, {
          weight_lbs: p.newWeight,
          failure_streak: p.newStreak,
          updated_at: now,
        })
      }
    }

    await db.sessions.put({
      id: sessionId,
      user_id: userId,
      date,
      type,
      is_complete: true,
      note: note || null,
      created_at: now,
    })

    const liftResults = results.map(r => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      exercise_name: r.exerciseName,
      weight_lbs: r.weightLbs,
      sets_required: r.setsRequired,
      target_reps: r.targetReps,
      sets_completed: r.setsCompleted,
      partial_reps: r.partialReps,
      failed: r.failed,
    }))
    await db.liftResults.bulkPut(liftResults)

    const updatedExercises = progressions.map(p => {
      const ex = exMap[p.exerciseName]
      return { ...ex, weight_lbs: p.newWeight, failure_streak: p.newStreak, updated_at: now }
    })

    await pushSession({
      userId,
      session: { id: sessionId, date, type, is_complete: true, note: note || null, created_at: now },
      liftResults,
      updatedExercises,
    })
  }, [date, exMap, note, progressions, results, type])

  useEffect(() => {
    if (!hasWorkoutData) {
      navigate('/home', { replace: true })
      return
    }
    if (savedRef.current) return
    savedRef.current = true
    persist().finally(() => setSaving(false))
  }, [hasWorkoutData, navigate, persist])

  if (!hasWorkoutData) return null

  return (
    <div className="screen summary-screen">
      <div className="summary-header">
        <h1 className="summary-title">Workout {type} Complete</h1>
        <p className="summary-date">{formatDate(date)}</p>
      </div>

      <div className="summary-lifts">
        {progressions.map(p => (
          <div className="summary-lift-row" key={p.exerciseName}>
            <div className="summary-lift-info">
              <div className="summary-lift-name">{p.exerciseName}</div>
              <div className="summary-lift-detail">
                {p.setsCompleted}/{p.setsRequired} sets · target {p.targetReps} · {p.weightLbs} lbs
              </div>
              {p.deloaded && (
                <div className="summary-deload">
                  Deload → {p.newWeight} lbs next session
                </div>
              )}
            </div>
            <span className={`summary-badge ${p.failed ? 'summary-badge--fail' : 'summary-badge--success'}`}>
              {p.failed ? '✗ Failed' : '✓ Done'}
            </span>
          </div>
        ))}
      </div>

      {note ? (
        <div className="summary-note">
          <p className="summary-note-label">Note</p>
          <p className="summary-note-body">{note}</p>
        </div>
      ) : null}

      <div className="summary-next">
        <p className="summary-next-title">Next up — Workout {nextType}</p>
        {nextLifts.map(l => (
          <div className="summary-next-row" key={l.name}>
            <span className="summary-next-name">{l.name}</span>
            <span className="summary-next-weight">{l.weight_lbs} lbs</span>
          </div>
        ))}
      </div>

      <button
        className="btn-primary"
        disabled={saving}
        onClick={() => navigate('/home', { replace: true })}
      >
        {saving ? 'Saving…' : 'Done'}
      </button>
    </div>
  )
}
