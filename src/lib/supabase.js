import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://gvazsjdtrebpzcuhcrek.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_3AYOgJTQg2HT6pO5IPY2IA_rokUp9WM'

export const LOCAL_AUTH_KEY = 'jwo.localMode'
export const LOCAL_USER_ID = 'local-user'

function isLocalMode() {
  try {
    return window.localStorage.getItem(LOCAL_AUTH_KEY) === 'true'
  } catch {
    return false
  }
}

function localUser() {
  return {
    id: LOCAL_USER_ID,
    email: 'local@jorrelworksout.app',
    app_metadata: {},
    user_metadata: { local: true },
    aud: 'authenticated',
    role: 'authenticated',
  }
}

function localSession() {
  const user = localUser()
  return {
    access_token: 'local-session',
    refresh_token: 'local-session',
    expires_in: 60 * 60 * 24 * 365,
    token_type: 'bearer',
    user,
  }
}

export function enableLocalMode() {
  window.localStorage.setItem(LOCAL_AUTH_KEY, 'true')
  window.dispatchEvent(new CustomEvent('jwo-auth-changed'))
}

export function disableLocalMode() {
  window.localStorage.removeItem(LOCAL_AUTH_KEY)
  window.dispatchEvent(new CustomEvent('jwo-auth-changed'))
}

const client = createClient(supabaseUrl, supabaseAnonKey)

const realGetSession = client.auth.getSession.bind(client.auth)
const realGetUser = client.auth.getUser.bind(client.auth)
const realOnAuthStateChange = client.auth.onAuthStateChange.bind(client.auth)
const realSignOut = client.auth.signOut.bind(client.auth)

client.auth.getSession = async () => {
  if (isLocalMode()) return { data: { session: localSession() }, error: null }
  return realGetSession()
}

client.auth.getUser = async () => {
  if (isLocalMode()) return { data: { user: localUser() }, error: null }
  return realGetUser()
}

client.auth.onAuthStateChange = (callback) => {
  const { data } = realOnAuthStateChange(callback)
  const handler = () => {
    callback(isLocalMode() ? 'SIGNED_IN' : 'SIGNED_OUT', isLocalMode() ? localSession() : null)
  }
  window.addEventListener('jwo-auth-changed', handler)
  return {
    data: {
      subscription: {
        unsubscribe() {
          window.removeEventListener('jwo-auth-changed', handler)
          data.subscription.unsubscribe()
        },
      },
    },
  }
}

client.auth.signOut = async (...args) => {
  if (isLocalMode()) {
    disableLocalMode()
    return { error: null }
  }
  return realSignOut(...args)
}

export const supabase = client
