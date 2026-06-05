import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="screen dashboard-screen">
      <div className="dashboard-inner">
        <header className="dashboard-header">
          <span className="dashboard-logo">JorrelWorksOut</span>
          <p className="dashboard-subtitle">What are we doing today?</p>
        </header>

        <div className="dashboard-actions">
          <button className="btn-primary dashboard-btn" onClick={() => navigate('/home')}>
            Lift
          </button>
          <button className="btn-primary dashboard-btn" onClick={() => navigate('/run')}>
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
