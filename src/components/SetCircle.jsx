export default function SetCircle({ reps, onTap }) {
  const complete = reps !== null
  return (
    <button
      className={`set-circle${complete ? ' set-circle--complete' : ''}`}
      onClick={onTap}
      type="button"
      aria-label={complete ? `${reps} reps, tap to undo` : 'Mark set complete'}
    >
      {complete ? reps : ''}
    </button>
  )
}
