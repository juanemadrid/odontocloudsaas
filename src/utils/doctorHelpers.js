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

/**
 * Normaliza cadenas de texto para comparaciones seguras (sin acentos, minúsculas, sin espacios extras).
 */
const normalizeText = (str) => {
    return (str || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
};

/**
 * Obtiene la lista unificada de doctores/profesionales asignados a un paciente.
 */
export const getPatientAssignedDoctors = (patient) => {
    if (!patient) return [];
    let assigned = [];
    const pHist = patient.historial_medico || patient.historialMedico;
    
    if (Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
        assigned = patient.profesionales;
    } else if (Array.isArray(pHist?.profesionales) && pHist.profesionales.length > 0) {
        assigned = pHist.profesionales;
    } else if (patient.profesional_nombre || patient.profesionalNombre) {
        assigned = [{
            id: patient.profesional_id || patient.profesionalId || "default-doc",
            nombre: patient.profesional_nombre || patient.profesionalNombre,
            nombreCompleto: patient.profesional_nombre || patient.profesionalNombre
        }];
    }

    const mapDoctors = new Map();
    assigned.forEach(d => {
        if (!d) return;
        const name = d.nombreCompleto || d.nombre || `${d.nombres || ''} ${d.apellidos || ''}`.trim() || d.displayName || '';
        const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
        if (name.trim() && docId) {
            mapDoctors.set(docId, {
                id: docId,
                nombre: name,
                nombreCompleto: name,
                email: d.email || d.correo || '',
                identificacion: d.identificacion || d.registro_medico || d.registroMedico || '',
                raw: d
            });
        }
    });

    return Array.from(mapDoctors.values());
};

/**
 * Determina si el usuario autenticado (si es doctor) está asignado como profesional a este paciente.
 * - Si el usuario NO es doctor (ej: Administrador, Superadmin, Recepción), retorna true permitiendo gestión administrativa.
 * - Si el usuario ES doctor, retorna true ÚNICAMENTE si está formalmente vinculado en los profesionales del paciente.
 */
export const isDoctorAssignedToPatient = (userProfile, patient) => {
    if (!userProfile || !patient) return false;

    // Si el usuario NO es doctor, no aplica la restricción clínica de asignación directa
    if (!isDoctorUser(userProfile)) {
        return true;
    }

    const assigned = getPatientAssignedDoctors(patient);
    if (!assigned || assigned.length === 0) {
        return false;
    }

    const myId = String(userProfile.uid || userProfile.id || '').toLowerCase().trim();
    const myEmail = normalizeText(userProfile.email || '');
    const myName = normalizeText(
        userProfile.nombreCompleto || 
        userProfile.nombre || 
        `${userProfile.nombre || ''} ${userProfile.apellido || ''}`.trim() || 
        userProfile.displayName || 
        ''
    );

    return assigned.some(d => {
        const docId = String(d.id || d.uid || '').toLowerCase().trim();
        const docEmail = normalizeText(d.email || d.correo || '');
        const docName = normalizeText(d.nombreCompleto || d.nombre || '');

        // 1. Coincidencia por ID de usuario
        if (myId && docId && myId === docId) return true;

        // 2. Coincidencia por correo electrónico
        if (myEmail && docEmail && myEmail === docEmail) return true;

        // 3. Coincidencia por nombre completo
        if (myName && docName) {
            if (myName === docName) return true;
            if (myName.length > 5 && (myName.includes(docName) || docName.includes(myName))) return true;
        }

        return false;
    });
};

export default {
    isDoctorUser,
    getPatientAssignedDoctors,
    isDoctorAssignedToPatient
};
