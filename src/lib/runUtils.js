export const DEFAULT_HR_ZONES = [
  { name: 'Z1', min: 0,   max: 115 },
  { name: 'Z2', min: 116, max: 130 },
  { name: 'Z3', min: 131, max: 145 },
  { name: 'Z4', min: 146, max: 160 },
  { name: 'Z5', min: 161, max: 999 },
]

export function formatDuration(seconds) {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseDuration(str) {
  if (!str?.trim()) return null
  const parts = str.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function formatPace(str) {
  if (!str) return '—'
  return `${str} /mi`
}

export function paceToSeconds(str) {
  if (!str?.trim()) return null
  const parts = str.trim().split(':').map(Number)
  if (parts.length !== 2 || parts.some(isNaN)) return null
  return parts[0] * 60 + parts[1]
}


export function getZoneForHR(hr, zones) {
  if (!hr || !zones?.length) return null
  return zones.find(z => hr >= (z.min ?? 0) && hr <= (z.max ?? Infinity))?.name ?? null
}
