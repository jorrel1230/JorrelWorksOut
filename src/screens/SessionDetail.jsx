import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { formatDate } from '../lib/workout'
import { getWorkoutDetail } from '../lib/exercises'
import Sheet from '../components/Sheet'

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [session, setSession] = useState(null)
  const [workoutDetail, setWorkoutDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Edit state
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editExercises, setEditExercises] = useState([])
  
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const s = await db.sessions.get(id)
        if (cancelled) return
        if (!s) {
          navigate('/history')
          return
        }
        setSession(s)
        
        const detail = await getWorkoutDetail(id)
        if (cancelled) return
        setWorkoutDetail(detail)
        
        // Init edit state
        setEditDate(s.date)
        setEditNote(s.note || '')
        
        // Deep clone exercises for editing
        setEditExercises(JSON.parse(JSON.stringify(detail.exercises)))
        
        setLoading(false)
      } catch (e) {
        console.error(e)
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  async function handleDelete() {
    if (!session) return
    
    // Delete session
    await db.sessions.delete(id)
    
    // Delete new format stuff
    const workoutExercises = await db.workoutExercises.where('session_id').equals(id).toArray()
    for (const we of workoutExercises) {
      await db.liftingSets.where('workout_exercise_id').equals(we.id).delete()
    }
    await db.workoutExercises.where('session_id').equals(id).delete()
    
    // Delete old format stuff
    await db.liftResults.where('session_id').equals(id).delete()
    
    setShowDeleteConfirm(false)
    navigate('/history')
  }

  async function handleSave() {
    if (!session || !workoutDetail) return
    
    // Update session
    await db.sessions.update(id, {
      date: editDate,
      note: editNote
    })
    
    // Update exercises/sets
    if (workoutDetail.format === 'new') {
      for (const ex of editExercises) {
        // We only support updating sets in this screen, not adding/removing exercises
        for (const set of ex.sets) {
          await db.liftingSets.update(set.id, {
            weight_lbs: Number(set.weight) || 0,
            reps: Number(set.reps) || 0,
            is_completed: set.completed
          })
        }
      }
    } else if (workoutDetail.format === 'old') {
      for (const ex of editExercises) {
        // old format reconstructs set_weights and partial_reps
        const setWeights = ex.sets.map(s => Number(s.weight) || 0)
        const partialReps = ex.sets.map(s => Number(s.reps) || 0)
        const completedCount = ex.sets.filter(s => s.completed).length
        
        await db.liftResults.update(ex.id, {
          set_weights: setWeights,
          partial_reps: partialReps,
          sets_completed: completedCount
        })
      }
    }
    
    setIsEditing(false)
    // Reload data after save
    const updatedSession = await db.sessions.get(id)
    setSession(updatedSession)
    const detail = await getWorkoutDetail(id)
    setWorkoutDetail(detail)
    setEditExercises(JSON.parse(JSON.stringify(detail.exercises)))
  }

  function handleSetChange(exIndex, setIndex, field, value) {
    const updated = [...editExercises]
    updated[exIndex].sets[setIndex][field] = value
    setEditExercises(updated)
  }

  function toggleSetCompletion(exIndex, setIndex) {
    const updated = [...editExercises]
    updated[exIndex].sets[setIndex].completed = !updated[exIndex].sets[setIndex].completed
    setEditExercises(updated)
  }

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>
  }

  if (!session || !workoutDetail) {
    return <div className="p-4 text-center">Workout not found.</div>
  }

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 pb-20 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        {isEditing ? (
          <button onClick={() => setIsEditing(false)} className="text-gray-500 font-medium">Cancel</button>
        ) : (
          <button onClick={() => navigate('/history')} className="text-blue-500 font-medium">‹ Back</button>
        )}
        
        <h1 className="text-xl font-bold truncate px-2 text-center">
          {session.type || 'Workout'}
        </h1>
        
        {isEditing ? (
          <button onClick={handleSave} className="text-blue-500 font-medium font-bold">Save</button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-blue-500 font-medium">Edit</button>
        )}
      </div>
      
      <div className="p-4 space-y-6">
        {/* Date & Note */}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Date</label>
              <input 
                type="date" 
                value={editDate.split('T')[0]} 
                onChange={e => setEditDate(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Notes</label>
              <textarea 
                value={editNote} 
                onChange={e => setEditNote(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl border-none min-h-[80px]"
                placeholder="Workout notes..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-500">{formatDate(session.date)}</div>
            {session.note && (
              <div className="bg-yellow-50 text-yellow-900 p-3 rounded-xl text-sm border border-yellow-200">
                {session.note}
              </div>
            )}
          </div>
        )}
        
        {/* Exercises */}
        <div className="space-y-6">
          {(isEditing ? editExercises : workoutDetail.exercises).map((ex, exIndex) => (
            <div key={ex.id || exIndex} className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-bold text-lg mb-3">{ex.name}</h3>
              {ex.notes && !isEditing && (
                 <div className="text-sm text-gray-500 italic mb-3">{ex.notes}</div>
              )}
              
              <div className="space-y-2">
                {ex.sets.map((set, setIndex) => (
                  <div key={set.id || setIndex} className="flex items-center gap-3">
                    <div className="w-6 text-center text-sm font-bold text-gray-400">
                      {set.setNumber}
                    </div>
                    
                    {isEditing ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          type="number"
                          value={set.weight || ''}
                          onChange={e => handleSetChange(exIndex, setIndex, 'weight', e.target.value)}
                          className="w-20 p-2 text-center rounded bg-white border border-gray-200"
                          placeholder="lbs"
                        />
                        <span className="self-center text-gray-400">×</span>
                        <input
                          type="number"
                          value={set.reps || ''}
                          onChange={e => handleSetChange(exIndex, setIndex, 'reps', e.target.value)}
                          className="w-16 p-2 text-center rounded bg-white border border-gray-200"
                          placeholder="reps"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 text-lg">
                        {set.weight} lbs <span className="text-gray-400 text-sm mx-1">×</span> {set.reps}
                      </div>
                    )}
                    
                    {/* Completion Circle */}
                    <div 
                      onClick={() => isEditing && toggleSetCompletion(exIndex, setIndex)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        set.completed 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : 'bg-transparent border-gray-300 text-transparent'
                      } ${isEditing ? 'cursor-pointer' : ''}`}
                    >
                      ✓
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Delete Button */}
        {!isEditing && (
          <div className="pt-8 pb-4">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 text-red-500 font-bold bg-red-50 rounded-xl"
            >
              Delete Workout
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <Sheet
          title="Delete Workout?"
          body="This action cannot be undone. All exercises and sets will be permanently deleted."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
