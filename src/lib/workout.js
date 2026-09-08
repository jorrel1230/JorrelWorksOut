export const LIFT_ABBR = {
  'Squat': 'SQ',
  'Bench Press': 'BP',
  'Barbell Row': 'ROW',
  'Overhead Press': 'OHP',
  'Deadlift': 'DL',
  'Dumbbell Shoulder Press': 'DSP',
  'Triceps Pushdown': 'TRI',
  'Lat Pulldown': 'LAT',
  'Pullups': 'PU',
  'Leg Curl': 'LC',
  'Leg Extension': 'LE',
  'Hip Abductor': 'HIP',
}

export const ALL_LIFTS = Object.keys(LIFT_ABBR)

export const EXERCISE_DEFAULTS = {
  'Squat': { setsRequired: 3, targetReps: 8 },
  'Bench Press': { setsRequired: 3, targetReps: 8 },
  'Barbell Row': { setsRequired: 3, targetReps: 8 },
  'Overhead Press': { setsRequired: 3, targetReps: 8 },
  'Deadlift': { setsRequired: 3, targetReps: 6 },
  'Dumbbell Shoulder Press': { setsRequired: 3, targetReps: 10 },
  'Triceps Pushdown': { setsRequired: 3, targetReps: 10 },
  'Lat Pulldown': { setsRequired: 3, targetReps: 10 },
  'Pullups': { setsRequired: 3, targetReps: 6 },
  'Leg Curl': { setsRequired: 3, targetReps: 10 },
  'Leg Extension': { setsRequired: 3, targetReps: 10 },
  'Hip Abductor': { setsRequired: 3, targetReps: 12 },
}

export const SETS_REQUIRED = name => EXERCISE_DEFAULTS[name]?.setsRequired ?? 3
export const TARGET_REPS = name => EXERCISE_DEFAULTS[name]?.targetReps ?? 8

export const WORKOUT_LIFTS = {
  Push: ['Bench Press', 'Overhead Press', 'Dumbbell Shoulder Press', 'Triceps Pushdown'],
  Pull: ['Barbell Row', 'Lat Pulldown', 'Pullups'],
  Legs: ['Squat', 'Deadlift', 'Leg Curl', 'Leg Extension', 'Hip Abductor'],
  Imported: ALL_LIFTS,
}

export const WORKOUT_ORDER = ['Push', 'Pull', 'Legs']

export function nextWorkoutType(lastSession) {
  if (!lastSession || !WORKOUT_ORDER.includes(lastSession.type)) return 'Push'
  const idx = WORKOUT_ORDER.indexOf(lastSession.type)
  return WORKOUT_ORDER[(idx + 1) % WORKOUT_ORDER.length]
}

// Sort sessions newest-first, using created_at as tiebreaker for same-date sessions
export function sortSessionsDesc(sessions) {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1
  })
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}
