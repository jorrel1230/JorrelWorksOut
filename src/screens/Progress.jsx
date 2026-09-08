import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { ALL_LIFTS, LIFT_ABBR } from '../lib/workout'
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

function formatXTick(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  if (payload.deloaded) {
    const pts = `${cx},${cy - 6} ${cx + 5},${cy} ${cx},${cy + 6} ${cx - 5},${cy}`
    return <polygon points={pts} fill="#f59e0b" />
  }
  return <circle cx={cx} cy={cy} r={5} fill={payload.failed ? '#ef4444' : '#22c55e'} stroke="none" />
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="progress-tooltip">
      <p className="progress-tooltip-date">{formatXTick(label)}</p>
      <p className="progress-tooltip-value" style={{ color: p.failed ? '#ef4444' : '#22c55e' }}>
        {p.weight} lbs{p.deloaded ? ' ↓ deload' : ''} — {p.failed ? 'Failed' : 'Passed'}
      </p>
    </div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeLift, setActiveLift] = useState('Squat')
  const [activeRange, setActiveRange] = useState('All')
  const [chartData, setChartData] = useState({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [sessions, allResults] = await Promise.all([
        db.sessions.where('user_id').equals(session.user.id).toArray(),
        db.liftResults.toArray(),
      ])

      const completed = sessions
        .filter(s => s.is_complete)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1
          return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
        })

      const sessionMap = Object.fromEntries(completed.map(s => [s.id, s]))

      const byLift = Object.fromEntries(ALL_LIFTS.map(l => [l, []]))
      for (const r of allResults) {
        const sess = sessionMap[r.session_id]
        if (sess && byLift[r.exercise_name]) {
          byLift[r.exercise_name].push({
            date: sess.date,
            sessionOrder: sess.created_at ?? sess.date,
            weight: r.weight_lbs,
            failed: r.failed,
          })
        }
      }

      const data = {}
      for (const lift of ALL_LIFTS) {
        const sorted = byLift[lift].sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1
          return a.sessionOrder < b.sessionOrder ? -1 : 1
        })
        data[lift] = sorted.map((pt, i) => ({
          ...pt,
          deloaded: i > 0 && pt.weight < sorted[i - 1].weight,
        }))
      }

      setChartData(data)
      setLoading(false)
    }
    load()
  }, [])

  const rangeDef = RANGES.find(r => r.label === activeRange) ?? RANGES[RANGES.length - 1]
  const cutoff = cutoffDate(rangeDef.days)
  const allPoints = chartData[activeLift] ?? []
  const points = cutoff ? allPoints.filter(p => p.date >= cutoff) : allPoints
  const weights = points.map(p => p.weight)
  const minW = weights.length ? Math.min(...weights) : 0
  const maxW = weights.length ? Math.max(...weights) : 100
  const yDomain = weights.length ? [Math.max(0, minW - 15), maxW + 15] : [0, 100]
  const tickInterval = points.length <= 7 ? 0 : Math.ceil(points.length / 7)

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">JWO</span>
      </div>
    )
  }

  return (
    <div className="screen progress-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/home')}>‹ Back</button>
        <span className="workout-nav-title">Progress</span>
        <span style={{ width: 60 }} />
      </nav>

      <div className="progress-tabs">
        {ALL_LIFTS.map(lift => (
          <button
            key={lift}
            className={`progress-tab ${activeLift === lift ? 'progress-tab--active' : ''}`}
            onClick={() => setActiveLift(lift)}
          >
            {LIFT_ABBR[lift]}
          </button>
        ))}
      </div>

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

      <div className="progress-body">
        <h2 className="progress-lift-name">{activeLift}</h2>

        {points.length === 0 ? (
          <p className="progress-empty">No data yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
                <Tooltip content={<TooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#555"
                  strokeWidth={1.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 7 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="progress-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#22c55e' }} /> Pass
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: '#ef4444' }} /> Fail
              </span>
              <span className="legend-item">
                <span className="legend-dot legend-dot--deload" /> Deload
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
