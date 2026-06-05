import { useState, useEffect } from 'react'

const DURATION = 3 * 60

export default function RestTimer({ triggerTime, onDismiss }) {
  const [seconds, setSeconds] = useState(DURATION)

  useEffect(() => {
    if (!triggerTime) return

    function tick() {
      const elapsed = Math.floor((Date.now() - triggerTime.getTime()) / 1000)
      const remaining = Math.max(0, DURATION - elapsed)
      setSeconds(remaining)
      if (remaining === 0) clearInterval(id)
    }

    tick()
    const id = setInterval(tick, 1000)
    // Snap to correct time immediately when user returns to app
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
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
