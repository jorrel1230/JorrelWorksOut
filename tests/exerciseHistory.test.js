import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recentExerciseHistory } from '../src/lib/exerciseHistory.js'
const legacy = (id, date, complete = true) => ({
  session: { id, date, is_complete: complete, note: 'Session note' }, exercises: [],
  legacy: [{ id: `${id}-result`, exercise_name: 'Bench Press', partial_reps: [8, 6], set_weights: [100, 110], notes: 'Paused' }],
})
test('recent history matches names, bounds dates, excludes current/incomplete and limits newest first', () => {
  const records = Array.from({ length: 8 }, (_, i) => legacy(String(i), `2026-09-0${i + 1}`))
  records.push(legacy('unfinished', '2026-09-08', false))
  const result = recentExerciseHistory(records, ' bench PRESS ', '6', '2026-09-07')
  assert.deepEqual(result.map(row => row.id), ['5', '4', '3', '2', '1'])
  assert.deepEqual(recentExerciseHistory(records, 'New exercise', '', ''), [])
  assert.deepEqual(recentExerciseHistory(records, '', '', ''), [])
})
test('history preserves variable weights, repeated weights, notes, zero and unknown reps', () => {
  const record = legacy('one', '2026-09-01')
  const entry = recentExerciseHistory([record], 'Bench Press')[0].entries[0]
  assert.deepEqual(entry.sets, [{ weight: 100, reps: 8 }, { weight: 110, reps: 6 }])
  assert.equal(entry.notes, 'Paused')
  record.legacy[0].set_weights = [0]
  record.legacy[0].sets_completed = 3
  const sets = recentExerciseHistory([record], 'Bench Press')[0].entries[0].sets
  assert.deepEqual(sets, [{ weight: 0, reps: 8 }, { weight: 0, reps: 6 }, { weight: 0, reps: undefined }])
})
test('normalized history includes only performed sets and preserves warmups and set notes', () => {
  const record = legacy('one', '2026-09-01')
  record.legacy = []
  record.exercises = [{ id: 'exercise', exercise_name: 'Bench Press', notes: 'Exercise note', sets: [
    { weight_lbs: 45, reps: 10, is_completed: true, is_warmup: true, notes: 'Easy' },
    { weight_lbs: 100, reps: 5, is_completed: false },
  ] }]
  assert.deepEqual(recentExerciseHistory([record], 'Bench Press')[0].entries[0].sets, [{ weight: 45, reps: 10, warmup: true, notes: 'Easy' }])
  record.exercises[0].sets[0].is_completed = false
  assert.deepEqual(recentExerciseHistory([record], 'Bench Press'), [])
})
