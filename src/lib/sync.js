import { db } from './db.js'
import { LOCAL_USER_ID } from './model.js'
import { hasValidSession } from './accountAccess.js'
import { cloudTables, queueOwner, transaction } from './repository.js'

function legacyOperations(item, userId) {
  const data = JSON.parse(item.data)
  const operations = []
  const add = (table, rows) => {
    if (!Array.isArray(rows)) throw new Error('Legacy queue payload is incomplete; retained for recovery.')
    for (const row of rows) {
      if (!row?.id) throw new Error('Invalid legacy record; retained for recovery.')
      operations.push({ table, action: 'upsert', row })
    }
  }
  if (item.entity === 'workout' || item.entity === 'session') {
    if (data.session?.user_id !== userId) throw new Error('Legacy workout ownership is unverified; retained.')
    add('sessions', [data.session])
    if (item.entity === 'workout') {
      add('workoutExercises', data.workoutExercises)
      add('liftingSets', data.liftingSets)
      const ids = new Set(data.workoutExercises.map(row => row.id))
      if (data.workoutExercises.some(row => row.user_id !== userId || row.session_id !== data.session.id) || data.liftingSets.some(row => !ids.has(row.workout_exercise_id))) throw new Error('Legacy workout relationships are unverified; retained.')
    } else {
      add('liftResults', data.liftResults)
      add('exercises', data.updatedExercises)
      if (data.liftResults.some(row => row.session_id !== data.session.id) || data.updatedExercises.some(row => row.user_id !== userId)) throw new Error('Legacy session relationships are unverified; retained.')
    }
  } else if (item.entity === 'run') add('runs', [data.run])
  else if (item.entity === 'runSettings') add('runSettings', [data.settings])
  else throw new Error('Unknown queue entry retained; cloud pull paused to protect local data.')
  return operations
}

export function queueOperations(item, userId) {
  if (queueOwner(item) !== userId) throw new Error('Queue ownership mismatch.')
  let operations
  if (item.entity === 'mutation') {
    const data = JSON.parse(item.data)
    if (data.version !== 1 || !Array.isArray(data.operations)) throw new Error('Unknown mutation version; retained.')
    operations = data.operations
  } else operations = legacyOperations(item, userId)
  for (const op of operations) {
    if (!cloudTables[op.table] || !['upsert', 'delete'].includes(op.action)) throw new Error('Invalid queued operation; retained.')
    if (op.action === 'upsert') {
      if (!op.row?.id || (['sessions', 'exercises', 'workoutExercises', 'runs', 'runSettings', 'trainingPlans'].includes(op.table) && op.row.user_id !== userId)) throw new Error('Unverified queued row ownership; retained.')
    } else if (!op.id) throw new Error('Invalid queued deletion; retained.')
  }
  return operations
}
export async function queueStatus(userId) {
  const items = (await db.syncQueue.toArray()).filter(row => row.entity !== 'editorDraft' && !row.synced_at)
  return { pending: items.filter(row => queueOwner(row) === userId).length, unverified: items.filter(row => !queueOwner(row)).length }
}
async function assertSession(client, userId) {
  const { data, error } = await client.auth.getSession()
  if (error || !hasValidSession(data.session, userId)) throw new Error('A valid session for this account is required. Sign in to sync; local data is retained.')
}
async function fetchRows(client, table, userId, owned, checkAccount) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    await checkAccount()
    let query = client.from(table).select('*').order('id').range(offset, offset + 499)
    if (owned) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw Object.assign(new Error(`${table}: ${error.message}`), { code: error.code })
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

let running = null
export async function syncAccount(client, userId, isCurrent = () => true) {
  if (userId === LOCAL_USER_ID) return { message: 'Local mode: data stays on this device.' }
  // Serialize drains across tabs as well as within a tab, without changing the database schema.
  if (globalThis.navigator?.locks) {
    return navigator.locks.request('jorrelworksout-cloud-sync', { ifAvailable: true }, lock => lock
      ? syncUnlocked(client, userId, isCurrent)
      : { message: 'Sync is running in another tab. Retry shortly.' })
  }
  return syncUnlocked(client, userId, isCurrent)
}
async function syncUnlocked(client, userId, isCurrent) {
  if (running) return { message: 'Sync already running. Retry after it finishes.' }
  running = userId
  const checkAccount = async () => {
    if (!isCurrent()) throw new Error('Account changed. Sync stopped; local data is retained.')
    await assertSession(client, userId)
    if (!isCurrent()) throw new Error('Account changed. Sync stopped; local data is retained.')
  }
  try {
    await checkAccount()
    const pending = (await db.syncQueue.toArray()).filter(row => row.entity !== 'editorDraft' && !row.synced_at)
    // No inferred ownership: an old ambiguous entry may contain a deletion or unsent history.
    if (pending.some(row => !queueOwner(row))) throw new Error('Unverified old queue entries retained. Sync paused; export/recover them before resolving ownership.')
    for (const item of pending.filter(row => queueOwner(row) === userId)) {
      for (const operation of queueOperations(item, userId)) {
        await checkAccount()
        let request
        if (operation.action === 'upsert') request = client.from(cloudTables[operation.table]).upsert(operation.row)
        else {
          request = client.from(cloudTables[operation.table]).delete().eq('id', operation.id)
          if (['exercises', 'sessions', 'workoutExercises', 'runs', 'runSettings', 'trainingPlans'].includes(operation.table)) request = request.eq('user_id', userId)
        }
        const { error } = await request
        if (error) throw new Error(`${cloudTables[operation.table]}: ${error.message}. Local queue retained for retry.`)
      }
      await db.syncQueue.delete(item.id)
    }
    await checkAccount()
    const incoming = {}
    const unavailable = []
    // Older cloud deployments can still provide legacy history without applying a migration.
    for (const [local, remote] of Object.entries(cloudTables)) {
      try {
        incoming[local] = await fetchRows(client, remote, userId, !['liftResults', 'liftingSets'].includes(local), checkAccount)
      } catch (error) {
        if (['workoutExercises', 'liftingSets'].includes(local) && ['42P01', 'PGRST205'].includes(error.code)) {
          incoming[local] = []
          unavailable.push(remote)
        } else throw error
      }
    }
    await checkAccount()
    const sessionIds = new Set(incoming.sessions.filter(row => row.user_id === userId).map(row => row.id))
    incoming.workoutExercises = incoming.workoutExercises.filter(row => sessionIds.has(row.session_id) && row.user_id === userId)
    const exerciseIds = new Set(incoming.workoutExercises.map(row => row.id))
    incoming.liftResults = incoming.liftResults.filter(row => sessionIds.has(row.session_id))
    incoming.liftingSets = incoming.liftingSets.filter(row => exerciseIds.has(row.workout_exercise_id))
    return await transaction(async () => {
      if (!isCurrent()) throw new Error('Account changed. Pull cancelled.')
      const status = await queueStatus(userId)
      if (status.pending || status.unverified) return { message: 'New local changes arrived during sync. Pull skipped; retry to send them.' }
      for (const [table, rows] of Object.entries(incoming)) {
        for (const row of rows) {
          if (row.user_id && row.user_id !== userId) continue
          const existing = await db[table].get(row.id)
          if (existing?.user_id && existing.user_id !== userId) throw new Error('Cloud ID conflicts with another local account. Pull cancelled.')
          if (existing && table === 'liftResults' && existing.session_id !== row.session_id) throw new Error('Legacy parent conflict. Pull cancelled.')
          if (existing && table === 'liftingSets' && existing.workout_exercise_id !== row.workout_exercise_id) throw new Error('Set parent conflict. Pull cancelled.')
          await db[table].put(row)
        }
      }
      return { message: `Synced ${new Date().toLocaleString()}. Local drafts are retained.${unavailable.length ? ` Cloud tables unavailable: ${unavailable.join(', ')}. Normalized workouts remain usable locally; cloud writes to those tables will stay queued.` : ''}` }
    })
  } finally { running = null }
}

export async function readImportBatches(client, userId, isCurrent = () => true) {
  if (userId === LOCAL_USER_ID) return []
  const checkAccount = async () => {
    if (!isCurrent()) throw new Error('Account changed. Audit request stopped.')
    await assertSession(client, userId)
    if (!isCurrent()) throw new Error('Account changed. Audit request stopped.')
  }
  return fetchRows(client, 'import_batches', userId, true, checkAccount)
}
