const sameName = (a, b) => a?.trim().toLowerCase() === b?.trim().toLowerCase()

// Do not infer missing reps, weight, assistance, or completion from a planned set.
export function recentExerciseHistory(workouts, name, currentId, throughDate, limit = 5) {
  if (!name.trim()) return []
  return workouts.filter(({ session }) => session.is_complete && session.id !== currentId && (!throughDate || session.date <= throughDate))
    .map(({ session, exercises, legacy }) => {
      const entries = exercises.filter(row => sameName(row.exercise_name, name)).map(row => ({
        id: row.id,
        notes: row.notes,
        sets: row.sets.filter(set => set.is_completed).map(set => ({
          weight: set.weight_lbs, reps: set.reps, warmup: set.is_warmup, notes: set.notes,
        })),
      })).filter(row => row.sets.length)
      for (const row of legacy.filter(row => sameName(row.exercise_name, name))) {
        const reps = Array.isArray(row.partial_reps) ? row.partial_reps : []
        const weights = Array.isArray(row.set_weights) ? row.set_weights : []
        const count = Math.max(reps.length, weights.length, Number(row.sets_completed) || 0)
        entries.push({ id: row.id, notes: row.notes, legacy: true, sets: Array.from({ length: count }, (_, index) => ({
          weight: weights.length === 1 ? weights[0] : weights.length ? weights[index] : row.weight_lbs,
          reps: reps[index],
        })) })
      }
      return { id: session.id, date: session.date, notes: session.note, entries }
    }).filter(row => row.entries.length)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, limit)
}
