import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function requireValue(value, name) {
  if (!value) throw new Error(`Missing required setting: ${name}`)
  return value
}

const targetUrl = requireValue(process.env.TARGET_SUPABASE_URL, 'TARGET_SUPABASE_URL')
const anonKey = requireValue(process.env.TARGET_SUPABASE_ANON_KEY, 'TARGET_SUPABASE_ANON_KEY')
const serviceKey = requireValue(
  process.env.TARGET_SUPABASE_SERVICE_KEY,
  'TARGET_SUPABASE_SERVICE_KEY',
)

const options = { auth: { autoRefreshToken: false, persistSession: false } }
const admin = createClient(targetUrl, serviceKey, options)
const browserClient = createClient(targetUrl, anonKey, options)
const nonce = `${Date.now()}-${randomBytes(6).toString('hex')}`
const email = `odontocloud-migration-smoke-${nonce}@example.invalid`
const password = randomBytes(32).toString('base64url')

let userId = null
try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { migration_smoke_test: true },
  })
  if (createError) throw new Error(`Create-user test failed: ${createError.message}`)
  userId = created.user.id

  const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError) throw new Error(`Password sign-in test failed: ${signInError.message}`)
  if (!signedIn.session?.access_token || signedIn.user?.id !== userId) {
    throw new Error('Password sign-in did not return the expected session')
  }

  const { error: restError } = await admin.from('tenants').select('id').limit(1)
  if (restError) throw new Error(`REST API test failed: ${restError.message}`)

  console.log('Auth smoke test passed: create user, password sign-in, session, and REST API')
} finally {
  if (userId) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw new Error(`Smoke-test cleanup failed: ${deleteError.message}`)
    console.log('Temporary smoke-test user removed')
  }
}
