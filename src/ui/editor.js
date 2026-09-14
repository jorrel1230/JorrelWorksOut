import { useEffect, useRef, useState } from 'react'
import { discardDraft, loadDraft, saveDraft } from '../lib/repository.js'
import { fingerprint } from '../lib/model.js'

let pendingWrites = 0
const unsavedDrafts = new Set()
export const hasPendingWrites = () => pendingWrites > 0 || unsavedDrafts.size > 0
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useEditor(userId, draftKey, load) {
  const [value, setValue] = useState(null)
  const [base, setBase] = useState(null)
  const [status, setStatus] = useState('Loading…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chain = useRef(Promise.resolve())
  const revision = useRef(0)
  const loader = useRef(load)
  useEffect(() => {
    let active = true
    Promise.all([loadDraft(userId, draftKey), loader.current()]).then(([draft, current]) => {
      if (!active) return
      if (!draft && !current) throw new Error('Record not found for this account.')
      setValue(draft ? draft.value : current)
      setBase(draft ? draft.base : fingerprint(current))
      setStatus(draft ? `Resumed local editor draft (${new Date(draft.saved_at).toLocaleString()}). Not yet saved to history.` : 'Loaded saved record.')
    }).catch(err => { if (active) { setError(err.message); setStatus('Unable to open record.') } })
    return () => { active = false }
  }, [userId, draftKey])

  function change(next) {
    const currentRevision = ++revision.current
    setValue(next)
    setStatus('Saving editor draft on this device…')
    setError('')
    pendingWrites++
    unsavedDrafts.add(`${userId}/${draftKey}`)
    chain.current = chain.current.catch(() => {}).then(() => saveDraft(userId, draftKey, next, base))
      .then(() => {
        if (revision.current === currentRevision) {
          unsavedDrafts.delete(`${userId}/${draftKey}`)
          setStatus('Editor draft saved on this device. Save below to update history.')
        }
      })
      .catch(err => { setError(`Draft could not be saved: ${err.message}. Keep this page open or download the draft.`); throw err })
      .finally(() => { pendingWrites-- })
    // The rejection is also handled here until an explicit save awaits the chain.
    chain.current.catch(() => {})
  }
  async function save(action) {
    setBusy(true)
    setError('')
    try {
      await chain.current
      const saved = await action(value, base)
      setValue(saved)
      setBase(fingerprint(saved))
      setStatus('Saved on this device. Cloud changes, if applicable, are queued for background sync.')
      return true
    } catch (err) { setError(err.message); return false }
    finally { setBusy(false) }
  }
  async function discard() {
    if (!window.confirm('Discard this editor draft? The last saved history record will not be changed.')) return
    setBusy(true)
    try {
      await chain.current.catch(() => {})
      await discardDraft(userId, draftKey)
      unsavedDrafts.delete(`${userId}/${draftKey}`)
      window.location.hash = `#/${draftKey.split('/')[0]}`
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return { value, base, status, error, busy, change, save, discard }
}
