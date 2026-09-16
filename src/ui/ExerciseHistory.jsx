import { useState } from 'react'
import { recentExerciseHistory } from '../lib/exerciseHistory.js'

export function ExerciseHistory({ name, workouts, currentId, date, error }) {
  const [expanded, setExpanded] = useState(false)
  const history = recentExerciseHistory(workouts || [], name, currentId, date)
  if (!name.trim()) return null
  return <details open={expanded}
    onKeyDown={event => { if (event.key === 'Escape') { setExpanded(false); event.stopPropagation() } }}>
    <summary onClick={event => { event.preventDefault(); setExpanded(value => !value) }}>Recent history: {name.trim()}</summary>
    <p>Up to five completed workouts on or before this workout’s date, excluding this workout.</p>
    {error ? <p>History unavailable: {error}</p> : !workouts ? <p>Loading exercise history…</p> : !history.length ? <p>No previous completed workouts for this exercise.</p> : <>
      <p>Newest first. New-format sets must be marked completed; warmups are labeled. Imported sets and weights are shown as recorded, without interpreting assistance or body weight.</p>
      <ol>{history.map((workout, index) => <li key={workout.id}>
        <p><strong>{index === 0 ? 'Last time: ' : ''}{workout.date}</strong></p>
        {workout.entries.map(entry => <div key={entry.id}>
          {entry.legacy && <p>Imported history</p>}
          {entry.sets.length ? <ul>{entry.sets.map((set, i) => <li key={i}>
            Set {i + 1}: {set.weight ?? 'unknown'} lb × {set.reps ?? 'unknown'} reps{set.warmup ? ' (warmup)' : ''}{set.notes ? ` — ${set.notes}` : ''}
          </li>)}</ul> : <p>Set details not recorded.</p>}
          {entry.notes && <p>Exercise notes: {entry.notes}</p>}
        </div>)}
        {workout.notes && <p>Session notes: {workout.notes}</p>}
      </li>)}</ol>
    </>}
  </details>
}
