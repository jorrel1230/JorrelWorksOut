export const LIFT_ABBR = {
  'Squat': 'SQ',
  'Bench Press': 'BP',
  'Barbell Row': 'ROW',
  'Overhead Press': 'OHP',
  'Deadlift': 'DL',
}

export const SETS_REQUIRED = name => name === 'Deadlift' ? 1 : 5

export const WORKOUT_LIFTS = {
  A: ['Squat', 'Bench Press', 'Barbell Row'],
  B: ['Squat', 'Overhead Press', 'Deadlift'],
}

export function nextWorkoutType(lastSession) {
  if (!lastSession) return 'A'
  return lastSession.type === 'A' ? 'B' : 'A'
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
