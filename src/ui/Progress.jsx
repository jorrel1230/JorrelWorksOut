import { useEffect, useState } from 'react'
import { listExerciseNames, listRecords, loadWorkout } from '../lib/repository.js'
import { metrics, progressPoints } from '../lib/progress.js'

export function Progress({ userId, revision }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [metric, setMetric] = useState('volume')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [warmups, setWarmups] = useState(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [names, sessions] = await Promise.all([listExerciseNames(userId), listRecords('sessions', userId)])
        const workouts = (await Promise.all(sessions.filter(s => s.is_complete).map(s => loadWorkout(s.id, userId)))).filter(Boolean)
        if (active) { setData({ names, workouts }); setError('') }
      } catch (err) { if (active) setError(err.message) }
    }
    void load()
    return () => { active = false }
  }, [userId, revision])
  const selected = name || data?.names[0] || ''
  const invalidRange = start && end && start > end
  const points = data && selected && !invalidRange ? progressPoints(data.workouts, selected, metric, start, end, warmups) : []
  const maximum = Math.max(1, ...points.map(p => p.value ?? 0))
  return <section><h2>Progress</h2>
    <p>Explore completed workouts stored on this device. Sync from Account / data to include cloud history.</p>
    {error && <p role="alert">Could not load progress: {error}</p>}
    {!data ? !error && <p role="status">Loading history…</p> : <>
      <fieldset><legend>Explore exercise progression</legend>
        <p><label htmlFor="progress-exercise">Exercise</label>{' '}<select id="progress-exercise" value={selected} onChange={e => setName(e.target.value)}>
          {!data.names.length && <option value="">No exercises yet</option>}
          {data.names.map(n => <option key={n} value={n}>{n}</option>)}
        </select></p>
        <p><label htmlFor="progress-metric">Metric</label>{' '}<select id="progress-metric" value={metric} onChange={e => setMetric(e.target.value)}>{Object.entries(metrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></p>
        <p><label>From date <input type="date" value={start} onChange={e => setStart(e.target.value)} /></label></p>
        <p><label>Through date <input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label></p>
        <p><label><input type="checkbox" checked={warmups} onChange={e => setWarmups(e.target.checked)} /> Include warmup sets</label></p>
        <button type="button" onClick={() => { setStart(''); setEnd('') }}>All dates</button>
      </fieldset>
      <p>One point per workout. New-format history includes only sets marked completed. Imported history uses recorded reps and weights; warmups cannot be separated unless explicitly tagged. Volume is weight × reps, not a strength score. Pullup weights are shown as recorded, without inferring assistance or body weight.</p>
      {invalidRange ? <p role="alert">From date must not be after Through date.</p> : !points.length ? <p>No completed sets found for this selection.</p> : <table>
        <caption>{selected}: {metrics[metric]}. Bars share a zero baseline and scale to the highest value in this selection. Unknown values are not treated as zero.</caption>
        <thead><tr><th scope="col">Workout</th><th scope="col">Value</th><th scope="col">Bar</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.id}>
          <th scope="row"><a href={`#/workouts/${point.id}`}>{point.date}</a></th>
          <td>{point.value === null ? 'Unknown' : point.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td>{point.value !== null && <meter min="0" max={maximum} value={point.value} aria-label={`${point.date}: ${point.value} ${metrics[metric]}`}>{point.value}</meter>}</td>
        </tr>)}</tbody>
      </table>}
    </>}
  </section>
}
