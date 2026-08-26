// src/utils/doctorHelpers.js

/**
 * Determina si un usuario o perfil es un Doctor / Odontólogo / Profesional Médico.
 * REGLA PRINCIPAL: Todo usuario con el interruptor "Es doctor" (esDoctor: true / es_doctor: true)
 * ES UN PROFESIONAL MÉDICO, sin importar si su rol administrativo es Administrador, Propietario u otro.
 */
export const isDoctorUser = (u, detail = null) => {
    if (!u) return false;
    if (u.activo === false) return false;

    // 1. Verificación explícita de banderas booleanas de médico (MÁXIMA PRIORIDAD)
    if (
        u.esDoctor === true || 
        u.es_doctor === true || 
        u.is_doctor === true || 
        u.isDoctor === true || 
        u.esOdontologo === true ||
        detail?.esDoctor === true ||
        detail?.es_doctor === true ||
        detail?.is_doctor === true ||
        detail?.isDoctor === true
    ) {
        return true;
    }

    const role = (u.role || u.rol || u.profileId || u.profile_id || u.profileName || u.profile_name || detail?.rol || detail?.role || detail?.profileId || "").toString().toLowerCase().trim();
    const cargo = (u.cargo || u.tipo_usuario || u.perfil || u.tipoUsuario || detail?.cargo || "").toString().toLowerCase().trim();
    const profileName = (u.profileName || u.profile_name || u.nombrePerfil || detail?.profileName || "").toString().toLowerCase().trim();

    // 2. Coincidencia con roles o cargos médicos/odontológicos
    const isDocRole = role.includes("doctor") || 
                      role.includes("odontolog") || 
                      role.includes("odontólog") || 
                      role.includes("especialista") ||
                      role.includes("profesional") ||
                      role.includes("medico") ||
                      role.includes("médico") ||
                      cargo.includes("doctor") ||
                      cargo.includes("odontolog") ||
                      cargo.includes("especialista") ||
                      cargo.includes("profesional") ||
                      profileName.includes("doctor") ||
                      profileName.includes("odontól") ||
                      profileName.includes("odontol");

    if (isDocRole) return true;

    // 3. Especialidades clínicas configuradas
    const spec = (u.especialidad || detail?.especialidad || "").toString().toLowerCase().trim();
    const hasSpec = !!spec && spec !== "ninguna" && spec !== "n/a" && spec !== "general";
    const hasSpecArray = (Array.isArray(u.especialidades) && u.especialidades.length > 0) || 
                         (Array.isArray(detail?.especialidades) && detail.especialidades.length > 0);

    if (hasSpec || hasSpecArray) return true;

    return false;
};

export default {
    isDoctorUser
};
