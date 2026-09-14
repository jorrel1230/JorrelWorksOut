import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACCOUNT_ACCESS_KEY, forgetAccount, hasValidSession, rememberSession, resolveAccount, selectLocalAccount, storedAccount } from '../src/lib/accountAccess.js'

function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
const session = id => ({ user: { id, email: `${id}@example.test` }, access_token: 'test-token-not-a-credential', expires_at: Math.floor(Date.now() / 1000) + 3600 })

test('remembered principal supports offline local access but never supplies cloud credentials', () => {
  const store = storage()
  const signedIn = session('account-a')
  rememberSession(store, signedIn)
  const cached = storedAccount(store)
  assert.deepEqual(cached, { id: 'account-a', email: 'account-a@example.test', cached: true })
  assert.equal(hasValidSession(cached, 'account-a'), false)
  assert.equal(store.getItem(ACCOUNT_ACCESS_KEY).includes('test-token'), false)
  assert.deepEqual(resolveAccount(store, null), cached)
  const expired = { ...signedIn, expires_at: 1 }
  assert.equal(hasValidSession(expired, 'account-a'), false)
  assert.deepEqual(resolveAccount(store, expired), cached)
  assert.throws(() => rememberSession(store, expired), /current account session/)
})

test('explicit signout clears identity and prevents delayed auth responses restoring access', () => {
  const store = storage()
  const signedIn = session('account-a')
  rememberSession(store, signedIn)
  selectLocalAccount(store)
  forgetAccount(store)
  assert.equal(storedAccount(store), null)
  assert.equal(store.getItem(ACCOUNT_ACCESS_KEY).includes('account-a'), false)
  assert.equal(resolveAccount(store, signedIn), null)
  // Only a fresh, explicit successful login clears the signout marker.
  rememberSession(store, session('account-b'))
  assert.equal(storedAccount(store).id, 'account-b')
})

test('account switches reject stale identities and local mode stays separate', () => {
  const store = storage()
  rememberSession(store, session('account-a'))
  rememberSession(store, session('account-b'))
  assert.equal(resolveAccount(store, session('account-a')).id, 'account-b')
  assert.equal(hasValidSession(session('account-a'), 'account-b'), false)
  selectLocalAccount(store)
  assert.equal(resolveAccount(store, session('account-b')).id, 'local-user')
})

test('legacy valid SDK session initializes local identity; missing/expired sessions cannot authorize cloud', () => {
  const store = storage()
  assert.equal(storedAccount(store), undefined)
  assert.equal(resolveAccount(store, null), null)
  assert.equal(resolveAccount(store, session('account-a')).id, 'account-a')
  for (const value of [null, {}, { user: { id: 'account-a' } }, { ...session('account-a'), access_token: '' }, { ...session('account-a'), expires_at: NaN }]) {
    assert.equal(hasValidSession(value, 'account-a'), false)
  }
})
