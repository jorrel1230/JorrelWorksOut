import SetCircle from './SetCircle'

export default function LiftCard({ lift, liftIdx, onSetTap, onPlus, onEditWeight }) {
  const allFilled = lift.sets.every(s => s !== null)
  const label = lift.setsRequired === 1 ? '1×5' : '5×5'

  return (
    <div className="lift-card">
      <div className="lift-card-header">
        <span className="lift-card-name">{lift.name}</span>
        <button
          className="lift-weight-btn"
          type="button"
          onClick={() => onEditWeight(liftIdx)}
        >
          {label} {lift.weightLbs}lb ›
        </button>
      </div>

      <div className="set-row">
        <div className="set-circles">
          {lift.sets.map((reps, si) => (
            <SetCircle
              key={si}
              reps={reps}
              onTap={() => onSetTap(liftIdx, si)}
            />
          ))}
        </div>
        <button
          className="plus-btn"
          type="button"
          onClick={() => onPlus(liftIdx)}
          disabled={allFilled}
          aria-label="Log partial set"
        >
          +
        </button>
      </div>
    </div>
  )
}
