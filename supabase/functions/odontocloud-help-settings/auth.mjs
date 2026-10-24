export async function authenticateHelpSettings(admin, token) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role, activo').eq('id', data.user.id).maybeSingle();
  return { userId: data.user.id, superadmin: !profileError && profile?.activo === true &&
    String(profile.role || '').trim().toLowerCase() === 'superadmin' };
}
