import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import {
  formatDuration, formatPace,
  paceToSeconds, getZoneForHR,
} from '../lib/runUtils'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

const RANGES = [
  { label: '30D', days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: null },
]

function cutoffDate(days) {
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

const METRICS = [
  {
    key: 'distance',
    label: 'Distance',
    getValue: r => r.distance,
    formatTooltip: r => r.distance != null ? `${r.distance} mi` : '—',
    yUnit: 'mi',
  },
  {
    key: 'duration',
    label: 'Duration',
    getValue: r => r.duration_seconds != null ? r.duration_seconds / 60 : null,
    formatTooltip: r => formatDuration(r.duration_seconds),
    yUnit: 'min',
  },
  {
    key: 'avg_pace',
    label: 'Pace',
    getValue: r => paceToSeconds(r.avg_pace),
    formatTooltip: r => formatPace(r.avg_pace),
    yUnit: 'sec/mi',
  },
  {
    key: 'avg_hr',
    label: 'Avg HR',
    getValue: r => r.avg_hr,
    formatTooltip: r => r.avg_hr != null ? `${r.avg_hr} bpm` : '—',
    yUnit: 'bpm',
  },
  {
    key: 'z2_time',
    label: 'Z2 Time',
    getValue: r => r.z2_time_seconds != null ? r.z2_time_seconds / 60 : null,
    formatTooltip: r => r.z2_time_seconds != null ? formatDuration(r.z2_time_seconds) : '—',
    yUnit: 'min',
  },
  {
    key: 'avg_cadence',
    label: 'Cadence',
    getValue: r => r.avg_cadence,
    formatTooltip: r => r.avg_cadence != null ? `${r.avg_cadence} spm` : '—',
    yUnit: 'spm',
  },
  {
    key: 'elevation_gain',
    label: 'Elevation',
    getValue: r => r.elevation_gain,
    formatTooltip: r => r.elevation_gain != null ? `${r.elevation_gain} ft` : '—',
    yUnit: 'ft',
  },
  {
    key: 'avg_power',
    label: 'Power',
    getValue: r => r.avg_power,
    formatTooltip: r => r.avg_power != null ? `${r.avg_power} W` : '—',
    yUnit: 'W',
  },
  {
    key: 'calories',
    label: 'Calories',
    getValue: r => r.calories,
    formatTooltip: r => r.calories != null ? `${r.calories} cal` : '—',
    yUnit: 'cal',
  },
]

function formatXTick(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TooltipContent({ active, payload, activeMetricDef }) {
  if (!active || !payload?.length) return null
  const { date, run } = payload[0].payload
  return (
    <div className="progress-tooltip">
      <p className="progress-tooltip-date">{formatXTick(date)}</p>
      <p className="progress-tooltip-value" style={{ color: 'var(--red)' }}>
        {activeMetricDef.formatTooltip(run)}
      </p>
    </div>
  )
}

export default function RunProgress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState([])
  const [zones, setZones] = useState([])
  const [activeRange, setActiveRange] = useState('All')
  const [selectedZone, setSelectedZone] = useState('All')
  const [activeMetricKey, setActiveMetricKey] = useState('distance')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [allRuns, settings] = await Promise.all([
        db.runs.where('user_id').equals(session.user.id).toArray(),
        db.runSettings.where('user_id').equals(session.user.id).first(),
      ])

      allRuns.sort((a, b) => a.date < b.date ? -1 : 1)
      setRuns(allRuns)
      setZones(settings?.hr_zones ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const activeMetricDef = METRICS.find(m => m.key === activeMetricKey) ?? METRICS[0]

  const rangeDef = RANGES.find(r => r.label === activeRange) ?? RANGES[RANGES.length - 1]
  const cutoff = cutoffDate(rangeDef.days)
  const rangeRuns = cutoff ? runs.filter(r => r.date >= cutoff) : runs

  const filteredRuns = selectedZone === 'All'
    ? rangeRuns
    : rangeRuns.filter(r => r.avg_hr != null && getZoneForHR(r.avg_hr, zones) === selectedZone)

  const chartPoints = filteredRuns
    .map(r => {
      const value = activeMetricDef.getValue(r)
      if (value == null) return null
      return { date: r.date, value, run: r }
    })
    .filter(Boolean)

  const values = chartPoints.map(p => p.value)
  const minV = values.length ? Math.min(...values) : 0
  const maxV = values.length ? Math.max(...values) : 100
  const padding = (maxV - minV) * 0.15 || 5
  const yDomain = values.length ? [Math.max(0, minV - padding), maxV + padding] : [0, 100]
  const tickInterval = chartPoints.length <= 7 ? 0 : Math.ceil(chartPoints.length / 7)

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">…</span>
      </div>
    )
  }

  return (
    <div className="screen progress-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/run')}>‹ Back</button>
        <span className="workout-nav-title">Progress</span>
        <button className="workout-nav-btn" onClick={() => navigate('/run/settings')}>Zones</button>
      </nav>

      {/* Date range filter */}
      <div className="zone-chips">
        {RANGES.map(r => (
          <button
            key={r.label}
            className={`zone-chip ${activeRange === r.label ? 'zone-chip--active' : ''}`}
            onClick={() => setActiveRange(r.label)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Zone filter */}
      {zones.length > 0 && (
        <div className="zone-chips">
          <button
            className={`zone-chip ${selectedZone === 'All' ? 'zone-chip--active' : ''}`}
            onClick={() => setSelectedZone('All')}
          >
            All
          </button>
          {zones.map(z => (
            <button
              key={z.name}
              className={`zone-chip ${selectedZone === z.name ? 'zone-chip--active' : ''}`}
              onClick={() => setSelectedZone(z.name)}
            >
              {z.name}
            </button>
          ))}
        </div>
      )}

      {zones.length === 0 && (
        <div className="zone-chips">
          <button className="zone-chip zone-chip--prompt" onClick={() => navigate('/run/settings')}>
            Configure zones →
          </button>
        </div>
      )}

      {/* Metric selector */}
      <div className="metric-tabs">
        {METRICS.map(m => (
          <button
            key={m.key}
            className={`progress-tab ${activeMetricKey === m.key ? 'progress-tab--active' : ''}`}
            onClick={() => setActiveMetricKey(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="progress-body">
        {chartPoints.length === 0 ? (
          <p className="progress-empty">
            {runs.length === 0
              ? 'No runs logged yet.'
              : rangeRuns.length === 0
                ? `No runs in the last ${rangeDef.label}.`
                : 'No data for the selected filter.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartPoints} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXTick}
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip content={<TooltipContent activeMetricDef={activeMetricDef} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={{ r: 4, fill: '#ef4444', stroke: 'none' }}
                activeDot={{ r: 7 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
