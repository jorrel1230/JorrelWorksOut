import fs from 'node:fs'
import path from 'node:path'

const notesRoot = process.argv[2] ?? '/Users/jorrel/notes/Fitness/Exercise'
const outFile = process.argv[3] ?? path.resolve('src/data/seedData.js')

const liftNameByFile = {
  backsquat: 'Squat',
  barbellrow: 'Barbell Row',
  benchpress: 'Bench Press',
  deadlift: 'Deadlift',
  dumbellshoulderpress: 'Dumbbell Shoulder Press',
  hipabductor: 'Hip Abductor',
  latpulldown: 'Lat Pulldown',
  legcurl: 'Leg Curl',
  legextension: 'Leg Extension',
  overheadpress: 'Overhead Press',
  pullups: 'Pullups',
  tricepspushdown: 'Triceps Pushdown',
}

const exerciseDefaults = {
  'Squat': { category: 'lifting', muscle_group: 'legs', equipment: 'barbell', sets_required: 3, target_reps: 8 },
  'Bench Press': { category: 'lifting', muscle_group: 'push', equipment: 'barbell', sets_required: 3, target_reps: 8 },
  'Barbell Row': { category: 'lifting', muscle_group: 'pull', equipment: 'barbell', sets_required: 3, target_reps: 8 },
  'Overhead Press': { category: 'lifting', muscle_group: 'push', equipment: 'barbell', sets_required: 3, target_reps: 8 },
  'Deadlift': { category: 'lifting', muscle_group: 'legs', equipment: 'barbell', sets_required: 3, target_reps: 6 },
  'Dumbbell Shoulder Press': { category: 'lifting', muscle_group: 'push', equipment: 'dumbbell', sets_required: 3, target_reps: 10 },
  'Hip Abductor': { category: 'lifting', muscle_group: 'legs', equipment: 'machine', sets_required: 3, target_reps: 12 },
  'Lat Pulldown': { category: 'lifting', muscle_group: 'pull', equipment: 'machine', sets_required: 3, target_reps: 10 },
  'Leg Curl': { category: 'lifting', muscle_group: 'legs', equipment: 'machine', sets_required: 3, target_reps: 10 },
  'Leg Extension': { category: 'lifting', muscle_group: 'legs', equipment: 'machine', sets_required: 3, target_reps: 10 },
  'Pullups': { category: 'lifting', muscle_group: 'pull', equipment: 'bodyweight/assisted', sets_required: 3, target_reps: 6 },
  'Triceps Pushdown': { category: 'lifting', muscle_group: 'push', equipment: 'cable', sets_required: 3, target_reps: 10 },
}

const month = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 }

function clean(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/[⚠️⬇️]/g, '')
    .trim()
}

function slugify(s) {
  return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseDate(value) {
  const s = clean(value)
  const iso = s.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const md = s.match(/^([A-Za-z]+)\s+(\d{1,2})/)
  if (!md) return null
  const m = month[md[1].toLowerCase()]
  if (!m) return null
  return `2026-${String(m).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`
}

function parseMarkdownTableRows(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && line.endsWith('|'))
    .map(line => line.slice(1, -1).split('|').map(clean))
    .filter(cols => cols.length > 1 && !cols.every(c => /^-+$/.test(c.replace(/\s/g, ''))))
}

function parseNumber(value) {
  const s = clean(value).replace(/,/g, '')
  if (!s || /^n\/?a$/i.test(s) || s === '—') return null
  const match = s.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function parseWeights(value) {
  const s = clean(value).replace(/,/g, '')
  if (!s || /^n\/?a$/i.test(s) || s === '—') return []
  return s.split('-').map(parseNumber).filter(n => n != null)
}

function parseReps(value) {
  const s = clean(value)
  const inside = s.match(/\[(.*?)\]/)?.[1] ?? s
  return inside.split(',').map(v => parseInt(v.trim(), 10)).filter(n => Number.isFinite(n))
}

function bestWeight(weights) {
  return weights.length ? Math.max(...weights) : null
}

function calcVolume(weights, reps) {
  if (!weights.length || !reps.length) return null
  if (weights.length === reps.length) return weights.reduce((sum, w, i) => sum + w * reps[i], 0)
  return weights[0] * reps.reduce((a, b) => a + b, 0)
}

function secondsFromPace(pace, miles) {
  const m = String(pace ?? '').match(/(\d+):(\d{2})/)
  if (!m || miles == null) return null
  return Math.round((Number(m[1]) * 60 + Number(m[2])) * miles)
}

function parseDuration(value, miles, pace) {
  const s = clean(value)
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (hms) return Number(hms[1]) * (hms[3] ? 3600 : 60) + Number(hms[2]) * (hms[3] ? 60 : 1) + (Number(hms[3]) || 0)
  const min = s.match(/(\d+(?:\.\d+)?)\s*min/i)
  if (min) return Math.round(Number(min[1]) * 60)
  return secondsFromPace(pace, miles)
}

function parseLifting() {
  const liftingDir = path.join(notesRoot, 'Lifting')
  const sessionsByDate = new Map()
  const resultRows = []
  const currentByExercise = new Map()

  for (const file of fs.readdirSync(liftingDir).filter(f => f.endsWith('.md')).sort()) {
    const key = path.basename(file, '.md')
    const exerciseName = liftNameByFile[key] ?? key
    const rows = parseMarkdownTableRows(fs.readFileSync(path.join(liftingDir, file), 'utf8'))
    const header = rows.shift()
    if (!header || !/^date$/i.test(header[0] ?? '')) continue

    for (const cols of rows) {
      const [dateRaw, weightRaw, setsRaw, repsRaw, totalRaw, volumeRaw, notesRaw] = cols
      const date = parseDate(dateRaw)
      const reps = parseReps(repsRaw)
      if (!date || reps.length === 0) continue
      const weights = parseWeights(weightRaw)
      const weight = bestWeight(weights)
      const setsRequired = parseNumber(setsRaw) ?? reps.length
      const totalReps = parseNumber(totalRaw) ?? reps.reduce((a, b) => a + b, 0)
      const volume = parseNumber(volumeRaw) ?? calcVolume(weights, reps)
      const notes = clean(notesRaw)
      const failed = /fail/i.test(notes)
      const sessionId = `seed-lift-session-${date}`

      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, {
          id: sessionId,
          date,
          type: 'Imported',
          is_complete: true,
          note: 'Imported from markdown lifting notes.',
          created_at: `${date}T12:00:00.000Z`,
          source: 'markdown_import',
        })
      }

      resultRows.push({
        id: `seed-lift-result-${slugify(exerciseName)}-${date}-${resultRows.length}`,
        session_id: sessionId,
        exercise_name: exerciseName,
        weight_lbs: weight,
        set_weights: weights,
        sets_required: setsRequired,
        sets_completed: reps.length,
        partial_reps: reps,
        total_reps: totalReps,
        volume_lbs: volume,
        failed,
        notes: notes || null,
        source_file: `Exercise/Lifting/${file}`,
      })

      if (weight != null) currentByExercise.set(exerciseName, { weight_lbs: weight, updated_at: `${date}T12:00:00.000Z` })
    }
  }

  return { sessions: [...sessionsByDate.values()], results: resultRows, currentByExercise }
}

function parseRuns() {
  const runningDir = path.join(notesRoot, 'Running')
  if (!fs.existsSync(runningDir)) return []
  const runs = []
  for (const file of fs.readdirSync(runningDir).filter(f => f.endsWith('.md')).sort()) {
    const rows = parseMarkdownTableRows(fs.readFileSync(path.join(runningDir, file), 'utf8'))
    const header = rows.shift()
    if (!header || !header.map(h => h.toLowerCase()).includes('miles')) continue
    for (const cols of rows) {
      const date = parseDate(cols[0])
      if (!date) continue
      const miles = parseNumber(cols[1])
      const pace = clean(cols[2]) || null
      const durationSeconds = parseDuration(cols[5], miles, pace)
      const humidityNum = parseNumber(cols[8])
      runs.push({
        id: `seed-run-${date}`,
        date,
        distance: miles,
        duration_seconds: durationSeconds,
        avg_pace: pace,
        avg_hr: parseNumber(cols[3]),
        zone: clean(cols[4]) || null,
        weight_lbs: parseNumber(cols[6]),
        temp_f: parseNumber(cols[7]),
        humidity: humidityNum,
        humidex: parseNumber(cols[9]),
        efficiency: parseNumber(cols[10]),
        notes: clean(cols[0]).includes('continuous') ? 'First continuous run marker from markdown import.' : null,
        created_at: `${date}T08:00:00.000Z`,
        source_file: `Exercise/Running/${file}`,
      })
    }
  }
  return runs
}

function parseTrainingPlans() {
  const plansDir = path.join(notesRoot, 'TrainingPlans')
  if (!fs.existsSync(plansDir)) return []
  return fs.readdirSync(plansDir).filter(f => f.endsWith('.md')).sort().map(file => ({
    id: `seed-plan-${slugify(path.basename(file, '.md'))}`,
    title: path.basename(file, '.md'),
    markdown: fs.readFileSync(path.join(plansDir, file), 'utf8'),
    source_file: `Exercise/TrainingPlans/${file}`,
  }))
}

const { sessions, results, currentByExercise } = parseLifting()
const runs = parseRuns()
const trainingPlans = parseTrainingPlans()

const exercises = Object.entries(exerciseDefaults).map(([name, defaults]) => {
  const cur = currentByExercise.get(name)
  return {
    id: `seed-exercise-${slugify(name)}`,
    name,
    slug: slugify(name),
    ...defaults,
    weight_lbs: cur?.weight_lbs ?? 45,
    failure_streak: 0,
    updated_at: cur?.updated_at ?? '2026-06-01T12:00:00.000Z',
  }
})

const runSettings = {
  id: 'seed-run-settings-default',
  hr_zones: [
    { name: 'Easy', min: 0, max: 154 },
    { name: 'Moderate', min: 155, max: 170 },
    { name: 'Hard', min: 171, max: 999 },
  ],
  created_at: new Date().toISOString(),
}

const content = `// Generated by scripts/import-notes.mjs from ${notesRoot}\n// Do not edit by hand; update markdown notes and rerun the script.\n\nexport const SEED_EXERCISES = ${JSON.stringify(exercises, null, 2)}\n\nexport const SEED_SESSIONS = ${JSON.stringify(sessions, null, 2)}\n\nexport const SEED_LIFT_RESULTS = ${JSON.stringify(results, null, 2)}\n\nexport const SEED_RUNS = ${JSON.stringify(runs, null, 2)}\n\nexport const SEED_RUN_SETTINGS = ${JSON.stringify(runSettings, null, 2)}\n\nexport const SEED_TRAINING_PLANS = ${JSON.stringify(trainingPlans, null, 2)}\n`

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, content)
console.log(`Wrote ${outFile}`)
console.log(`${exercises.length} exercises, ${sessions.length} lift sessions, ${results.length} lift results, ${runs.length} runs, ${trainingPlans.length} plans`)
