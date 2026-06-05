// Returns { newWeight, newStreak, deloaded }
export function computeProgression(weightLbs, failureStreak, failed) {
  if (!failed) {
    return { newWeight: weightLbs + 5, newStreak: 0, deloaded: false }
  }

  const newStreak = failureStreak + 1

  if (newStreak >= 3) {
    const newWeight = Math.floor(weightLbs * 0.9 / 2.5) * 2.5
    return { newWeight, newStreak: 0, deloaded: true }
  }

  return { newWeight: weightLbs, newStreak, deloaded: false }
}
