// src/services/doctorSignatureService.js
// Servicio unificado para resolver la firma digital, registro médico y datos de doctores/odontólogos en OdontoCloud.

import supabase from "../lib/supabaseClient";

/**
 * Determina si un objeto de usuario o perfil posee el rol clínico de Doctor / Odontólogo
 */
export function isDoctorRole(user) {
  if (!user) return false;
  if (user.esDoctor === true || user.is_doctor === true || user.isDoctor === true) return true;
  
  const rol = String(user.rol || user.role || user.profileType || user.tipo || '').toLowerCase();
  if (
    rol === 'doctor' ||
    rol.includes('doctor') ||
    rol.includes('odontólog') ||
    rol.includes('odontolog') ||
    rol.includes('especialista') ||
    rol.includes('profesional') ||
    rol.includes('cirujan')
  ) {
    return true;
  }
  return false;
}

/**
 * Busca y retorna la firma y datos clínicos del doctor por su Nombre o ID.
 * SOLO retorna firma si el usuario corresponde a un profesional con rol de Doctor.
 */
export async function getDoctorSignatureAndData(doctorNameOrId, tenantId, currentUserProfile = null) {
  const result = {
    id: null,
    nombre: "",
    nombreCompleto: "",
    registroMedico: "",
    tarjetaProfesional: "",
    especialidad: "",
    firma: null,
    isDoctor: false
  };

  if (!doctorNameOrId && !currentUserProfile) return result;

  const targetIdentifier = String(doctorNameOrId || "").trim().toLowerCase();
  const currentUserId = String(currentUserProfile?.uid || currentUserProfile?.id || "").toLowerCase();
  const currentUserName = String(
    currentUserProfile?.nombreCompleto || 
    currentUserProfile?.displayName || 
    `${currentUserProfile?.nombre || ''} ${currentUserProfile?.apellido || ''}`.trim() ||
    currentUserProfile?.email || 
    ""
  ).toLowerCase();

  // 1. Validar si coincide con el usuario actualmente autenticado
  const matchesCurrentUser = !targetIdentifier || 
    targetIdentifier === currentUserId || 
    targetIdentifier === currentUserName ||
    (currentUserName && (targetIdentifier.includes(currentUserName) || currentUserName.includes(targetIdentifier)));

  if (matchesCurrentUser && currentUserProfile) {
    const isDoc = isDoctorRole(currentUserProfile);
    result.isDoctor = isDoc;
    result.id = currentUserProfile.id || currentUserProfile.uid;
    result.nombre = currentUserProfile.nombreCompleto || currentUserProfile.displayName || `${currentUserProfile.nombre || ''} ${currentUserProfile.apellido || ''}`.trim();
    result.nombreCompleto = result.nombre;
    result.registroMedico = currentUserProfile.registroMedico || currentUserProfile.tarjetaProfesional || currentUserProfile.registro_medico || "";
    result.tarjetaProfesional = result.registroMedico;
    result.especialidad = currentUserProfile.especialidad || (Array.isArray(currentUserProfile.especialidades) ? currentUserProfile.especialidades.join(", ") : "Odontología General");
    
    // Asignar firma solo si tiene rol de doctor
    if (isDoc) {
      result.firma = currentUserProfile.firmaElectronica || currentUserProfile.firma || currentUserProfile.firma_url || null;
    }
    
    if (result.firma && result.registroMedico) {
      return result;
    }
  }

  const effectiveTenantId = tenantId || currentUserProfile?.inquilino || currentUserProfile?.tenantId;

  // 2. Buscar en website_config.config.user_details y website_config.config.profesionales
  if (effectiveTenantId) {
    try {
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      if (cfgRow?.config) {
        const userDetails = cfgRow.config.user_details || {};
        const configUsers = cfgRow.config.usuarios || cfgRow.config.users || [];
        const configProfs = cfgRow.config.profesionales || cfgRow.config.doctores || [];

        // A. Buscar en user_details
        for (const [uid, detail] of Object.entries(userDetails)) {
          const detailName = `${detail.nombre || ''} ${detail.apellido || ''}`.trim().toLowerCase();
          const detailFull = String(detail.nombreCompleto || detail.displayName || '').toLowerCase();
          const matches = uid.toLowerCase() === targetIdentifier || 
            (detailName && (targetIdentifier.includes(detailName) || detailName.includes(targetIdentifier))) ||
            (detailFull && (targetIdentifier.includes(detailFull) || detailFull.includes(targetIdentifier)));

          if (matches) {
            const isDoc = isDoctorRole(detail);
            result.isDoctor = isDoc;
            result.id = uid;
            result.nombre = detail.nombreCompleto || detail.displayName || `${detail.nombre || ''} ${detail.apellido || ''}`.trim();
            result.nombreCompleto = result.nombre;
            result.registroMedico = detail.registroMedico || detail.tarjetaProfesional || detail.registro_medico || result.registroMedico;
            result.tarjetaProfesional = result.registroMedico;
            result.especialidad = detail.especialidad || (Array.isArray(detail.especialidades) ? detail.especialidades.join(", ") : result.especialidad);
            if (isDoc) {
              result.firma = detail.firmaElectronica || detail.firma || detail.firma_url || result.firma;
            }
            if (result.firma) return result;
          }
        }

        // B. Buscar en profesionales de config
        for (const prof of configProfs) {
          const pName = String(prof.nombre || prof.nombreCompleto || prof.name || '').toLowerCase();
          const pId = String(prof.id || prof.uid || '').toLowerCase();
          if (pId === targetIdentifier || (pName && (targetIdentifier.includes(pName) || pName.includes(targetIdentifier)))) {
            result.isDoctor = true;
            result.id = prof.id || prof.uid;
            result.nombre = prof.nombre || prof.nombreCompleto || result.nombre;
            result.nombreCompleto = result.nombre;
            result.registroMedico = prof.registroMedico || prof.tarjetaProfesional || prof.registro_medico || result.registroMedico;
            result.tarjetaProfesional = result.registroMedico;
            result.especialidad = prof.especialidad || result.especialidad;
            result.firma = prof.firma || prof.firmaElectronica || prof.firma_url || result.firma;
            if (result.firma) return result;
          }
        }
      }
    } catch (e) {
      console.warn("Aviso al consultar website_config para firma del doctor:", e);
    }
  }

  // 3. Buscar en tabla profiles
  try {
    let query = supabase.from("profiles").select("*");
    if (effectiveTenantId) query = query.eq("tenant_id", effectiveTenantId);
    const { data: profiles } = await query;

    if (profiles && Array.isArray(profiles)) {
      for (const p of profiles) {
        const pName = String(p.full_name || p.nombreCompleto || p.email || '').toLowerCase();
        const pId = String(p.id || '').toLowerCase();
        if (pId === targetIdentifier || (pName && (targetIdentifier.includes(pName) || pName.includes(targetIdentifier)))) {
          const isDoc = isDoctorRole(p);
          result.isDoctor = isDoc;
          result.id = p.id;
          result.nombre = p.full_name || p.nombreCompleto || result.nombre;
          result.nombreCompleto = result.nombre;
          result.registroMedico = p.registro_medico || p.registroMedico || p.tarjetaProfesional || result.registroMedico;
          result.tarjetaProfesional = result.registroMedico;
          result.especialidad = p.especialidad || result.especialidad;
          if (isDoc) {
            result.firma = p.firma || p.firma_url || p.firmaElectronica || result.firma;
          }
          if (result.firma) return result;
        }
      }
    }
  } catch (e) {}

  // 4. Buscar en tabla profesionales
  try {
    let query = supabase.from("profesionales").select("*");
    if (effectiveTenantId) query = query.eq("tenant_id", effectiveTenantId);
    const { data: profs } = await query;

    if (profs && Array.isArray(profs)) {
      for (const p of profs) {
        const pName = String(p.nombre_completo || p.nombre || '').toLowerCase();
        const pId = String(p.id || '').toLowerCase();
        if (pId === targetIdentifier || (pName && (targetIdentifier.includes(pName) || pName.includes(targetIdentifier)))) {
          result.isDoctor = true;
          result.id = p.id;
          result.nombre = p.nombre_completo || p.nombre || result.nombre;
          result.nombreCompleto = result.nombre;
          result.registroMedico = p.registro_medico || p.tarjeta_profesional || p.registroMedico || result.registroMedico;
          result.tarjetaProfesional = result.registroMedico;
          result.especialidad = p.especialidad || result.especialidad;
          result.firma = p.firma || p.firma_url || p.firmaElectronica || result.firma;
          if (result.firma) return result;
        }
      }
    }
  } catch (e) {}

  return result;
}
