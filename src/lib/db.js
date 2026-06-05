import Dexie from 'dexie'

export const db = new Dexie('sl5x5')

db.version(1).stores({
  exercises:   'id, user_id, name, [user_id+name]',
  sessions:    'id, user_id, date, type, is_complete',
  liftResults: 'id, session_id',
  syncQueue:   '++id, entity, synced_at',
})

db.version(2).stores({
  runs:        'id, user_id, date',
  runSettings: 'id, user_id',
})
