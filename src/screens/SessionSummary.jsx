import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { pushWorkout } from '../lib/sync'
import { formatDate } from '../lib/workout'

export default function SessionSummary() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [userId, setUserId] = useState(null)
  const [saving, setSaving] = useState(true)
  const savedRef = useRef(false)
  const [durationSeconds] = useState(() =>
    state?.startTime ? Math.floor((Date.now() - new Date(state.startTime).getTime()) / 1000) : null
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  const saveWorkout = useCallback(async () => {
    if (!state || !userId || savedRef.current) return
    savedRef.current = true
    setSaving(true)

    try {
      const sessionId = crypto.randomUUID()
      const now = new Date().toISOString()

      await db.sessions.put({
        id: sessionId,
        user_id: userId,
        date: state.date,
        type: '',
        is_complete: true,
        note: state.note || null,
        duration_seconds: durationSeconds,
        created_at: now,
      })

      const weRecords = []
      const setRecords = []

      for (let pos = 0; pos < state.exercises.length; pos++) {
        const ex = state.exercises[pos]
        const weId = crypto.randomUUID()
        weRecords.push({
          id: weId,
          session_id: sessionId,
          exercise_name: ex.name,
          position: pos,
          notes: '',
        })
        
        for (let si = 0; si < ex.sets.length; si++) {
          const set = ex.sets[si]
          setRecords.push({
            id: crypto.randomUUID(),
            workout_exercise_id: weId,
            set_number: si + 1,
            weight_lbs: set.weight,
            reps: set.reps || 0,
            is_completed: set.completed,
            is_warmup: false,
          })
        }
      }

      await db.workoutExercises.bulkPut(weRecords)
      await db.liftingSets.bulkPut(setRecords)

      await pushWorkout({
        userId,
        session: { id: sessionId, date: state.date, type: '', is_complete: true, note: state.note || null, duration_seconds: durationSeconds, created_at: now },
        workoutExercises: weRecords,
        liftingSets: setRecords,
      })
    } catch (err) {
      console.error('Error saving workout:', err)
    } finally {
      setSaving(false)
    }
  }, [state, userId, durationSeconds])

  useEffect(() => {
    if (!state) {
      navigate('/home', { replace: true })
      return
    }
    
    if (userId) {
      saveWorkout()
    }
  }, [state, userId, navigate, saveWorkout])

  if (!state) return null

  const formatDuration = (seconds) => {
    if (!seconds) return '--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-4">
      <div className="flex-1 max-w-md mx-auto w-full">
        <div className="text-center mb-8 pt-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workout Complete!</h1>
          <p className="text-gray-500">{formatDate(state.date)}</p>
          {durationSeconds && (
            <p className="text-sm font-medium text-gray-700 mt-2">
              Duration: {formatDuration(durationSeconds)}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border p-4 mb-6">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">Summary</h2>
          
          <div className="space-y-4">
            {state.exercises.map((ex, i) => {
              const completedSets = ex.sets.filter(s => s.completed)
              return (
                <div key={i} className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-gray-500">
                      {completedSets.length} / {ex.sets.length} sets completed
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {completedSets.map((s, si) => (
                      <div key={si}>{s.weight}lbs × {s.reps}</div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {state.note && (
          <div className="bg-white rounded-lg shadow border p-4 mb-6 text-sm text-gray-700">
            <strong>Notes:</strong> {state.note}
          </div>
        )}

        <button
          onClick={() => navigate('/home', { replace: true })}
          disabled={saving}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Done'}
        </button>
      </div>
    </div>
  )
}
