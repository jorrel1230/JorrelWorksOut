import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getExerciseNames, getExerciseHistory } from '../lib/exercises'
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
  if (!dateStr) return ''
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

function getAbbr(name) {
  if (name.length <= 6) return name
  const words = name.split(' ')
  if (words.length > 1) return words.map(w => w[0]).join('').toUpperCase()
  return name.substring(0, 5).toUpperCase()
}

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [exercises, setExercises] = useState([])
  const [activeLift, setActiveLift] = useState('')
  const [activeRange, setActiveRange] = useState('All')
  const [historyData, setHistoryData] = useState([])

  useEffect(() => {
    async function loadNames() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const names = await getExerciseNames(session.user.id)
      setExercises(names)
      if (names.length > 0) {
        setActiveLift(names[0])
      }
      setLoading(false)
    }
    loadNames()
  }, [])

  useEffect(() => {
    async function loadHistory() {
      if (!activeLift) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const hist = await getExerciseHistory(session.user.id, activeLift)
      
      const processed = hist.map((pt, i) => ({
        ...pt,
        deloaded: i > 0 && pt.weight < hist[i - 1].weight,
      }))
      
      setHistoryData(processed)
    }
    loadHistory()
  }, [activeLift])

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="splash-title">JWO</span>
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="screen progress-screen">
        <nav className="detail-nav">
          <button className="workout-nav-btn" onClick={() => navigate('/home')}>‹ Back</button>
          <span className="workout-nav-title">Progress</span>
          <span style={{ width: 60 }} />
        </nav>
        <div className="progress-body" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#888', textAlign: 'center' }}>Log a workout to see progress</p>
        </div>
      </div>
    )
  }

  const rangeDef = RANGES.find(r => r.label === activeRange) ?? RANGES[RANGES.length - 1]
  const cutoff = cutoffDate(rangeDef.days)
  const points = cutoff ? historyData.filter(p => p.date >= cutoff) : historyData
  const weights = points.map(p => p.weight).filter(w => w != null)
  const minW = weights.length ? Math.min(...weights) : 0
  const maxW = weights.length ? Math.max(...weights) : 100
  const yDomain = weights.length ? [Math.max(0, minW - 15), maxW + 15] : [0, 100]
  const tickInterval = points.length <= 7 ? 0 : Math.ceil(points.length / 7)

  return (
    <div className="screen progress-screen">
      <nav className="detail-nav">
        <button className="workout-nav-btn" onClick={() => navigate('/home')}>‹ Back</button>
        <span className="workout-nav-title">Progress</span>
        <span style={{ width: 60 }} />
      </nav>

      <div className="progress-tabs">
        {exercises.map(lift => (
          <button
            key={lift}
            className={`progress-tab ${activeLift === lift ? 'progress-tab--active' : ''}`}
            onClick={() => setActiveLift(lift)}
          >
            {getAbbr(lift)}
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
