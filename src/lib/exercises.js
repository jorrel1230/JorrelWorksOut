import { db } from './db'

/**
 * Get all unique exercise names the user has ever used, sorted alphabetically.
 * Merges names from the exercises catalog and workoutExercises history.
 */
export async function getExerciseNames(userId) {
  const catalog = await db.exercises
    .where('user_id').equals(userId)
    .toArray()

  const names = new Set(catalog.map(e => e.name))

  // Also gather names from new-format workouts
  const sessions = await db.sessions
    .where('user_id').equals(userId)
    .toArray()
  const sessionIds = new Set(sessions.map(s => s.id))

  const wes = await db.workoutExercises.toArray()
  for (const we of wes) {
    if (sessionIds.has(we.session_id)) {
      names.add(we.exercise_name)
    }
  }

  return [...names].sort()
}

/**
 * Get the last weight used for a given exercise across all workouts.
 * Checks new-format workouts first, then falls back to exercises catalog.
 */
export async function getLastWeight(userId, exerciseName) {
  const sessions = await db.sessions
    .where('user_id').equals(userId)
    .toArray()

  // Sort newest first
  sessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })

  // Check new-format workouts
  for (const session of sessions) {
    const wes = await db.workoutExercises
      .where('session_id').equals(session.id)
      .toArray()

    const match = wes.find(we => we.exercise_name === exerciseName)
    if (match) {
      const sets = await db.liftingSets
        .where('workout_exercise_id').equals(match.id)
        .toArray()

      const completedSets = sets
        .filter(s => s.is_completed)
        .sort((a, b) => a.set_number - b.set_number)

      if (completedSets.length > 0) {
        return completedSets[0].weight_lbs
      }
    }
  }

  // Check old-format lift results
  for (const session of sessions) {
    const results = await db.liftResults
      .where('session_id').equals(session.id)
      .toArray()

    const match = results.find(r => r.exercise_name === exerciseName)
    if (match) {
      return match.weight_lbs
    }
  }

  // Fall back to exercises catalog
  const ex = await db.exercises
    .where('[user_id+name]').equals([userId, exerciseName])
    .first()

  return ex?.weight_lbs ?? null
}

/**
 * Get full exercise history across all workouts (both old and new format).
 * Returns array sorted by date ascending, used for progress charts.
 */
export async function getExerciseHistory(userId, exerciseName) {
  const sessions = await db.sessions
    .where('user_id').equals(userId)
    .toArray()

  // Sort oldest first for progress charts
  sessions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })

  const history = []

  for (const session of sessions) {
    if (!session.is_complete) continue

    // Check new format first
    const wes = await db.workoutExercises
      .where('session_id').equals(session.id)
      .toArray()

    const match = wes.find(we => we.exercise_name === exerciseName)
    if (match) {
      const sets = await db.liftingSets
        .where('workout_exercise_id').equals(match.id)
        .toArray()
      sets.sort((a, b) => a.set_number - b.set_number)

      const completedSets = sets.filter(s => s.is_completed)
      if (completedSets.length > 0) {
        const maxWeight = Math.max(...completedSets.map(s => s.weight_lbs))
        history.push({
          date: session.date,
          weight: maxWeight,
          sets: completedSets.length,
          totalReps: completedSets.reduce((sum, s) => sum + (s.reps || 0), 0),
        })
      }
      continue
    }

    // Check old format
    const results = await db.liftResults
      .where('session_id').equals(session.id)
      .toArray()

    const oldMatch = results.find(r => r.exercise_name === exerciseName)
    if (oldMatch) {
      history.push({
        date: session.date,
        weight: oldMatch.weight_lbs,
        sets: oldMatch.sets_completed ?? 0,
        totalReps: (oldMatch.partial_reps || []).reduce((sum, r) => sum + r, 0),
        failed: oldMatch.failed,
      })
    }
  }

  return history
}

/**
 * Load workout detail for a session — returns exercises and sets in new format.
 * Handles both old and new data formats transparently.
 */
export async function getWorkoutDetail(sessionId) {
  // Try new format first
  const wes = await db.workoutExercises
    .where('session_id').equals(sessionId)
    .toArray()

  if (wes.length > 0) {
    wes.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

    const exercises = []
    for (const we of wes) {
      const sets = await db.liftingSets
        .where('workout_exercise_id').equals(we.id)
        .toArray()
      sets.sort((a, b) => a.set_number - b.set_number)

      exercises.push({
        id: we.id,
        name: we.exercise_name,
        position: we.position,
        notes: we.notes,
        sets: sets.map(s => ({
          id: s.id,
          setNumber: s.set_number,
          weight: s.weight_lbs,
          reps: s.reps,
          completed: s.is_completed,
          isWarmup: s.is_warmup,
        })),
      })
    }
    return { format: 'new', exercises }
  }

  // Fall back to old format
  const results = await db.liftResults
    .where('session_id').equals(sessionId)
    .toArray()

  if (results.length > 0) {
    const exercises = results.map((r, i) => ({
      id: r.id,
      name: r.exercise_name,
      position: i,
      sets: (r.partial_reps || []).map((reps, si) => ({
        id: `${r.id}-set-${si}`,
        setNumber: si + 1,
        weight: r.set_weights?.[si] ?? r.weight_lbs,
        reps,
        completed: reps > 0,
        isWarmup: false,
      })),
      failed: r.failed,
      setsRequired: r.sets_required,
      targetReps: r.target_reps,
    }))
    return { format: 'old', exercises }
  }

  return { format: 'empty', exercises: [] }
}
