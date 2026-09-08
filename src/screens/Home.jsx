import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { sortSessionsDesc, formatDate } from '../lib/workout'

export default function Home() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
      } else {
        navigate('/login')
      }
    })
  }, [navigate])

  useEffect(() => {
    if (!userId) return

    async function loadData() {
      const allSessions = await db.sessions
        .where('user_id').equals(userId)
        .filter(s => s.is_complete)
        .toArray()

      // Fetch exercises for both formats to get counts
      const sorted = sortSessionsDesc(allSessions).slice(0, 5)
      
      const enriched = await Promise.all(sorted.map(async s => {
        // New format count
        const weCount = await db.workoutExercises
          .where('session_id').equals(s.id)
          .count()
          
        // Old format count
        const lrCount = await db.liftResults
          .where('session_id').equals(s.id)
          .count()
          
        return {
          ...s,
          exerciseCount: weCount + lrCount
        }
      }))

      setSessions(enriched)
    }

    loadData()
  }, [userId])

  async function handleSignOut() {
    await supabase.auth.signOut()
    await db.delete()
    navigate('/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="flex justify-between items-center p-4 bg-white border-b">
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 font-medium">
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">Lift</h1>
        <button onClick={handleSignOut} className="text-gray-500">
          ⚙️
        </button>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <button
          onClick={() => navigate('/workout')}
          className="w-full py-4 mb-8 bg-blue-600 text-white rounded-lg font-bold text-lg shadow"
        >
          Start Workout
        </button>

        <h2 className="text-xl font-bold mb-4">Recent Workouts</h2>
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-gray-500 italic">No recent workouts.</p>
          ) : (
            sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                className="bg-white p-4 rounded-lg shadow-sm border cursor-pointer active:bg-gray-50"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-800">
                    {formatDate(session.date)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {session.exerciseCount} exercises
                  </span>
                </div>
                {session.note && (
                  <p className="text-sm text-gray-600 truncate">{session.note}</p>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="bg-white border-t p-2 flex gap-2">
        <button 
          onClick={() => navigate('/history')}
          className="flex-1 py-3 text-center font-medium text-gray-700 bg-gray-100 rounded"
        >
          History
        </button>
        <button 
          onClick={() => navigate('/progress')}
          className="flex-1 py-3 text-center font-medium text-gray-700 bg-gray-100 rounded"
        >
          Progress
        </button>
      </footer>
    </div>
  )
}
