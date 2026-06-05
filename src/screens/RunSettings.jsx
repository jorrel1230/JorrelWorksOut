import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { pushRunSettings } from '../lib/sync'
import { DEFAULT_HR_ZONES } from '../lib/runUtils'

export default function RunSettings() {
  const navigate = useNavigate()
  const [zones, setZones] = useState([])
  const [settingsId, setSettingsId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const existing = await db.runSettings.where('user_id').equals(session.user.id).first()
      if (existing) {
        setSettingsId(existing.id)
        setZones(existing.hr_zones?.length ? existing.hr_zones : DEFAULT_HR_ZONES.map(z => ({ ...z })))
      } else {
        setZones(DEFAULT_HR_ZONES.map(z => ({ ...z })))
      }
    }
    load()
  }, [])

  function updateZone(idx, field, value) {
    setZones(prev => prev.map((z, i) => i === idx ? { ...z, [field]: value } : z))
  }

  function addZone() {
    setZones(prev => [...prev, { name: '', min: 0, max: 999 }])
  }

  function removeZone(idx) {
    setZones(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }

    const parsed = zones.map(z => ({
      name: z.name,
      min:  parseInt(z.min) || 0,
      max:  parseInt(z.max) || 999,
    }))

    const settings = {
      id:         settingsId || crypto.randomUUID(),
      user_id:    session.user.id,
      hr_zones:   parsed,
      updated_at: new Date().toISOString(),
    }

    await db.runSettings.put(settings)
    setSettingsId(settings.id)
    pushRunSettings(session.user.id, settings).catch(() => {})
    navigate('/run/progress')
  }

  return (
    <div className="screen detail-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/run/progress')}>‹ Back</button>
        <span className="workout-nav-title">HR Zones</span>
        <button className="workout-nav-btn" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
      </nav>

      <div className="detail-body">
        <p className="detail-field-label" style={{ marginBottom: '0.5rem' }}>
          Define your heart rate zones to filter progress charts.
        </p>

        <div className="editweights-card">
          {zones.map((zone, idx) => (
            <div className="zone-row" key={idx}>
              <input
                className="zone-name-input"
                type="text"
                placeholder="Z1"
                value={zone.name}
                onChange={e => updateZone(idx, 'name', e.target.value)}
              />
              <input
                className="zone-bound-input"
                type="number"
                min="0"
                value={zone.min}
                onChange={e => updateZone(idx, 'min', e.target.value)}
              />
              <span className="zone-dash">–</span>
              <input
                className="zone-bound-input"
                type="number"
                min="0"
                value={zone.max}
                onChange={e => updateZone(idx, 'max', e.target.value)}
              />
              <span className="zone-dash" style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>bpm</span>
              <button
                className="zone-delete-btn"
                type="button"
                onClick={() => removeZone(idx)}
              >×</button>
            </div>
          ))}
        </div>

        <button
          className="btn-ghost"
          type="button"
          onClick={addZone}
          style={{ marginTop: '0.5rem' }}
        >
          + Add zone
        </button>
      </div>
    </div>
  )
}
