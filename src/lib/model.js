export const LOCAL_USER_ID = 'local-user'
export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const newId = () => crypto.randomUUID()

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function numberValue(value, label, { integer = false, signed = false, optional = false } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (optional) return null
    throw new Error(`${label} is required.`)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || (!signed && number < 0) || (integer && !Number.isSafeInteger(number))) {
    throw new Error(`${label} must be a ${signed ? '' : 'nonnegative '}${integer ? 'whole' : 'finite'} number.`)
  }
  return number
}

export const runFields = [
  ['distance', 'Distance (miles)'], ['duration_seconds', 'Duration (seconds)', 'integer'],
  ['avg_pace', 'Average pace (minutes:seconds per mile)', 'text'], ['avg_hr', 'Average heart rate (bpm)', 'integer'],
  ['z2_time_seconds', 'Zone 2 time (seconds)', 'integer'], ['avg_cadence', 'Average cadence (steps/min)', 'integer'],
  ['elevation_gain', 'Elevation gain (ft)'], ['avg_power', 'Average power (W)', 'integer'],
  ['calories', 'Calories (kcal)', 'integer'], ['zone', 'Zone (text)', 'text'], ['weight_lbs', 'Body weight (lb)'],
  ['temp_f', 'Temperature (°F)', 'signed'], ['humidity', 'Humidity (%)'],
  ['humidex', 'Humidex', 'signed'], ['efficiency', 'Efficiency'], ['notes', 'Notes', 'textarea'],
]
export const catalogFields = [
  ['name', 'Name', 'required'], ['slug', 'Slug', 'text'], ['category', 'Category', 'text'],
  ['muscle_group', 'Muscle group', 'text'], ['equipment', 'Equipment', 'text'],
  ['weight_lbs', 'Reference weight (lb)'], ['sets_required', 'Reference set count', 'integer'],
  ['target_reps', 'Reference reps', 'integer'], ['failure_streak', 'Historical failure streak', 'integer'],
]
export const planFields = [['title', 'Title', 'required'], ['markdown', 'Raw markdown', 'requiredTextarea']]
export const resourceFields = { runs: runFields, exercises: catalogFields, trainingPlans: planFields }

export function normalizeResource(table, input, userId) {
  const fields = resourceFields[table]
  if (!fields) throw new Error('Unsupported record type.')
  const row = { ...input, user_id: userId }
  if (table === 'runs' && !validDate(row.date)) throw new Error('Enter a valid run date.')
  for (const [key, label, type] of fields) {
    const value = row[key]
    if (type === 'required' || type === 'requiredTextarea') {
      if (!String(value ?? '').trim()) throw new Error(`${label} is required.`)
      row[key] = type === 'required' ? value.trim() : value
    } else if (type === 'text' || type === 'textarea') row[key] = value || null
    else row[key] = numberValue(value, label, { integer: type === 'integer', signed: type === 'signed', optional: true })
  }
  if (table === 'runs' && row.humidity > 100) throw new Error('Humidity cannot exceed 100%.')
  if (table === 'exercises') row.updated_at = new Date().toISOString()
  return row
}

export function newWorkout(userId) {
  return {
    session: { id: newId(), user_id: userId, date: today(), type: '', note: '', is_complete: false, source: 'manual', created_at: new Date().toISOString() },
    exercises: [], legacy: [],
  }
}
export function newExercise(session) {
  return { id: newId(), session_id: session.id, user_id: session.user_id, exercise_name: '', position: 0, notes: '', created_at: new Date().toISOString(), sets: [] }
}
export function newSet(exerciseId) {
  return { id: newId(), workout_exercise_id: exerciseId, set_number: 1, weight_lbs: '', reps: '', is_warmup: false, is_completed: false, notes: '', created_at: new Date().toISOString() }
}
export function normalizeWorkout(input, userId, complete) {
  const { session, exercises } = structuredClone(input)
  if (session.user_id !== userId) throw new Error('This workout belongs to another account.')
  if (!validDate(session.date)) throw new Error('Enter a valid workout date.')
  if (!session.type.trim()) throw new Error('Workout type is required (any name).')
  session.type = session.type.trim()
  session.is_complete = complete
  if (complete && !exercises.length && !input.legacy?.length) throw new Error('Add an exercise before completing this workout.')
  const ids = new Set([session.id])
  exercises.forEach((exercise, position) => {
    if (ids.has(exercise.id) || exercise.session_id !== session.id || exercise.user_id !== userId) throw new Error('Invalid exercise identity.')
    ids.add(exercise.id)
    if (!exercise.exercise_name.trim()) throw new Error(`Exercise ${position + 1} needs a name.`)
    exercise.exercise_name = exercise.exercise_name.trim()
    exercise.position = position
    if (complete && !exercise.sets.length) throw new Error(`${exercise.exercise_name} needs at least one set.`)
    exercise.sets.forEach((set, index) => {
      if (ids.has(set.id) || set.workout_exercise_id !== exercise.id) throw new Error('Invalid set identity.')
      ids.add(set.id)
      set.set_number = index + 1
      set.weight_lbs = numberValue(set.weight_lbs, `Set ${index + 1} weight`)
      set.reps = numberValue(set.reps, `Set ${index + 1} reps`, { integer: true })
      set.is_completed = Boolean(set.is_completed)
      set.is_warmup = Boolean(set.is_warmup)
    })
  })
  return { session, exercises, legacy: input.legacy || [] }
}

// Compare record content, not server-added audit timestamps or absent-versus-null optional columns.
// This catches edits from another tab/cloud without treating a sync acknowledgement as an edit.
export function fingerprint(value) {
  function sorted(item) {
    if (Array.isArray(item)) return item.map(sorted)
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).filter(key => !['created_at', 'seeded_at', 'updated_at'].includes(key) && item[key] !== null && item[key] !== undefined).sort().map(key => [key, sorted(item[key])]))
    return item
  }
  return JSON.stringify(sorted(value ?? null))
}
