import { HelpError } from './handler.mjs';

export async function authenticateHelp(admin, token) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HelpError(401, 'La sesión no es válida.');
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('tenant_id, activo').eq('id', data.user.id).maybeSingle();
  if (profileError || !profile?.tenant_id || profile.activo === false) throw new HelpError(403, 'Tu perfil no tiene acceso.');
  const { data: tenant, error: tenantError } = await admin.from('tenants')
    .select('id, activo').eq('id', profile.tenant_id).maybeSingle();
  if (tenantError || !tenant || tenant.activo === false) throw new HelpError(403, 'La clínica no tiene acceso.');
  return { userId: data.user.id, tenantId: tenant.id, active: true };
}
