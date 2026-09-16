import { test } from 'node:test'
import assert from 'node:assert/strict'
import { progressPoints } from '../src/lib/progress.js'
const session = { id: 'one', date: '2026-09-14', is_complete: true }
const history = [{ session, exercises: [{ exercise_name: 'Press', sets: [
  { weight_lbs: 10, reps: 5, is_completed: true, is_warmup: true },
  { weight_lbs: 20, reps: 8, is_completed: true },
  { weight_lbs: 25, reps: 6, is_completed: true },
  { weight_lbs: 99, reps: 10, is_completed: false },
] }], legacy: [] }]
test('progress uses independent weights, completed sets and optional warmups', () => {
  for (const [metric, expected] of Object.entries({ volume: 310, weight: 25, reps: 14, sets: 2 })) {
    assert.equal(progressPoints(history, ' press ', metric)[0].value, expected)
  }
  assert.equal(progressPoints(history, 'Press', 'volume', '', '', true)[0].value, 360)
  assert.deepEqual(progressPoints(history, 'Press', 'sets', '2026-09-15'), [])
  assert.deepEqual(progressPoints(history, 'Press', 'sets', '', '2026-09-13'), [])
  assert.deepEqual(progressPoints([{ ...history[0], session: { ...session, is_complete: false } }], 'Press', 'sets'), [])
})
test('legacy repeated weights, per-set arrays, unknowns and same-day sessions are preserved', () => {
  const legacy = [{ session, exercises: [], legacy: [{ exercise_name: 'Press', set_weights: [20], partial_reps: [8, 6] }] }]
  assert.equal(progressPoints(legacy, 'Press', 'volume')[0].value, 280)
  legacy[0].legacy[0].set_weights = [20, 25]
  assert.equal(progressPoints(legacy, 'Press', 'volume')[0].value, 310)
  legacy[0].legacy[0].set_weights = []
  assert.equal(progressPoints(legacy, 'Press', 'volume')[0].value, null)
  legacy[0].legacy[0].weight_lbs = 0
  assert.equal(progressPoints(legacy, 'Press', 'volume')[0].value, 0)
  assert.equal(progressPoints([...legacy, ...history], 'Press', 'sets').length, 2)
})
