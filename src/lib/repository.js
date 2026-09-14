import { db } from './db.js'
import { LOCAL_USER_ID, fingerprint, normalizeWorkout, normalizeResource } from './model.js'

export const cloudTables = {
  exercises: 'exercises', sessions: 'workout_sessions', liftResults: 'lift_results',
  workoutExercises: 'workout_exercises', liftingSets: 'lifting_sets', runs: 'runs',
  runSettings: 'run_settings', trainingPlans: 'training_plans',
}
const tables = () => [...Object.keys(cloudTables).map(name => db[name]), db.syncQueue]
export function transaction(work) { return db.transaction('rw', tables(), work) }
const upsert = (table, row) => ({ table, action: 'upsert', row })
const remove = (table, id) => ({ table, action: 'delete', id })
function preserveAudit(row, current) {
  const result = { ...current, ...row }
  for (const key of ['created_at', 'seeded_at']) if (current?.[key] !== undefined) result[key] = current[key]
  return result
}

async function enqueue(userId, operations) {
  if (userId !== LOCAL_USER_ID && operations.length) {
    await db.syncQueue.add({ entity: 'mutation', user_id: userId, data: JSON.stringify({ version: 1, operations }), synced_at: null })
  }
}
function assertOwner(row, userId) {
  if (row && row.user_id !== userId) throw new Error('Record belongs to another account.')
}
function assertUnchanged(current, base) {
  if (fingerprint(current) !== base) throw new Error('This record changed elsewhere. Your draft is safe. Export it or discard it and reload before editing again.')
}

export async function listRecords(table, userId) {
  if (!['sessions', 'runs', 'exercises', 'trainingPlans', 'runSettings'].includes(table)) throw new Error('Unsupported list.')
  return db[table].where('user_id').equals(userId).toArray()
}
export async function loadWorkout(id, userId) {
  const session = await db.sessions.get(id)
  if (!session) return null
  assertOwner(session, userId)
  const exercises = await db.workoutExercises.where('session_id').equals(id).sortBy('position')
  for (const exercise of exercises) {
    assertOwner(exercise, userId)
    exercise.sets = await db.liftingSets.where('workout_exercise_id').equals(exercise.id).sortBy('set_number')
  }
  const legacy = await db.liftResults.where('session_id').equals(id).sortBy('id')
  return { session, exercises, legacy }
}
export async function loadResource(table, id, userId) {
  if (!['runs', 'exercises', 'trainingPlans'].includes(table)) throw new Error('Unsupported record.')
  const row = await db[table].get(id)
  assertOwner(row, userId)
  return row || null
}

// Editor snapshots live in the existing flexible queue store, never in cloud tables.
// Keeping invalid intermediate input here allows reload recovery without changing any schema.
export async function loadDraft(userId, key) {
  return (await db.syncQueue.where('entity').equals('editorDraft').toArray()).find(row => row.user_id === userId && row.key === key) || null
}
export async function saveDraft(userId, key, value, base) {
  await db.transaction('rw', db.syncQueue, async () => {
    const existing = await loadDraft(userId, key)
    await db.syncQueue.put({ ...(existing || {}), entity: 'editorDraft', user_id: userId, key, value, base, saved_at: new Date().toISOString(), synced_at: null })
  })
}
export async function discardDraft(userId, key) {
  const draft = await loadDraft(userId, key)
  if (draft) await db.syncQueue.delete(draft.id)
}
export async function listDrafts(userId) {
  return (await db.syncQueue.where('entity').equals('editorDraft').toArray()).filter(row => row.user_id === userId)
}

export async function saveWorkout(userId, input, base, complete) {
  const value = normalizeWorkout(input, userId, complete)
  return transaction(async () => {
    const current = await loadWorkout(value.session.id, userId)
    assertUnchanged(current, base)
    value.session = preserveAudit(value.session, current?.session)
    const operations = [upsert('sessions', value.session)]
    const nextExerciseIds = new Set(value.exercises.map(row => row.id))
    const nextSetIds = new Set(value.exercises.flatMap(row => row.sets.map(set => set.id)))
    for (const exercise of current?.exercises || []) {
      for (const set of exercise.sets) if (!nextSetIds.has(set.id)) operations.push(remove('liftingSets', set.id))
      if (!nextExerciseIds.has(exercise.id)) operations.push(remove('workoutExercises', exercise.id))
    }
    for (const exercise of value.exercises) {
      const { sets, ...row } = exercise
      const existing = await db.workoutExercises.get(row.id)
      if (existing && existing.session_id !== value.session.id) throw new Error('Exercise ID already exists in another workout.')
      operations.push(upsert('workoutExercises', preserveAudit(row, existing)))
      for (const set of sets) {
        const existingSet = await db.liftingSets.get(set.id)
        if (existingSet && existingSet.workout_exercise_id !== row.id) throw new Error('Set ID already exists in another exercise.')
        operations.push(upsert('liftingSets', preserveAudit(set, existingSet)))
      }
    }
    await applyOperations(operations)
    await enqueue(userId, operations)
    await discardDraft(userId, `workouts/${value.session.id}`)
    return loadWorkout(value.session.id, userId)
  })
}
export async function deleteWorkout(userId, id, base) {
  return transaction(async () => {
    const current = await loadWorkout(id, userId)
    assertUnchanged(current, base)
    if (!current) { await discardDraft(userId, `workouts/${id}`); return }
    const operations = []
    for (const exercise of current.exercises) {
      for (const set of exercise.sets) operations.push(remove('liftingSets', set.id))
      operations.push(remove('workoutExercises', exercise.id))
    }
    for (const row of current.legacy) operations.push(remove('liftResults', row.id))
    operations.push(remove('sessions', id))
    await applyOperations(operations)
    await enqueue(userId, operations)
    await discardDraft(userId, `workouts/${id}`)
  })
}
export async function saveResource(table, userId, input, base) {
  const row = normalizeResource(table, input, userId)
  return transaction(async () => {
    const current = await loadResource(table, row.id, userId)
    assertUnchanged(current, base)
    if (table === 'exercises') {
      const sameName = await db.exercises.where('[user_id+name]').equals([userId, row.name]).first()
      if (sameName && sameName.id !== row.id) throw new Error('An exercise with that name already exists.')
    }
    const saved = preserveAudit(row, current)
    const operations = [upsert(table, saved)]
    await applyOperations(operations)
    await enqueue(userId, operations)
    await discardDraft(userId, `${table}/${row.id}`)
    return saved
  })
}
export async function deleteResource(table, userId, id, base) {
  return transaction(async () => {
    const current = await loadResource(table, id, userId)
    assertUnchanged(current, base)
    if (!current) { await discardDraft(userId, `${table}/${id}`); return }
    const operations = [remove(table, id)]
    await applyOperations(operations)
    await enqueue(userId, operations)
    await discardDraft(userId, `${table}/${id}`)
  })
}
async function applyOperations(operations) {
  for (const operation of operations) {
    if (operation.action === 'delete') await db[operation.table].delete(operation.id)
    else await db[operation.table].put(operation.row)
  }
}

export async function exportData(userId) {
  return db.transaction('r', tables(), async () => {
    const result = { format: 'JorrelWorksOut-export-v1', exported_at: new Date().toISOString(), user_id: userId, tables: {} }
    for (const table of ['exercises', 'sessions', 'runs', 'runSettings', 'trainingPlans']) {
      result.tables[table] = await listRecords(table, userId)
    }
    const sessionIds = result.tables.sessions.map(row => row.id)
    result.tables.liftResults = await db.liftResults.where('session_id').anyOf(sessionIds).toArray()
    result.tables.workoutExercises = (await db.workoutExercises.where('session_id').anyOf(sessionIds).toArray()).filter(row => row.user_id === userId)
    result.tables.liftingSets = await db.liftingSets.where('workout_exercise_id').anyOf(result.tables.workoutExercises.map(row => row.id)).toArray()
    // Ambiguous legacy queue entries are deliberately excluded from account exports.
    result.tables.syncQueue = (await db.syncQueue.toArray()).filter(row => queueOwner(row) === userId)
    return result
  })
}
export function queueOwner(item) {
  if (item.user_id) return item.user_id
  try {
    const data = JSON.parse(item.data)
    const owners = [data.userId, data.session?.user_id, data.run?.user_id, data.settings?.user_id,
      ...(data.updatedExercises || []).map(row => row.user_id), ...(data.workoutExercises || []).map(row => row.user_id)].filter(Boolean)
    return owners.length && owners.every(owner => owner === owners[0]) ? owners[0] : null
  } catch { return null }
}
