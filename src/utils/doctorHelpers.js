// src/utils/doctorHelpers.js

/**
 * Determina si un usuario o perfil es exclusivamente un Doctor / Odontólogo / Profesional Médico.
 * Los administradores, recepcionistas o auxiliares NO se clasifican como profesionales/doctores 
 * a menos que posean explícitamente el perfil/rol de doctor o especialidad asignada.
 */
export const isDoctorUser = (u) => {
    if (!u) return false;
    if (u.activo === false) return false;

    const role = (u.role || u.rol || u.profileId || u.profile_id || u.profileName || u.profile_name || "").toString().toLowerCase().trim();
    const cargo = (u.cargo || u.tipo_usuario || u.perfil || u.tipoUsuario || "").toString().toLowerCase().trim();
    const profileName = (u.profileName || u.profile_name || u.nombrePerfil || "").toString().toLowerCase().trim();

    // 1. Verificación explícita de banderas booleanas de médico
    if (u.esDoctor === true || u.esOdontologo === true) return true;

    // 2. Coincidencia estricta con roles o cargos médicos/odontológicos
    const isDocRole = role.includes("doctor") || 
                      role.includes("odontolog") || 
                      role.includes("odontólog") || 
                      role.includes("especialista") ||
                      role.includes("medico") ||
                      role.includes("médico") ||
                      cargo.includes("doctor") ||
                      cargo.includes("odontolog") ||
                      cargo.includes("especialista") ||
                      profileName.includes("doctor") ||
                      profileName.includes("odontól") ||
                      profileName.includes("odontol");

    // 3. Roles administrativos o de soporte puro (Administrador, SuperAdmin, Recepcionista, Auxiliar)
    const isAdminOrSupport = role.includes("admin") || 
                             role.includes("recep") || 
                             role.includes("auxiliar") || 
                             cargo.includes("admin") || 
                             cargo.includes("recep") || 
                             profileName.includes("admin") || 
                             profileName.includes("recep");

    // Si es Administrador o Soporte y NO tiene un rol explícito de doctor -> NUNCA es profesional
    if (isAdminOrSupport && !isDocRole) {
        return false;
    }

    if (isDocRole) return true;

    // Si tiene especialidad clínica específica y no es admin/soporte
    const spec = (u.especialidad || "").toString().toLowerCase().trim();
    const hasSpec = !!spec && spec !== "ninguna" && spec !== "n/a" && spec !== "general";
    const hasSpecArray = Array.isArray(u.especialidades) && u.especialidades.length > 0;

    return (hasSpec || hasSpecArray) && !isAdminOrSupport;
};

export default {
    isDoctorUser
};
