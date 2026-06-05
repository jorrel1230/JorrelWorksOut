import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { WORKOUT_LIFTS, nextWorkoutType, sortSessionsDesc } from '../lib/workout'
import LiftCard from '../components/LiftCard'
import RestTimer from '../components/RestTimer'

// ── Inline sheets ────────────────────────────────────────────────────────────

function Sheet({ title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 className="sheet-title">{title}</h3>
        {body && <p className="sheet-body">{body}</p>}
        <button className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function RepPickerSheet({ onSelect, onCancel }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 className="sheet-title">Reps completed</h3>
        <div className="rep-grid">
          {[1, 2, 3, 4].map(n => (
            <button key={n} className="rep-btn" type="button" onClick={() => onSelect(n)}>
              {n}
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function WeightEditSheet({ liftName, value, onChange, onConfirm, onCancel }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 className="sheet-title">{liftName}</h3>
        <div className="weight-edit-row">
          <input
            type="number"
            min="0"
            step="2.5"
            value={value}
            onChange={e => onChange(e.target.value)}
            autoFocus
          />
          <span className="sheet-unit">lbs</span>
        </div>
        <button className="btn-primary" onClick={onConfirm}>Done</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function NoteSheet({ value, onChange, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 className="sheet-title">Note</h3>
        <textarea
          className="note-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="How did it feel?"
          rows={4}
          autoFocus
        />
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const prefill = state?.prefill ?? null
  const [loading, setLoading] = useState(true)
  const [workoutType, setWorkoutType] = useState('A')
  const [liftStates, setLiftStates] = useState([])
  const [lastSetTime, setLastSetTime] = useState(null)
  const [note, setNote] = useState('')

  // sheet visibility
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showNoteSheet, setShowNoteSheet] = useState(false)
  const [pickerTarget, setPickerTarget] = useState(null)   // { liftIdx, setIdx }
  const [editWeightIdx, setEditWeightIdx] = useState(null)
  const [weightInput, setWeightInput] = useState('')
  const allExercisesRef = useRef([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id
      const [exercises, allSessions] = await Promise.all([
        db.exercises.where('user_id').equals(userId).toArray(),
        db.sessions.where('user_id').equals(userId).toArray(),
      ])

      allExercisesRef.current = exercises

      const completed = sortSessionsDesc(allSessions.filter(s => s.is_complete))

      const type = prefill?.type ?? nextWorkoutType(completed[0] ?? null)
      setWorkoutType(type)

      const exMap = Object.fromEntries(exercises.map(e => [e.name, e]))
      setLiftStates(
        WORKOUT_LIFTS[type].map(name => {
          const ex = exMap[name]
          return {
            name,
            weightLbs: ex.weight_lbs,
            setsRequired: ex.sets_required,
            failureStreak: ex.failure_streak,
            sets: Array(ex.sets_required).fill(null),
          }
        })
      )
      setLoading(false)
    }
    load()
  }, [])

  function handleSetTap(liftIdx, setIdx) {
    const completing = liftStates[liftIdx].sets[setIdx] === null
    setLiftStates(prev =>
      prev.map((lift, li) => {
        if (li !== liftIdx) return lift
        const sets = [...lift.sets]
        sets[setIdx] = completing ? 5 : null
        return { ...lift, sets }
      })
    )
    if (completing) setLastSetTime(new Date())
  }

  function handlePlus(liftIdx) {
    const nextIdx = liftStates[liftIdx].sets.findIndex(s => s === null)
    if (nextIdx === -1) return
    setPickerTarget({ liftIdx, setIdx: nextIdx })
  }

  function handleRepSelect(reps) {
    const { liftIdx, setIdx } = pickerTarget
    setLiftStates(prev =>
      prev.map((lift, li) => {
        if (li !== liftIdx) return lift
        const sets = [...lift.sets]
        sets[setIdx] = reps
        return { ...lift, sets }
      })
    )
    setPickerTarget(null)
    setLastSetTime(new Date())
  }

  function handleEditWeight(liftIdx) {
    setEditWeightIdx(liftIdx)
    setWeightInput(String(liftStates[liftIdx].weightLbs))
  }

  function confirmWeightEdit() {
    const val = parseFloat(weightInput)
    if (!isNaN(val) && val > 0) {
      setLiftStates(prev =>
        prev.map((lift, li) => li === editWeightIdx ? { ...lift, weightLbs: val } : lift)
      )
    }
    setEditWeightIdx(null)
  }

  function handleFinishPress() {
    const hasUntouched = liftStates.some(lift => lift.sets.every(s => s === null))
    hasUntouched ? setShowFinishConfirm(true) : doFinish()
  }

  function doFinish() {
    const results = liftStates.map(lift => ({
      exerciseName: lift.name,
      weightLbs: lift.weightLbs,
      setsRequired: lift.setsRequired,
      failureStreak: lift.failureStreak,
      setsCompleted: lift.sets.filter(s => s === 5).length,
      partialReps: lift.sets.map(s => s ?? 0),
      failed: lift.sets.filter(s => s === 5).length < lift.setsRequired,
    }))

    navigate('/summary', {
      state: {
        type: workoutType,
        date: prefill?.date ?? new Date().toISOString().split('T')[0],
        note,
        allExercises: allExercisesRef.current,
        results,
      },
    })
  }

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">5×5</span>
      </div>
    )
  }

  return (
    <div className="screen workout-screen">
      <nav className="workout-nav">
        <button className="workout-nav-btn" type="button" onClick={() => setShowBackConfirm(true)}>
          ‹ Back
        </button>
        <span className="workout-nav-title">Workout {workoutType}</span>
        <button className="workout-nav-btn" type="button" onClick={handleFinishPress}>
          Finish
        </button>
      </nav>

      <div className="workout-lifts">
        {liftStates.map((lift, li) => (
          <LiftCard
            key={lift.name}
            lift={lift}
            liftIdx={li}
            onSetTap={handleSetTap}
            onPlus={handlePlus}
            onEditWeight={handleEditWeight}
          />
        ))}
      </div>

      <div className="workout-footer">
        <button
          className="workout-footer-btn"
          type="button"
          onClick={() => setShowNoteSheet(true)}
        >
          {note ? 'Edit note' : 'Note'}
        </button>
      </div>

      <RestTimer triggerTime={lastSetTime} onDismiss={() => setLastSetTime(null)} />

      {showBackConfirm && (
        <Sheet
          title="Discard workout?"
          body="Your progress won't be saved."
          confirmLabel="Discard"
          onConfirm={() => navigate('/home')}
          onCancel={() => setShowBackConfirm(false)}
        />
      )}

      {showFinishConfirm && (
        <Sheet
          title="Not all sets completed"
          body="Some lifts haven't been touched. Finish anyway?"
          confirmLabel="Finish anyway"
          onConfirm={() => { setShowFinishConfirm(false); doFinish() }}
          onCancel={() => setShowFinishConfirm(false)}
        />
      )}

      {pickerTarget && (
        <RepPickerSheet
          onSelect={handleRepSelect}
          onCancel={() => setPickerTarget(null)}
        />
      )}

      {editWeightIdx !== null && (
        <WeightEditSheet
          liftName={liftStates[editWeightIdx].name}
          value={weightInput}
          onChange={setWeightInput}
          onConfirm={confirmWeightEdit}
          onCancel={() => setEditWeightIdx(null)}
        />
      )}

      {showNoteSheet && (
        <NoteSheet
          value={note}
          onChange={setNote}
          onClose={() => setShowNoteSheet(false)}
        />
      )}
    </div>
  )
}
