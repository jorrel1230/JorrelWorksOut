import { LOCAL_USER_ID, supabase } from './supabase'
import { db } from './db'

export async function pullFromSupabase(userId) {
  if (userId === LOCAL_USER_ID) return false
  const [
    { data: exercises }, { data: sessions }, { data: liftResults },
    { data: runs }, { data: runSettings },
  ] = await Promise.all([
    supabase.from('exercises').select('*').eq('user_id', userId),
    supabase.from('workout_sessions').select('*').eq('user_id', userId),
    supabase.from('lift_results').select('*'),
    supabase.from('runs').select('*').eq('user_id', userId),
    supabase.from('run_settings').select('*').eq('user_id', userId),
  ])
  await Promise.all([
    exercises?.length   ? db.exercises.bulkPut(exercises)       : Promise.resolve(),
    sessions?.length    ? db.sessions.bulkPut(sessions)         : Promise.resolve(),
    liftResults?.length ? db.liftResults.bulkPut(liftResults)   : Promise.resolve(),
    runs?.length        ? db.runs.bulkPut(runs)                 : Promise.resolve(),
    runSettings?.length ? db.runSettings.bulkPut(runSettings)   : Promise.resolve(),
  ])
  return (exercises?.length ?? 0) > 0
}

export async function pushSession({ userId, session, liftResults, updatedExercises }) {
  if (userId === LOCAL_USER_ID) return
  if (!navigator.onLine) {
    await enqueue('session', { session, liftResults, updatedExercises })
    return
  }
  const { error: e1 } = await supabase.from('workout_sessions').upsert({ ...session, user_id: userId })
  const { error: e2 } = await supabase.from('lift_results').upsert(liftResults)
  const { error: e3 } = await supabase.from('exercises').upsert(updatedExercises)
  if (e1 || e2 || e3) {
    await enqueue('session', { session, liftResults, updatedExercises })
  }
}

export async function pushRun(userId, run) {
  if (userId === LOCAL_USER_ID) return
  if (!navigator.onLine) {
    await enqueue('run', { userId, run })
    return
  }
  const { error } = await supabase.from('runs').upsert(run)
  if (error) {
    await enqueue('run', { userId, run })
  }
}

export async function pushRunSettings(userId, settings) {
  if (userId === LOCAL_USER_ID) return
  if (!navigator.onLine) {
    await enqueue('runSettings', { userId, settings })
    return
  }
  const { error } = await supabase.from('run_settings').upsert(settings)
  if (error) {
    await enqueue('runSettings', { userId, settings })
  }
}

async function enqueue(entity, data) {
  await db.syncQueue.add({
    entity,
    data: JSON.stringify(data),
    synced_at: null,
  })
}

export async function drainSyncQueue(userId) {
  if (userId === LOCAL_USER_ID) return
  const pending = await db.syncQueue.toArray()
  for (const item of pending) {
    try {
      const data = JSON.parse(item.data)
      let failed = false
      if (item.entity === 'session') {
        const { session, liftResults, updatedExercises } = data
        const { error: e1 } = await supabase.from('workout_sessions').upsert({ ...session, user_id: userId })
        const { error: e2 } = await supabase.from('lift_results').upsert(liftResults)
        const { error: e3 } = await supabase.from('exercises').upsert(updatedExercises)
        if (e1 || e2 || e3) failed = true
      } else if (item.entity === 'run') {
        const { error } = await supabase.from('runs').upsert(data.run)
        if (error) failed = true
      } else if (item.entity === 'runSettings') {
        const { error } = await supabase.from('run_settings').upsert(data.settings)
        if (error) failed = true
      }
      if (failed) break
      await db.syncQueue.delete(item.id)
    } catch {
      break
    }
  }
}
