import { useEffect } from 'react'
import { drainSyncQueue } from '../lib/sync'

export function useSync(session) {
  useEffect(() => {
    if (!session) return

    drainSyncQueue(session.user.id)

    function handleOnline() {
      drainSyncQueue(session.user.id)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [session])
}
