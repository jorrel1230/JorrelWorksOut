import { useState, useEffect } from 'react'

const DURATION = 3 * 60

export default function RestTimer({ triggerTime, onDismiss }) {
  const [seconds, setSeconds] = useState(DURATION)

  useEffect(() => {
    if (!triggerTime) return
    setSeconds(DURATION)
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [triggerTime])

  if (!triggerTime) return null

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const progress = ((DURATION - seconds) / DURATION) * 100

  return (
    <div className="rest-timer">
      <div className="rest-timer-left">
        <span className="rest-timer-time">
          {mins}:{String(secs).padStart(2, '0')}
        </span>
        <span className="rest-timer-label">Rest 3 min</span>
      </div>
      <button className="rest-timer-dismiss" onClick={onDismiss} type="button">
        ×
      </button>
      <div className="rest-timer-track">
        <div className="rest-timer-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
