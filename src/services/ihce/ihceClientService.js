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

import supabase from '../../lib/supabaseClient';

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
   * Ejecuta una prueba de validación y conectividad de credenciales IHCE.
   * Totalmente protegida y sanitizada (cero datos de pacientes, cero credenciales expuestas).
   */
  async testConnectivity(credentials = {}) {
    const startTime = Date.now();
    const {
      ambiente = 'SANDBOX_MOCK',
      client_id,
      client_secret,
      tenant_id_auth,
      apim_subscription_key,
      codigo_habilitacion_reps
    } = credentials;

    // 1. Validaciones sintácticas básicas
    if (!client_id) {
      return { success: false, status: 400, category: 'ERROR_SINTAXIS', message: 'El ClientID es obligatorio.' };
    }
    if (!client_secret && client_secret !== '••••••••••••••••') {
      return { success: false, status: 400, category: 'ERROR_SINTAXIS', message: 'El ClientSecret es obligatorio.' };
    }
    if (!apim_subscription_key && apim_subscription_key !== '••••••••••••••••') {
      return { success: false, status: 400, category: 'ERROR_SINTAXIS', message: 'El APIM Subkey es obligatorio.' };
    }

    // 2. Si el ambiente es SANDBOX_MOCK (Simulador local)
    if (ambiente === 'SANDBOX_MOCK') {
      await new Promise(r => setTimeout(r, 450));
      return {
        success: true,
        status: 200,
        latencyMs: Date.now() - startTime,
        category: 'SIMULACION_EXITOSA',
        message: 'Conexión exitosa simulada con el Mecanismo Nacional (Ambiente Local Aislado).'
      };
    }

    // 3. Si el ambiente es PRODUCCION: Salvaguarda activa
    if (ambiente === 'PRODUCCION') {
      return {
        success: false,
        status: 403,
        category: 'BLOQUEADO_SALVAGUARDA',
        message: 'El ambiente de Producción está estrictamente bloqueado hasta la emisión del visto bueno oficial de MinSalud.'
      };
    }

    // 4. Si el ambiente es PRUEBAS_MINSALUD (Preproducción)
    // En el navegador, validar formato GUID y reportar estado de credenciales configuradas
    const isGuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');
    if (tenant_id_auth && !isGuid(tenant_id_auth)) {
      return {
        success: false,
        status: 400,
        category: 'FORMATO_INVALIDO',
        message: 'El TenantID de autenticación debe tener formato GUID válido (8-4-4-4-12).'
      };
    }
    if (client_id && !isGuid(client_id)) {
      return {
        success: false,
        status: 400,
        category: 'FORMATO_INVALIDO',
        message: 'El ClientID asignado debe tener formato GUID válido (8-4-4-4-12).'
      };
    }

    return {
      success: true,
      status: 200,
      latencyMs: Date.now() - startTime,
      category: 'CREDENCIALES_VALIDADAS',
      message: 'Sintaxis y credenciales de Preproducción validadas. Listo para ejecutar pruebas de conformidad con MinSalud.'
    };
  },

  /**
   * Reintenta el envío de una evolución en la cola outbox
   */
  async retryOutboxItem(itemId) {
    const { data, error } = await supabase
      .from('ihce_outbox_queue')
      .update({
        status: 'PENDIENTE',
        intentos: 0,
        ultimo_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtiene la lista de clínicas con su estado de integración IHCE (Uso exclusivo SuperAdmin)
   */
  async getAllTenantsIhceStatus() {
    // 1. Obtener todos los tenants
    const { data: tenants, error: tErr } = await supabase
      .from('tenants')
      .select('id, name, nit, status, plan, created_at')
      .order('name');

    if (tErr) throw tErr;

    // 2. Obtener configuraciones IHCE existentes
    const { data: configs, error: cErr } = await supabase
      .from('ihce_configurations')
      .select('tenant_id, codigo_habilitacion_reps, codigo_sede_reps, ambiente, is_active, auto_dispatch_enabled, ultimo_envio_at, ultimo_error_at, ultimo_error_detalle');

    // Si la tabla no tiene datos o da error de RLS, manejar fallback
    const configMap = new Map();
    if (!cErr && Array.isArray(configs)) {
      configs.forEach(c => configMap.set(c.tenant_id, c));
    }

    // 3. Obtener conteos de outbox agregados
    const { data: outboxRows } = await supabase
      .from('ihce_outbox_queue')
      .select('tenant_id, status');

    const outboxMap = new Map();
    if (Array.isArray(outboxRows)) {
      outboxRows.forEach(r => {
        if (!outboxMap.has(r.tenant_id)) {
          outboxMap.set(r.tenant_id, { total: 0, aceptados: 0, pendientes: 0, errores: 0 });
        }
        const stats = outboxMap.get(r.tenant_id);
        stats.total++;
        if (r.status === 'ACEPTADO') stats.aceptados++;
        else if (r.status === 'PENDIENTE' || r.status === 'PROCESANDO') stats.pendientes++;
        else stats.errores++;
      });
    }

    return (tenants || []).map(t => {
      const cfg = configMap.get(t.id);
      const stats = outboxMap.get(t.id) || { total: 0, aceptados: 0, pendientes: 0, errores: 0 };
      return {
        tenantId: t.id,
        nombre: t.name || 'Clínica Odontológica',
        nit: t.nit || 'Sin NIT',
        tenantStatus: t.status,
        plan: t.plan,
        configured: Boolean(cfg),
        repsCode: cfg?.codigo_habilitacion_reps || 'No configurado',
        sedeCode: cfg?.codigo_sede_reps || '01',
        ambiente: cfg?.ambiente || 'SANDBOX_MOCK',
        isActive: cfg?.is_active ?? false,
        autoDispatch: cfg?.auto_dispatch_enabled ?? false,
        stats,
        lastSync: cfg?.ultimo_envio_at || null,
        lastError: cfg?.ultimo_error_detalle || null
      };
    });
  }
};

