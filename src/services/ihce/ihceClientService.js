/**
 * IHCE Client Service — Adaptador Seguro para Frontend
 * 
 * Expone únicamente las operaciones autorizadas para el cliente web:
 * - Consulta de configuración mediante la vista segura (secretos enmascarados).
 * - Guardado de credenciales con Write-Only pattern (RPC save_clinic_ihce_configuration).
 * - Cierre y firma electrónica con verificación de credencial (RPC verify_and_close_evolution).
 * - Consulta de la bandeja de envíos RDA.
 * - Solicitud y aprobación de acceso Break-Glass.
 * 
 * NINGÚN secreto de integración, token de acceso o lógica de worker se procesa aquí.
 */

import { supabase } from '../supabaseClient';

export const ihceClientService = {
  /**
   * Obtiene la configuración de interoperabilidad de la clínica actual.
   * Los secretos vienen enmascarados como '••••••••••••••••' desde la base de datos.
   */
  async getClinicConfiguration() {
    const { data, error } = await supabase
      .from('ihce_configurations_secure_view')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error al obtener configuración IHCE:', error);
      throw error;
    }

    return data;
  },

  /**
   * Guarda o actualiza la configuración de la clínica usando el RPC seguro Write-Only.
   */
  async saveClinicConfiguration(configData) {
    const { data, error } = await supabase.rpc('save_clinic_ihce_configuration', {
      p_reps_code: configData.codigo_habilitacion_reps,
      p_sede_code: configData.codigo_sede_reps || '01',
      p_nombre_prestador: configData.nombre_prestador,
      p_nit: configData.nit,
      p_ambiente: configData.ambiente || 'SANDBOX_MOCK',
      p_client_id: configData.client_id,
      p_client_secret: configData.client_secret || null,
      p_is_active: configData.is_active ?? false,
      p_auto_dispatch: configData.auto_dispatch_enabled ?? true,
      p_apim_subscription_key: configData.apim_subscription_key || null
    });

    if (error) {
      console.error('Error al guardar configuración IHCE:', error);
      throw error;
    }

    return data;
  },

  /**
   * Firma y sella la evolución con verificación de contraseña/PIN en el backend.
   */
  async verifyAndCloseEvolution(evolutionId, pinOrPassword) {
    const { data, error } = await supabase.rpc('verify_and_close_evolution', {
      p_evolution_id: evolutionId,
      p_pin_or_password: pinOrPassword
    });

    if (error) {
      console.error('Error al firmar y sellar evolución:', error);
      throw error;
    }

    if (data && data.success === false) {
      throw new Error(data.message || data.error || 'Error al firmar la evolución.');
    }

    return data;
  },

  /**
   * Consulta las tareas de la bandeja de envíos RDA para la clínica actual.
   */
  async getOutboxItems(limit = 50) {
    const { data, error } = await supabase
      .from('ihce_outbox_queue')
      .select(`
        id,
        evolution_id,
        paciente_id,
        status,
        radicado_oficial,
        ultimo_http_status,
        intentos,
        max_intentos,
        ultimo_error,
        created_at,
        updated_at,
        pacientes (
          nombres,
          apellidos,
          tipo_documento,
          documento
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error al obtener bandeja RDA:', error);
      throw error;
    }

    return (data || []).map(item => ({
      ...item,
      paciente_nombre: item.pacientes ? `${item.pacientes.nombres} ${item.pacientes.apellidos}` : 'Paciente',
      paciente_documento: item.pacientes ? `${item.pacientes.tipo_documento} ${item.pacientes.documento}` : 'N/A'
    }));
  },

  /**
   * Solicita acceso Break-Glass de soporte técnico (requiere aprobación del Administrador).
   */
  async requestSupportBreakGlass(pacienteId, motivo, ticket) {
    const { data, error } = await supabase.rpc('request_support_break_glass', {
      p_paciente_id: pacienteId,
      p_motivo: motivo,
      p_ticket: ticket
    });

    if (error) throw error;
    return data;
  },

  /**
   * Aprueba una solicitud de acceso Break-Glass (Acción exclusiva del Administrador de la clínica).
   */
  async approveBreakGlassRequest(sessionId) {
    const { data, error } = await supabase.rpc('approve_break_glass_request', {
      p_session_id: sessionId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Revoca una sesión Break-Glass activa de inmediato.
   */
  async revokeBreakGlassSession(sessionId, motivo) {
    const { data, error } = await supabase.rpc('revoke_break_glass_session', {
      p_session_id: sessionId,
      p_motivo_revocacion: motivo
    });

    if (error) throw error;
    return data;
  }
};
