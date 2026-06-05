import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import { db } from './lib/db'
import { supabase } from './lib/supabase'
import Auth from './screens/Auth'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import ActiveWorkout from './screens/ActiveWorkout'
import SessionSummary from './screens/SessionSummary'
import History from './screens/History'
import SessionDetail from './screens/SessionDetail'
import EditWeights from './screens/EditWeights'
import Progress from './screens/Progress'
import './App.css'

async function checkOnboarding(userId) {
  const localCount = await db.exercises.where('user_id').equals(userId).count()
  if (localCount > 0) return true

  // User might have data from another device — pull from Supabase
  const { data } = await supabase.from('exercises').select('*').eq('user_id', userId)
  if (data && data.length > 0) {
    await db.exercises.bulkPut(data)
    return true
  }

  return false
}

function Splash() {
  return (
    <div className="splash">
      <span className="splash-title">5×5</span>
    </div>
  )
}

function App() {
  const { session, loading: authLoading } = useAuth()
  useSync(session)
  const [onboarded, setOnboarded] = useState(null) // null = still checking

  useEffect(() => {
    if (!session) { setOnboarded(null); return }
    checkOnboarding(session.user.id).then(setOnboarded)
  }, [session])

  if (authLoading || (session && onboarded === null)) return <Splash />

  return (
    <HashRouter>
      <Routes>
        {!session ? (
          <>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        ) : !onboarded ? (
          <>
            <Route path="/onboarding" element={<Onboarding onComplete={() => setOnboarded(true)} />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <>
            <Route path="/home" element={<Home />} />
            <Route path="/workout" element={<ActiveWorkout />} />
            <Route path="/summary" element={<SessionSummary />} />
            <Route path="/history" element={<History />} />
            <Route path="/session/:id" element={<SessionDetail />} />
            <Route path="/edit-weights" element={<EditWeights />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}

export default App
