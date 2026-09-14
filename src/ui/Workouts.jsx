import { useEffect, useState } from 'react'
import { deleteWorkout, listDrafts, listRecords, loadWorkout, saveDraft, saveWorkout } from '../lib/repository.js'
import { fingerprint, newExercise, newSet, newWorkout } from '../lib/model.js'
import { Checkbox, Feedback, Field, RecordDetails } from './Fields.jsx'
import { downloadJson, useEditor } from './editor.js'

export function WorkoutList({ userId, revision, onSaved }) {
  const [records, setRecords] = useState([])
  const [drafts, setDrafts] = useState([])
  const [status, setStatus] = useState('Loading…')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([listRecords('sessions', userId), listDrafts(userId)]).then(([rows, snapshots]) => {
      if (!active) return
      setRecords(rows.sort((a, b) => b.date.localeCompare(a.date)))
      setDrafts(snapshots.filter(row => row.key.startsWith('workouts/')))
      setStatus('')
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [userId, revision])
  async function create() {
    try {
      const workout = newWorkout(userId)
      await saveDraft(userId, `workouts/${workout.session.id}`, workout, fingerprint(null))
      onSaved()
      window.location.hash = `#/workouts/${workout.session.id}`
    } catch (err) { setError(err.message) }
  }
  return <section><h2>Workouts</h2><p>Any workout type, any exercises, independent sets. No prescribed program.</p>
    <button onClick={create}>New workout</button><Feedback status={status} error={error} />
    {drafts.length > 0 && <section><h3>Editor drafts</h3><ul>{drafts.map(row => <li key={row.id}><a href={`#/${row.key}`}>Resume {row.value.session.type || 'untitled workout'} — {row.value.session.date}</a></li>)}</ul></section>}
    <h3>Saved history</h3>{!records.length && !status && <p>No workouts saved for this account.</p>}
    <ul>{records.map(row => <li key={row.id}><a href={`#/workouts/${row.id}`}>{row.date} — {row.type || 'Untitled'} ({row.is_complete ? 'completed' : 'in progress'})</a></li>)}</ul>
  </section>
}

export function WorkoutEditor({ userId, id, onSaved }) {
  const editor = useEditor(userId, `workouts/${id}`, () => loadWorkout(id, userId))
  const [catalog, setCatalog] = useState([])
  useEffect(() => { listRecords('exercises', userId).then(setCatalog).catch(() => {}) }, [userId])
  const { value, status, error, busy, change } = editor
  const session = value?.session
  function setSession(key, next) { change({ ...value, session: { ...session, [key]: next } }) }
  function updateExercise(index, next) { change({ ...value, exercises: value.exercises.map((row, position) => position === index ? next : row) }) }
  function moveExercise(index, direction) {
    const exercises = [...value.exercises]
    ;[exercises[index], exercises[index + direction]] = [exercises[index + direction], exercises[index]]
    change({ ...value, exercises })
  }
  async function save(complete) {
    if (await editor.save((input, base) => saveWorkout(userId, input, base, complete))) onSaved()
  }
  async function remove() {
    if (!window.confirm('Delete this entire workout, including saved sets and any legacy results? This deletion will also be queued for your cloud account.')) return
    if (await editor.save(async (input, base) => {
      await deleteWorkout(userId, input.session.id, base)
      return null
    })) { onSaved(); window.location.hash = '#/workouts' }
  }
  return <section><h2>Workout</h2><a href="#/workouts">All workouts</a><Feedback status={status} error={error} />
    {value && <><p>{session.is_complete ? 'Completed record. Changes require an explicit save.' : 'In progress. Reload to resume your editor draft.'}</p>
      <form onSubmit={event => { event.preventDefault(); save(session.is_complete) }}>
        <fieldset disabled={busy}><legend>Session</legend>
          <Field label="Date" type="date" required value={session.date} onChange={next => setSession('date', next)} />
          <Field label="Workout type" required value={session.type} onChange={next => setSession('type', next)} />
          <details><summary>Session notes</summary><Field label="Notes" type="textarea" value={session.note} onChange={next => setSession('note', next)} /></details>
        </fieldset>
        <datalist id="exercise-names">{catalog.map(row => <option key={row.id} value={row.name} />)}</datalist>
        {value.exercises.map((exercise, index) => <fieldset key={exercise.id} disabled={busy}>
          <legend>Exercise {index + 1}: {exercise.exercise_name || 'unnamed'}</legend>
          <Field label="Exercise name" required list="exercise-names" value={exercise.exercise_name} onChange={next => updateExercise(index, { ...exercise, exercise_name: next })} />
          <p><button type="button" disabled={index === 0} onClick={() => moveExercise(index, -1)}>Move exercise up</button>{' '}
            <button type="button" disabled={index === value.exercises.length - 1} onClick={() => moveExercise(index, 1)}>Move exercise down</button></p>
          <details><summary>Exercise notes</summary><Field label="Exercise notes" type="textarea" value={exercise.notes} onChange={next => updateExercise(index, { ...exercise, notes: next })} /></details>
          {exercise.sets.map((set, setIndex) => {
            const setField = (key, next) => updateExercise(index, { ...exercise, sets: exercise.sets.map(row => row.id === set.id ? { ...row, [key]: next } : row) })
            return <fieldset key={set.id}><legend>Set {setIndex + 1}</legend>
              <Field label="Weight (lb)" type="number" required value={set.weight_lbs} onChange={next => setField('weight_lbs', next)} />
              <Field label="Reps" type="number" integer required value={set.reps} onChange={next => setField('reps', next)} />
              <Checkbox label="Warmup" checked={set.is_warmup} onChange={next => setField('is_warmup', next)} />
              <Checkbox label="Completed" checked={set.is_completed} onChange={next => setField('is_completed', next)} />
              <details><summary>Set notes</summary><Field label="Set notes" type="textarea" value={set.notes} onChange={next => setField('notes', next)} /></details>
              <button type="button" onClick={() => { if (window.confirm(`Remove set ${setIndex + 1}?`)) updateExercise(index, { ...exercise, sets: exercise.sets.filter(row => row.id !== set.id) }) }}>Remove set {setIndex + 1}</button>
            </fieldset>
          })}
          <p><button type="button" onClick={() => updateExercise(index, { ...exercise, sets: [...exercise.sets, newSet(exercise.id)] })}>Add set</button></p>
          <button type="button" onClick={() => { if (window.confirm('Remove this exercise and all its sets?')) change({ ...value, exercises: value.exercises.filter(row => row.id !== exercise.id) }) }}>Remove exercise</button>
        </fieldset>)}
        <p><button type="button" disabled={busy} onClick={() => change({ ...value, exercises: [...value.exercises, newExercise(session)] })}>Add exercise</button></p>
        <p>Completing a workout does not mark unchecked sets as completed. No weights or progression are changed automatically.</p>
        <p><button type="submit" disabled={busy}>{session.is_complete ? 'Save completed workout changes' : 'Save in-progress workout'}</button>{' '}
          {!session.is_complete && <button type="button" disabled={busy} onClick={() => save(true)}>Complete workout</button>}</p>
      </form>
      {value.legacy.length > 0 && <section><h3>Legacy results (read-only)</h3><p>Original per-exercise records, including set arrays. These are not converted or changed by saving this workout.</p>
        {value.legacy.map(row => <details key={row.id}><summary>{row.exercise_name} — {row.weight_lbs ?? 'unknown'} lb</summary><RecordDetails row={row} /></details>)}</section>}
      {error && <p><button disabled={busy} onClick={() => change(value)}>Retry saving editor draft</button></p>}
      <p><button disabled={busy} onClick={editor.discard}>Discard editor draft</button>{' '}<button onClick={() => downloadJson(value, `workout-draft-${id}.json`)}>Download editor draft</button></p>
      <details><summary>Delete workout</summary><p>Deletes saved history, not just your editor draft.</p><button disabled={busy} onClick={remove}>Delete workout permanently</button></details>
    </>}
  </section>
}
