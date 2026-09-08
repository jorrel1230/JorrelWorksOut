import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { formatDate, sortSessionsDesc } from '../lib/workout'

export default function History() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const allSessions = await db.sessions
        .where('user_id')
        .equals(session.user.id)
        .toArray()
        
      const completedSessions = allSessions.filter(s => s.is_complete)
      const sorted = sortSessionsDesc(completedSessions)
      
      const sessionsWithExercises = await Promise.all(sorted.map(async s => {
        // Try new format first
        const workoutExercises = await db.workoutExercises
          .where('session_id')
          .equals(s.id)
          .sortBy('position')
          
        let exerciseNames
        if (workoutExercises.length > 0) {
          exerciseNames = workoutExercises.map(we => we.exercise_name)
        } else {
          // Fallback to old format
          const liftResults = await db.liftResults
            .where('session_id')
            .equals(s.id)
            .toArray()
          exerciseNames = liftResults.map(lr => lr.exercise_name)
        }
        
        return {
          ...s,
          exerciseNames: [...new Set(exerciseNames)]
        }
      }))
      
      setSessions(sessionsWithExercises)
      setLoading(false)
    }
    
    loadHistory()
  }, [])

  if (loading) {
    return <div className="p-4 text-center">Loading history...</div>
  }

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 pb-20">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <button onClick={() => navigate('/home')} className="text-blue-500 font-medium">‹ Back</button>
        <h1 className="text-xl font-bold">History</h1>
        <div className="w-16"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">No workouts logged yet.</div>
        ) : (
          sessions.map(s => {
            const displayNames = s.exerciseNames.slice(0, 3)
            const extraCount = s.exerciseNames.length - 3
            
            return (
              <div 
                key={s.id} 
                onClick={() => navigate(`/session/${s.id}`)}
                className="bg-gray-50 p-4 rounded-xl shadow-sm active:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-lg">{formatDate(s.date)}</div>
                  {s.type && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                      {s.type}
                    </span>
                  )}
                </div>
                <div className="text-gray-600 text-sm">
                  {displayNames.join(', ')}
                  {extraCount > 0 && ` +${extraCount} more`}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
