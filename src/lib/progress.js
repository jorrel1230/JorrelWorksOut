export const metrics = {
  volume: 'Volume (lb × reps)', weight: 'Highest weight (lb)', reps: 'Total reps', sets: 'Sets performed',
}
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null
export function progressPoints(workouts, name, metric, start = '', end = '', includeWarmups = false) {
  const points = []
  for (const { session, exercises, legacy } of workouts) {
    if (!session.is_complete || (start && session.date < start) || (end && session.date > end)) continue
    const values = []
    // Both formats may coexist in one session; neither replaces the other.
    for (const exercise of exercises) {
      if (exercise.exercise_name?.trim().toLowerCase() !== name.trim().toLowerCase()) continue
      const sets = exercise.sets.filter(set => set.is_completed && (includeWarmups || !set.is_warmup))
      if (!sets.length) continue
      if (metric === 'sets') values.push(sets.length)
      else for (const set of sets) {
        const weight = numeric(set.weight_lbs), reps = numeric(set.reps)
        values.push(metric === 'weight' ? weight : metric === 'reps' ? reps : weight !== null && reps !== null ? weight * reps : null)
      }
    }
    for (const row of legacy) {
      if (row.exercise_name?.trim().toLowerCase() !== name.trim().toLowerCase()) continue
      const reps = Array.isArray(row.partial_reps) ? row.partial_reps.map(numeric) : []
      const weights = Array.isArray(row.set_weights) ? row.set_weights.map(numeric) : []
      if (metric === 'sets') values.push(reps.length || numeric(row.sets_completed))
      else if (metric === 'reps') values.push(reps.length && reps.every(n => n !== null) ? reps.reduce((a, b) => a + b, 0) : numeric(row.total_reps))
      else if (metric === 'weight') values.push(weights.length && weights.every(n => n !== null) ? Math.max(...weights) : numeric(row.weight_lbs))
      else {
        const products = reps.map((rep, i) => {
          const weight = weights.length === 1 ? weights[0] : weights.length ? weights[i] : numeric(row.weight_lbs)
          return rep !== null && weight != null ? rep * weight : null
        })
        values.push(products.length && products.every(n => n !== null) ? products.reduce((a, b) => a + b, 0) : numeric(row.volume_lbs))
      }
    }
    if (values.length) points.push({ id: session.id, date: session.date, value: values.some(n => n === null) ? null : metric === 'weight' ? Math.max(...values) : values.reduce((a, b) => a + b, 0) })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
