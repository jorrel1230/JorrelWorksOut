import 'fake-indexeddb/auto'
import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { db } from '../src/lib/db.js'
import { fingerprint, newExercise, newSet, newWorkout, normalizeWorkout, numberValue, validDate } from '../src/lib/model.js'
import { deleteResource, deleteWorkout, exportData, listRecords, loadDraft, loadWorkout, queueOwner, saveDraft, saveResource, saveWorkout } from '../src/lib/repository.js'
import { queueOperations, queueStatus, syncAccount } from '../src/lib/sync.js'

// All database operations in this file use fake-indexeddb in this Node process, never a browser database.
beforeEach(async () => { await db.delete(); await db.open() })
after(async () => { await db.delete() })
const owner = 'account-a'
function workout(userId = owner) {
  const result = newWorkout(userId)
  result.session.type = 'Free training'
  result.session.note = 'Session note'
  const exercise = newExercise(result.session)
  exercise.exercise_name = 'Any movement'
  exercise.notes = 'Exercise note'
  exercise.sets = [
    { ...newSet(exercise.id), weight_lbs: '12.25', reps: '7', notes: 'Warmup note', is_warmup: true, is_completed: true },
    { ...newSet(exercise.id), weight_lbs: '27.5', reps: '3', notes: 'Working note', is_completed: false },
  ]
  result.exercises.push(exercise)
  return result
}
function clientFor(userId = owner, remote = {}, options = {}) {
  const calls = []
  return {
    calls, remote,
    auth: { getSession: async () => ({ data: { session: { user: { id: userId }, access_token: 'mock-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } } }) },
    from(table) {
      let action = 'select', row, start = 0, end = 499
      const filters = []
      const query = {
        select() { return query }, order() { return query },
        range(a, b) { start = a; end = b; return query },
        eq(key, value) { filters.push([key, value]); return query },
        upsert(value) { action = 'upsert'; row = structuredClone(value); return query },
        delete() { action = 'delete'; return query },
        async then(resolve, reject) {
          try {
            calls.push({ table, action, row, filters })
            await options.before?.({ table, action, row })
            if (options.fail?.({ table, action, row })) return resolve({ error: { message: 'simulated failure', code: options.code } })
            const rows = remote[table] ||= []
            const matches = value => filters.every(([key, expected]) => value[key] === expected)
            if (action === 'upsert') {
              const index = rows.findIndex(value => value.id === row.id)
              if (index < 0) rows.push(row); else rows[index] = row
            } else if (action === 'delete') remote[table] = rows.filter(value => !matches(value))
            return resolve({ data: action === 'select' ? structuredClone(rows.filter(matches).sort((a, b) => a.id.localeCompare(b.id)).slice(start, end + 1)) : null, error: null })
          } catch (error) { return reject(error) }
        },
      }
      return query
    },
  }
}

test('validation rejects invalid dates, nonfinite/negative weights and fractional reps', () => {
  for (const date of ['2025-02-29', '2024-02-30', 'not-date', '0000-01-01', '2024-1-01']) assert.equal(validDate(date), false)
  assert.equal(validDate('2024-02-29'), true)
  for (const value of [-1, Infinity, NaN, '', 'abc']) assert.throws(() => numberValue(value, 'Weight'))
  assert.throws(() => numberValue('2.5', 'Reps', { integer: true }))
  assert.equal(numberValue('0', 'Weight'), 0)
  assert.equal(numberValue('12.125', 'Weight'), 12.125)
  const value = workout()
  value.exercises[0].sets[0].reps = '2.1'
  assert.throws(() => normalizeWorkout(value, owner, true), /whole number/)
})

test('distinct set weights, flags and notes roundtrip; completion is atomic and legacy rows unchanged', async () => {
  const input = workout()
  const saved = await saveWorkout(owner, input, fingerprint(null), true)
  const legacy = { id: 'legacy', session_id: saved.session.id, exercise_name: 'Old press', set_weights: [40, 45], partial_reps: [8, 7], notes: 'Original' }
  await db.liftResults.put(legacy)
  const loaded = await loadWorkout(saved.session.id, owner)
  assert.deepEqual(loaded.exercises[0].sets.map(row => [row.weight_lbs, row.reps, row.notes, row.is_warmup, row.is_completed]), [[12.25, 7, 'Warmup note', true, true], [27.5, 3, 'Working note', false, false]])
  assert.equal(loaded.session.is_complete, true)
  assert.equal(loaded.exercises[0].notes, 'Exercise note')
  const changed = structuredClone(loaded)
  changed.session.note = 'Edited completed record'
  changed.exercises[0].sets[1].weight_lbs = '31.75'
  await saveWorkout(owner, changed, fingerprint(loaded), true)
  assert.deepEqual(await db.liftResults.get('legacy'), legacy)
  assert.equal((await loadWorkout(saved.session.id, owner)).exercises[0].sets[1].weight_lbs, 31.75)
  assert.equal((await queueStatus(owner)).pending, 2)
  await assert.rejects(saveWorkout(owner, loaded, fingerprint(loaded), true), /changed elsewhere/)
})

test('queue failure rolls back session, exercises, sets and draft deletion together', async () => {
  const value = workout()
  const key = `workouts/${value.session.id}`
  await saveDraft(owner, key, value, fingerprint(null))
  const original = db.syncQueue.add
  db.syncQueue.add = async () => { throw new Error('simulated queue disk failure') }
  try { await assert.rejects(saveWorkout(owner, value, fingerprint(null), true), /disk failure/) }
  finally { db.syncQueue.add = original }
  assert.equal(await db.sessions.count(), 0)
  assert.equal(await db.workoutExercises.count(), 0)
  assert.equal(await db.liftingSets.count(), 0)
  assert.ok(await loadDraft(owner, key))
})

test('raw incomplete editor draft survives database close/reopen and is account-scoped', async () => {
  const value = workout()
  value.exercises[0].sets[0].weight_lbs = ''
  const key = `workouts/${value.session.id}`
  await saveDraft(owner, key, value, fingerprint(null))
  db.close(); await db.open()
  assert.deepEqual((await loadDraft(owner, key)).value, value)
  assert.equal(await loadDraft('account-b', key), null)
  assert.equal((await queueStatus(owner)).pending, 0)
  assert.equal((await exportData(owner)).tables.syncQueue[0].entity, 'editorDraft')
})

test('version 3 history upgrades to unchanged version 4 identity without conversion', async () => {
  await db.delete()
  const old = new Dexie('sl5x5')
  old.version(3).stores({ exercises: 'id, user_id, name, [user_id+name]', sessions: 'id, user_id, date, type, is_complete', liftResults: 'id, session_id', syncQueue: '++id, entity, synced_at', runs: 'id, user_id, date', runSettings: 'id, user_id', trainingPlans: 'id, user_id, title' })
  await old.sessions.put({ id: 'old-session', user_id: owner, date: '2020-01-01', type: 'Original', is_complete: true })
  await old.liftResults.put({ id: 'old-result', session_id: 'old-session', exercise_name: 'Historical', set_weights: [15, 25], partial_reps: [5, 4] })
  old.close(); await db.open()
  assert.equal(db.name, 'sl5x5'); assert.equal(db.verno, 4)
  const value = await loadWorkout('old-session', owner)
  assert.equal(value.exercises.length, 0)
  assert.deepEqual(value.legacy[0].set_weights, [15, 25])
})

test('run, catalog and markdown CRUD validates metrics and preserves existing metadata', async () => {
  const run = await saveResource('runs', owner, { id: 'run', date: '2024-04-03', distance: '3.125', duration_seconds: '1200', temp_f: '-4', humidity: '95', notes: 'Run note', source_file: 'preserved' }, fingerprint(null))
  assert.equal(run.distance, 3.125); assert.equal(run.temp_f, -4)
  assert.equal(run.source_file, 'preserved')
  await assert.rejects(saveResource('runs', owner, { ...run, avg_hr: '4.5' }, fingerprint(run)), /whole number/)
  await assert.rejects(saveResource('runs', owner, { ...run, humidity: '101' }, fingerprint(run)), /100/)
  const plan = await saveResource('trainingPlans', owner, { id: 'plan', title: 'My plan', markdown: '# Plan\n\n- Keep **raw** text\n' }, fingerprint(null))
  assert.equal(plan.markdown, '# Plan\n\n- Keep **raw** text\n')
  await saveResource('exercises', owner, { id: 'catalog', name: 'Custom exercise' }, fingerprint(null))
  await assert.rejects(saveResource('exercises', owner, { id: 'duplicate', name: 'Custom exercise' }, fingerprint(null)), /already exists/)
  await deleteResource('runs', owner, run.id, fingerprint(run))
  assert.equal(await db.runs.get(run.id), undefined)
})

test('ownership checks isolate reads, edits, exports and local-mode queues', async () => {
  const saved = await saveWorkout(owner, workout(), fingerprint(null), true)
  await assert.rejects(loadWorkout(saved.session.id, 'account-b'), /another account/)
  const forged = structuredClone(saved); forged.session.user_id = 'account-b'
  forged.exercises.forEach(row => { row.user_id = 'account-b' })
  await assert.rejects(saveWorkout('account-b', forged, fingerprint(null), true), /another account/)
  assert.equal((await exportData('account-b')).tables.liftingSets.length, 0)
  assert.equal((await listRecords('sessions', 'account-b')).length, 0)
  await saveWorkout('local-user', workout('local-user'), fingerprint(null), false)
  assert.equal((await queueStatus('local-user')).pending, 0)
  const client = clientFor('account-b')
  await syncAccount(client, 'account-b')
  assert.equal(client.calls.filter(row => row.action !== 'select').length, 0)
  assert.equal((await queueStatus(owner)).pending, 1)
})

test('set/exercise removal and workout deletion queue explicit child-first deletes', async () => {
  const saved = await saveWorkout(owner, workout(), fingerprint(null), true)
  const changed = structuredClone(saved)
  changed.exercises[0].sets.pop()
  const next = await saveWorkout(owner, changed, fingerprint(saved), true)
  assert.equal(await db.liftingSets.count(), 1)
  const client = clientFor()
  await syncAccount(client, owner)
  assert.equal(client.remote.lifting_sets.length, 1)
  await deleteWorkout(owner, saved.session.id, fingerprint(next))
  assert.equal(await db.sessions.count(), 0)
  assert.equal(await db.liftingSets.count(), 0)
  await syncAccount(client, owner)
  assert.equal(client.remote.workout_sessions.length, 0)
  assert.equal(client.remote.workout_exercises.length, 0)
  assert.equal(client.remote.lifting_sets.length, 0)
})

test('failed sync retains durable queue and never pulls stale remote rows over writes or deletes', async () => {
  const saved = await saveWorkout(owner, workout(), fingerprint(null), true)
  const client = clientFor(owner, { workout_sessions: [{ ...saved.session, note: 'stale cloud' }] }, { fail: ({ action }) => action === 'upsert' })
  await assert.rejects(syncAccount(client, owner), /simulated failure/)
  assert.equal((await loadWorkout(saved.session.id, owner)).session.note, 'Session note')
  assert.equal((await queueStatus(owner)).pending, 1)
  await deleteWorkout(owner, saved.session.id, fingerprint(saved))
  await assert.rejects(syncAccount(client, owner), /simulated failure/)
  assert.equal(await db.sessions.get(saved.session.id), undefined)
  assert.equal((await queueStatus(owner)).pending, 2)
})

test('a local write arriving during pull prevents the entire remote snapshot from applying', async () => {
  let injected = false
  const client = clientFor(owner, { runs: [{ id: 'run', user_id: owner, date: '2024-01-01', notes: 'stale' }] }, {
    before: async ({ action, table }) => {
      if (action === 'select' && table === 'runs' && !injected) {
        injected = true
        await saveResource('runs', owner, { id: 'run', date: '2024-01-01', notes: 'new local' }, fingerprint(null))
      }
    },
  })
  const result = await syncAccount(client, owner)
  assert.match(result.message, /Pull skipped/)
  assert.equal((await db.runs.get('run')).notes, 'new local')
})

test('verified legacy queues replay without reassignment; unknown entries are retained and block pull', async () => {
  const legacy = { entity: 'run', data: JSON.stringify({ userId: owner, run: { id: 'old-run', user_id: owner, date: '2020-01-01' } }), synced_at: null }
  assert.equal(queueOwner(legacy), owner)
  assert.throws(() => queueOperations(legacy, 'account-b'), /mismatch/)
  await db.syncQueue.add(legacy)
  const client = clientFor()
  await syncAccount(client, owner)
  assert.equal(client.remote.runs[0].user_id, owner)
  assert.equal((await queueStatus(owner)).pending, 0)
  const unknownId = await db.syncQueue.add({ entity: 'unknown', data: 'not-json', synced_at: null })
  await assert.rejects(syncAccount(client, owner), /Unverified/)
  assert.ok(await db.syncQueue.get(unknownId))
  assert.equal((await queueStatus(owner)).unverified, 1)
})

test('account changes stop sync without removing pending queue entries', async () => {
  await saveWorkout(owner, workout(), fingerprint(null), true)
  let active = true
  const client = clientFor(owner, {}, { before: () => { active = false } })
  await assert.rejects(syncAccount(client, owner, () => active), /Account changed/)
  assert.equal((await queueStatus(owner)).pending, 1)
  assert.equal(client.calls.length, 1)
})

test('legacy cloud history remains accessible when optional normalized tables are unavailable', async () => {
  const client = clientFor(owner, { workout_sessions: [{ id: 'old', user_id: owner, date: '2020-01-01', type: 'Old' }], lift_results: [{ id: 'result', session_id: 'old', exercise_name: 'Legacy', partial_reps: [5, 3] }] }, {
    fail: ({ table }) => ['workout_exercises', 'lifting_sets'].includes(table), code: 'PGRST205',
  })
  const result = await syncAccount(client, owner)
  assert.match(result.message, /unavailable/)
  assert.deepEqual((await loadWorkout('old', owner)).legacy[0].partial_reps, [5, 3])
})

test('server audit defaults do not cause false editor conflicts or erase preserved metadata', async () => {
  const saved = await saveWorkout(owner, workout(), fingerprint(null), true)
  const createdAt = '2021-03-04T12:00:00+00:00'
  await db.sessions.update(saved.session.id, { seeded_at: createdAt })
  await db.workoutExercises.update(saved.exercises[0].id, { created_at: createdAt })
  const changed = structuredClone(saved)
  changed.session.note = 'Edit after sync acknowledgement'
  const next = await saveWorkout(owner, changed, fingerprint(saved), true)
  assert.equal(next.session.seeded_at, createdAt)
  assert.equal(next.exercises[0].created_at, createdAt)
  assert.equal(next.session.note, 'Edit after sync acknowledgement')
  assert.equal(fingerprint({ note: null }), fingerprint({}))
})

test('verified old normalized and legacy-array queues preserve all weights and owner relationships', async () => {
  const value = normalizeWorkout(workout(), owner, true)
  const { sets, ...exercise } = value.exercises[0]
  const oldWorkout = { entity: 'workout', data: JSON.stringify({ session: value.session, workoutExercises: [exercise], liftingSets: sets }), synced_at: null }
  await db.syncQueue.add(oldWorkout)
  const client = clientFor()
  await syncAccount(client, owner)
  assert.deepEqual(client.remote.lifting_sets.map(row => row.weight_lbs), [12.25, 27.5])
  const oldSession = { entity: 'session', data: JSON.stringify({ session: { id: 'legacy-queued-session', user_id: owner, date: '2020-01-01', type: 'Legacy' }, liftResults: [{ id: 'legacy-queued-result', session_id: 'legacy-queued-session', exercise_name: 'Old', set_weights: [30, 35] }], updatedExercises: [{ id: 'legacy-catalog', user_id: owner, name: 'Old' }] }), synced_at: null }
  await db.syncQueue.add(oldSession)
  await syncAccount(client, owner)
  assert.deepEqual((await db.liftResults.get('legacy-queued-result')).set_weights, [30, 35])
  const invalid = JSON.parse(oldWorkout.data)
  invalid.liftingSets[0].workout_exercise_id = 'other-parent'
  assert.throws(() => queueOperations({ ...oldWorkout, data: JSON.stringify(invalid) }, owner), /relationships/)
})

test('expired or absent token never reaches cloud tables or consumes the offline queue', async () => {
  await saveWorkout(owner, workout(), fingerprint(null), true)
  for (const session of [null, { user: { id: owner }, access_token: 'expired', expires_at: 1 }]) {
    const client = clientFor()
    client.auth.getSession = async () => ({ data: { session } })
    await assert.rejects(syncAccount(client, owner), /valid session/)
    assert.equal(client.calls.length, 0)
    assert.equal((await queueStatus(owner)).pending, 1)
  }
})

test('signout while awaiting auth stops requests even when auth returns the former valid session', async () => {
  await saveWorkout(owner, workout(), fingerprint(null), true)
  let active = true
  const client = clientFor()
  const getSession = client.auth.getSession
  client.auth.getSession = async () => { active = false; return getSession() }
  await assert.rejects(syncAccount(client, owner, () => active), /Account changed/)
  assert.equal(client.calls.length, 0)
  assert.equal((await queueStatus(owner)).pending, 1)
})
