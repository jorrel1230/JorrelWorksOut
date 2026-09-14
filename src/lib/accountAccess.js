import { LOCAL_USER_ID } from './model.js'

export const LOCAL_AUTH_KEY = 'jwo.localMode'
export const ACCOUNT_ACCESS_KEY = 'jwo.accountAccess'

// This remembers only which account's local records to open, never cloud credentials.
// The signed-out marker also prevents a failed/offline SDK logout from restoring access.
export function storedAccount(storage) {
  if (storage.getItem(LOCAL_AUTH_KEY) === 'true') return { id: LOCAL_USER_ID }
  const saved = JSON.parse(storage.getItem(ACCOUNT_ACCESS_KEY) || 'null')
  if (saved?.mode === 'signed-out') return null
  if (saved?.mode === 'account' && typeof saved.user?.id === 'string' && saved.user.id !== LOCAL_USER_ID) {
    return { id: saved.user.id, email: saved.user.email, cached: true }
  }
  return undefined
}
export function hasValidSession(session, userId, now = Date.now()) {
  return Boolean(session?.user?.id) && session.user.id === userId && typeof session.access_token === 'string' && session.access_token.length > 0
    && Number.isFinite(session.expires_at) && session.expires_at * 1000 > now
}
export function rememberSession(storage, session) {
  if (!hasValidSession(session, session?.user?.id)) throw new Error('A current account session is required to sign in.')
  const user = { id: session.user.id, email: session.user.email }
  storage.setItem(ACCOUNT_ACCESS_KEY, JSON.stringify({ mode: 'account', user }))
  storage.removeItem(LOCAL_AUTH_KEY)
  return user
}
export function resolveAccount(storage, session) {
  const stored = storedAccount(storage)
  if (stored === null || stored?.id === LOCAL_USER_ID) return stored
  // An earlier async response must not switch back from a newly selected account.
  if (stored && session?.user?.id !== stored.id) return stored
  if (hasValidSession(session, session?.user?.id)) return rememberSession(storage, session)
  return stored || null
}
export function selectLocalAccount(storage) {
  storage.setItem(LOCAL_AUTH_KEY, 'true')
  return { id: LOCAL_USER_ID }
}
export function forgetAccount(storage) {
  storage.setItem(ACCOUNT_ACCESS_KEY, JSON.stringify({ mode: 'signed-out' }))
  storage.removeItem(LOCAL_AUTH_KEY)
  return null
}
