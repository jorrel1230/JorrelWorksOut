import { useEffect, useState } from 'react'
import { deleteResource, listDrafts, listRecords, loadResource, saveDraft, saveResource } from '../lib/repository.js'
import { fingerprint, newId, resourceFields, today } from '../lib/model.js'
import { Feedback, Field, RecordDetails } from './Fields.jsx'
import { downloadJson, useEditor } from './editor.js'

const titles = { runs: 'Runs', exercises: 'Exercise catalog', trainingPlans: 'Training plans' }
const recordName = (row, table) => table === 'runs' ? `${row.date} — ${row.distance ?? 'unspecified'} miles` : row.name || row.title || 'Untitled'

export function ResourceList({ table, userId, revision, onSaved }) {
  const [records, setRecords] = useState([])
  const [drafts, setDrafts] = useState([])
  const [status, setStatus] = useState('Loading…')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([listRecords(table, userId), listDrafts(userId)]).then(([rows, snapshots]) => {
      if (!active) return
      setRecords(rows.sort((a, b) => table === 'runs' ? b.date.localeCompare(a.date) : recordName(a, table).localeCompare(recordName(b, table))))
      setDrafts(snapshots.filter(row => row.key.startsWith(`${table}/`)))
      setStatus('')
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [table, userId, revision])
  async function create() {
    try {
      const row = { id: newId(), user_id: userId }
      if (table === 'runs') row.date = today()
      if (table !== 'exercises') row.created_at = new Date().toISOString()
      await saveDraft(userId, `${table}/${row.id}`, row, fingerprint(null))
      onSaved()
      window.location.hash = `#/${table}/${row.id}`
    } catch (err) { setError(err.message) }
  }
  return <section><h2>{titles[table]}</h2>
    {table === 'exercises' && <p>Optional reference catalog. Workouts can use any name without adding it here. Catalog edits never change past workouts.</p>}
    {table === 'trainingPlans' && <p>Store and edit raw markdown. Plans do not prescribe or modify workouts automatically.</p>}
    <button onClick={create}>New {table === 'runs' ? 'run' : table === 'exercises' ? 'exercise' : 'training plan'}</button>
    <Feedback status={status} error={error} />
    {drafts.length > 0 && <><h3>Editor drafts</h3><ul>{drafts.map(row => <li key={row.id}><a href={`#/${row.key}`}>Resume {recordName(row.value, table)}</a></li>)}</ul></>}
    <h3>Saved records</h3>{!records.length && !status && <p>No saved records for this account.</p>}
    <ul>{records.map(row => <li key={row.id}><a href={`#/${table}/${row.id}`}>{recordName(row, table)}</a></li>)}</ul>
  </section>
}
export function ResourceEditor({ table, userId, id, onSaved }) {
  const editor = useEditor(userId, `${table}/${id}`, () => loadResource(table, id, userId))
  const { value, busy, change, error, status } = editor
  const fields = resourceFields[table]
  const field = ([key, label, type]) => <Field key={key} label={label} value={value[key]}
    type={type?.toLowerCase().includes('textarea') ? 'textarea' : ['text', 'required'].includes(type) ? 'text' : 'number'}
    required={type?.startsWith('required')} integer={type === 'integer'} signed={type === 'signed'}
    onChange={next => change({ ...value, [key]: next })} />
  async function save(event) {
    event.preventDefault()
    if (await editor.save((input, base) => saveResource(table, userId, input, base))) onSaved()
  }
  async function remove() {
    if (!window.confirm('Delete this saved record? This will also be queued for your cloud account.')) return
    if (await editor.save(async (input, base) => { await deleteResource(table, userId, input.id, base); return null })) {
      onSaved(); window.location.hash = `#/${table}`
    }
  }
  return <section><h2>{titles[table]} record</h2><a href={`#/${table}`}>All {titles[table].toLowerCase()}</a>
    <Feedback status={status} error={error} />
    {value && <><form onSubmit={save}><fieldset disabled={busy}><legend>Record</legend>
      {table === 'runs' && <Field label="Date" type="date" required value={value.date} onChange={next => change({ ...value, date: next })} />}
      {fields.filter(([, , type], index) => type?.startsWith('required') || (table === 'runs' && index < 2)).map(field)}
      {table !== 'trainingPlans' && <details><summary>Optional fields</summary>{fields.filter(([, , type], index) => !type?.startsWith('required') && !(table === 'runs' && index < 2)).map(field)}</details>}
      <button type="submit">Save record</button>
    </fieldset></form>
    {error && <p><button disabled={busy} onClick={() => change(value)}>Retry saving editor draft</button></p>}
    <p><button disabled={busy} onClick={editor.discard}>Discard editor draft</button>{' '}<button onClick={() => downloadJson(value, `${table}-draft-${id}.json`)}>Download editor draft</button></p>
    <details><summary>Stored record fields</summary><RecordDetails row={value} /></details>
    <details><summary>Delete record</summary><button disabled={busy} onClick={remove}>Delete record permanently</button></details>
    </>}
  </section>
}
