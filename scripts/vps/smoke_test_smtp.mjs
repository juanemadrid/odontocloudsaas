import { createClient } from '@supabase/supabase-js'

function requireValue(value, name) {
  if (!value) throw new Error(`Missing required setting: ${name}`)
  return value
}

const targetUrl = requireValue(process.env.TARGET_SUPABASE_URL, 'TARGET_SUPABASE_URL')
const serviceKey = requireValue(
  process.env.TARGET_SUPABASE_SERVICE_KEY,
  'TARGET_SUPABASE_SERVICE_KEY',
)
const testEmail = 'odontocloud.soporte@gmail.com'
const redirectTo = 'https://juanemadrid.github.io/odontocloudsaas/'
const options = { auth: { autoRefreshToken: false, persistSession: false } }
const admin = createClient(targetUrl, serviceKey, options)

const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (usersError) throw new Error(`Unable to inspect test recipient: ${usersError.message}`)

const existingUser = usersPage.users.find(
  (user) => String(user.email || '').toLowerCase() === testEmail,
)

if (existingUser) {
  const browserClient = createClient(
    targetUrl,
    requireValue(process.env.TARGET_SUPABASE_ANON_KEY, 'TARGET_SUPABASE_ANON_KEY'),
    options,
  )
  const { error } = await browserClient.auth.resetPasswordForEmail(testEmail, { redirectTo })
  if (error) throw new Error(`Recovery email test failed: ${error.message}`)
  console.log('Auth accepted the recovery email test')
} else {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(testEmail, { redirectTo })
  if (error) throw new Error(`Invitation email test failed: ${error.message}`)
  if (!data.user?.id) throw new Error('Invitation test did not return a temporary user')

  const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
  if (cleanupError) throw new Error(`Temporary email-test cleanup failed: ${cleanupError.message}`)
  console.log('Auth accepted the invitation email test and removed the temporary user')
}
