import { supabase } from './supabase'
import { db } from './db'

export async function pullFromSupabase(userId) {
  const [{ data: exercises }, { data: sessions }, { data: liftResults }] = await Promise.all([
    supabase.from('exercises').select('*').eq('user_id', userId),
    supabase.from('workout_sessions').select('*').eq('user_id', userId),
    supabase.from('lift_results').select('*'),
  ])
  await Promise.all([
    exercises?.length   ? db.exercises.bulkPut(exercises)     : Promise.resolve(),
    sessions?.length    ? db.sessions.bulkPut(sessions)       : Promise.resolve(),
    liftResults?.length ? db.liftResults.bulkPut(liftResults) : Promise.resolve(),
  ])
  return (exercises?.length ?? 0) > 0
}

export async function pushSession({ userId, session, liftResults, updatedExercises }) {
  if (!navigator.onLine) {
    await enqueue({ session, liftResults, updatedExercises })
    return
  }
  try {
    await supabase.from('workout_sessions').upsert({ ...session, user_id: userId })
    await supabase.from('lift_results').upsert(liftResults)
    await supabase.from('exercises').upsert(updatedExercises)
  } catch (_) {
    await enqueue({ session, liftResults, updatedExercises })
  }
}

async function enqueue(data) {
  await db.syncQueue.add({
    entity: 'session',
    data: JSON.stringify(data),
    synced_at: null,
  })
}

export async function drainSyncQueue(userId) {
  const pending = await db.syncQueue.toArray()
  for (const item of pending) {
    try {
      const { session, liftResults, updatedExercises } = JSON.parse(item.data)
      await supabase.from('workout_sessions').upsert({ ...session, user_id: userId })
      await supabase.from('lift_results').upsert(liftResults)
      await supabase.from('exercises').upsert(updatedExercises)
      await db.syncQueue.delete(item.id)
    } catch (_) {
      break // stop on first failure, retry next time we come online
    }
  }
}
