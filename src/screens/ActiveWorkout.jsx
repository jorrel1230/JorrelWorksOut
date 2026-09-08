import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getExerciseNames, getLastWeight } from '../lib/exercises';
import Sheet from '../components/Sheet';
import SetCircle from '../components/SetCircle';
import RestTimer from '../components/RestTimer';

export default function ActiveWorkout() {
  const navigate = useNavigate();
  
  const [userId, setUserId] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  
  const [startTime] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [lastSetTime, setLastSetTime] = useState(null);
  
  const [note, setNote] = useState('');
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteInput, setNoteInput] = useState('');

  const [showWeightEdit, setShowWeightEdit] = useState(null);
  const [editWeightInput, setEditWeightInput] = useState('');

  const [showCustomRepSheet, setShowCustomRepSheet] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [exerciseToRemove, setExerciseToRemove] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        getExerciseNames(session.user.id).then(setExerciseLibrary);
      }
    });

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddExercise = async (name) => {
    const weight = userId ? await getLastWeight(userId, name) : null;
    const initialWeight = weight !== null ? weight : 45;
    
    const newExercise = {
      tempId: crypto.randomUUID(),
      name,
      weightLbs: initialWeight,
      sets: [
        { tempId: crypto.randomUUID(), weight: initialWeight, reps: 8, completed: false },
        { tempId: crypto.randomUUID(), weight: initialWeight, reps: 8, completed: false },
        { tempId: crypto.randomUUID(), weight: initialWeight, reps: 8, completed: false },
      ]
    };
    setExercises(prev => [...prev, newExercise]);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const filteredLibrary = exerciseLibrary.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleSet = (exerciseId, setId, customReps = null) => {
    let justCompleted = false;
    setExercises(prev => prev.map(ex => {
      if (ex.tempId !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.tempId === setId) {
            const isCompleting = !s.completed;
            if (isCompleting) justCompleted = true;
            return { ...s, reps: customReps !== null ? customReps : s.reps, completed: isCompleting };
          }
          return s;
        })
      };
    }));
    if (justCompleted) {
      setLastSetTime(new Date());
    }
  };

  const handleCustomRep = (reps) => {
    if (!showCustomRepSheet) return;
    const ex = exercises.find(e => e.tempId === showCustomRepSheet);
    const nextSet = ex?.sets.find(s => !s.completed);
    if (nextSet) {
      toggleSet(ex.tempId, nextSet.tempId, reps);
    }
    setShowCustomRepSheet(null);
  };

  const handleSaveWeight = () => {
    const newWeight = parseInt(editWeightInput, 10);
    if (isNaN(newWeight) || !showWeightEdit) return;

    setExercises(prev => prev.map(ex => {
      if (ex.tempId !== showWeightEdit) return ex;
      return {
        ...ex,
        weightLbs: newWeight,
        sets: ex.sets.map(s => s.completed ? s : { ...s, weight: newWeight })
      };
    }));
    setShowWeightEdit(null);
  };

  const executeFinish = () => {
    navigate('/summary', {
      state: {
        date: new Date().toISOString().split('T')[0],
        note,
        startTime,
        exercises: exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets.map(s => ({
            weight: s.weight,
            reps: s.reps,
            completed: s.completed
          }))
        }))
      }
    });
  };

  const handleFinishClick = () => {
    const hasIncomplete = exercises.some(ex => ex.sets.some(s => !s.completed));
    if (hasIncomplete) {
      setShowFinishConfirm(true);
    } else {
      executeFinish();
    }
  };

  return (
    <div className="active-workout">
      <nav className="nav-bar">
        <button onClick={() => setShowCancelConfirm(true)}>Back</button>
        <h2>{formatTime(elapsed)}</h2>
        <button onClick={handleFinishClick}>Finish</button>
      </nav>

      <div className="exercises-container">
        {exercises.length === 0 ? (
          <div className="empty-state">
            <p>Workout started. Add an exercise to begin.</p>
          </div>
        ) : (
          exercises.map(ex => (
            <div key={ex.tempId} className="exercise-card">
              <div className="exercise-header">
                <h3>{ex.name}</h3>
                <div>
                  <span 
                    className="weight-display" 
                    onClick={() => {
                      setEditWeightInput(ex.weightLbs.toString());
                      setShowWeightEdit(ex.tempId);
                    }}
                  >
                    {ex.weightLbs} lbs
                  </span>
                  <button onClick={() => setExerciseToRemove(ex.tempId)}>×</button>
                </div>
              </div>
              
              <div className="sets-row">
                {ex.sets.map(s => (
                  <SetCircle 
                    key={s.tempId} 
                    reps={s.completed ? s.reps : null}
                    onTap={() => toggleSet(ex.tempId, s.tempId, 8)} 
                  />
                ))}
                <button 
                  className="add-rep-btn"
                  onClick={() => setShowCustomRepSheet(ex.tempId)}
                  disabled={!ex.sets.some(s => !s.completed)}
                >
                  +
                </button>
              </div>
              
              <button 
                className="add-set-btn"
                onClick={() => {
                  setExercises(prev => prev.map(e => {
                    if (e.tempId !== ex.tempId) return e;
                    return {
                      ...e,
                      sets: [...e.sets, { tempId: crypto.randomUUID(), weight: e.weightLbs, reps: 8, completed: false }]
                    };
                  }));
                }}
              >
                Add Set
              </button>
            </div>
          ))
        )}
      </div>

      <div className="footer-actions">
        <button className="add-exercise-btn" onClick={() => setShowExercisePicker(true)}>
          Add Exercise
        </button>
        <button className="note-btn" onClick={() => {
          setNoteInput(note);
          setShowNoteSheet(true);
        }}>
          Note
        </button>
      </div>

      {lastSetTime && (
        <RestTimer triggerTime={lastSetTime} onDismiss={() => setLastSetTime(null)} />
      )}

      {/* Exercise Picker Sheet */}
      {showExercisePicker && (
        <Sheet
          title="Add Exercise"
          onCancel={() => setShowExercisePicker(false)}
        >
          <input 
            type="text" 
            placeholder="Search exercises..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <ul className="exercise-list">
            {filteredLibrary.map(name => (
              <li key={name} onClick={() => handleAddExercise(name)}>{name}</li>
            ))}
            {searchQuery && !filteredLibrary.includes(searchQuery) && (
              <li className="create-new" onClick={() => handleAddExercise(searchQuery)}>
                Create New: "{searchQuery}"
              </li>
            )}
          </ul>
        </Sheet>
      )}

      {/* Weight Edit Sheet */}
      {showWeightEdit && (
        <Sheet
          title="Edit Weight"
          confirmLabel="Done"
          onConfirm={handleSaveWeight}
          onCancel={() => setShowWeightEdit(null)}
        >
          <input 
            type="number" 
            value={editWeightInput}
            onChange={(e) => setEditWeightInput(e.target.value)}
          />
        </Sheet>
      )}

      {/* Custom Reps Sheet */}
      {showCustomRepSheet && (
        <Sheet
          title="Log Partial Reps"
          onCancel={() => setShowCustomRepSheet(null)}
        >
          <div className="rep-grid">
            {Array.from({ length: 15 }, (_, i) => i + 1).map(reps => (
              <button key={reps} onClick={() => handleCustomRep(reps)}>{reps}</button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Note Sheet */}
      {showNoteSheet && (
        <Sheet
          title="Workout Note"
          confirmLabel="Save"
          onConfirm={() => {
            setNote(noteInput);
            setShowNoteSheet(false);
          }}
          onCancel={() => setShowNoteSheet(false)}
        >
          <textarea 
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            rows={4}
          />
        </Sheet>
      )}

      {/* Confirmation Sheets */}
      {showCancelConfirm && (
        <Sheet
          title="Discard Workout?"
          confirmLabel="Discard"
          onConfirm={() => navigate(-1)}
          onCancel={() => setShowCancelConfirm(false)}
        >
          <p>Are you sure you want to discard this workout?</p>
        </Sheet>
      )}

      {showFinishConfirm && (
        <Sheet
          title="Incomplete Sets"
          confirmLabel="Finish Anyway"
          onConfirm={executeFinish}
          onCancel={() => setShowFinishConfirm(false)}
        >
          <p>You have incomplete sets. Are you sure you want to finish?</p>
        </Sheet>
      )}

      {exerciseToRemove && (
        <Sheet
          title="Remove Exercise?"
          confirmLabel="Remove"
          onConfirm={() => {
            setExercises(prev => prev.filter(e => e.tempId !== exerciseToRemove));
            setExerciseToRemove(null);
          }}
          onCancel={() => setExerciseToRemove(null)}
        >
          <p>Remove this exercise from your workout?</p>
        </Sheet>
      )}
    </div>
  );
}
