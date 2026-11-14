// Nombre real de un usuario para mostrar y guardar (nunca la palabra "Usuario" ni el correo si hay nombre).

const GENERIC = new Set(["", "usuario", "user", "undefined", "null"]);

/** Nombre completo a partir de un perfil/usuario con cualquiera de los formatos del sistema. */
export function userDisplayName(p) {
  if (!p) return "";
  const joined = [p.nombre, p.apellido || p.apellidos].filter(Boolean).join(" ");
  const candidates = [
    p.nombreCompleto, p.nombre_completo, p.full_name, p.fullName, joined,
    p.displayName, p.user_metadata?.full_name, p.usuarioNombre, p.usuario_nombre,
  ];
  for (const c of candidates) {
    const v = String(c ?? "").trim();
    if (v && !GENERIC.has(v.toLowerCase()) && !v.includes("@")) return v;
  }
  return "";
}

/** Nombre real del usuario: del perfil en sesión o, si no lo trae, de la tabla profiles. */
export async function resolveUserName(supabase, userId, profile) {
  let name = userDisplayName(profile);
  if (name) return name;
  if (userId) {
    try {
      const { data } = await supabase.from("profiles").select("full_name, apellido").eq("id", userId).maybeSingle();
      name = userDisplayName(data);
    } catch (_) {}
  }
  if (name) return name;
  const email = String(profile?.email || "").trim();
  return email ? email.split("@")[0] : "";
}
