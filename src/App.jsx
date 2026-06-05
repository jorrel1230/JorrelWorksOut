import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import { pullFromSupabase, drainSyncQueue } from './lib/sync'
import { db } from './lib/db'
import Auth from './screens/Auth'
import Onboarding from './screens/Onboarding'
import Dashboard from './screens/Dashboard'
import Home from './screens/Home'
import RunHome from './screens/RunHome'
import LogRun from './screens/LogRun'
import RunHistory from './screens/RunHistory'
import RunDetail from './screens/RunDetail'
import RunProgress from './screens/RunProgress'
import RunSettings from './screens/RunSettings'
import ActiveWorkout from './screens/ActiveWorkout'
import SessionSummary from './screens/SessionSummary'
import History from './screens/History'
import SessionDetail from './screens/SessionDetail'
import EditWeights from './screens/EditWeights'
import Progress from './screens/Progress'
import './App.css'

async function checkOnboarding(userId) {
  const localCount = await db.exercises.where('user_id').equals(userId).count()
  if (localCount > 0) {
    // drain before pull so local edits reach Supabase before we overwrite IndexedDB
    drainSyncQueue(userId).then(() => pullFromSupabase(userId)).catch(() => {})
    return true
  }
  await drainSyncQueue(userId)
  return pullFromSupabase(userId)
}

function Splash() {
  return (
    <div className="splash">
      <span className="splash-title splash-title--long">JorrelWorksOut</span>
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/home" element={<Home />} />
            <Route path="/run" element={<RunHome />} />
            <Route path="/run/log" element={<LogRun />} />
            <Route path="/run/history" element={<RunHistory />} />
            <Route path="/run/progress" element={<RunProgress />} />
            <Route path="/run/settings" element={<RunSettings />} />
            <Route path="/run/:id" element={<RunDetail />} />
            <Route path="/workout" element={<ActiveWorkout />} />
            <Route path="/summary" element={<SessionSummary />} />
            <Route path="/history" element={<History />} />
            <Route path="/session/:id" element={<SessionDetail />} />
            <Route path="/edit-weights" element={<EditWeights />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}

export default App
