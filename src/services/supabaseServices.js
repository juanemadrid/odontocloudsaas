// src/services/supabaseServices.js
// Servicios centralizados para centralizar todas las operaciones de datos en Supabase

import supabase from "../lib/supabaseClient";
import { getConfigSection, saveConfigSection } from "./configPersistenceService";

// ===============================================================
// 1. RECIBOS DE CAJA
// ===============================================================

export const recibosCajaService = {
  // Obtener todos los recibos de un tenant
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("recibos_caja")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Crear nuevo recibo
  async create(tenantId, reciboData) {
    // Obtener consecutivo
    const consecutivo = await this.getNextConsecutivo(tenantId);
    
    const payload = {
      tenant_id: tenantId,
      nro_consecutivo: consecutivo.toString().padStart(6, '0'),
      fecha: reciboData.fecha || new Date().toISOString().split('T')[0],
      profesional_id: reciboData.profesionalId,
      profesional_nombre: reciboData.profesionalNombre,
      paciente_id: reciboData.pacienteId,
      paciente_nombre: reciboData.pacienteNombre,
      condicion_pago: reciboData.condicionPago || 'Contado',
      medio_pago: reciboData.medioPago,
      conceptos: reciboData.conceptos || [],
      subtotal: reciboData.subtotal || 0,
      descuento_total: reciboData.descuentoTotal || 0,
      total: reciboData.total,
      observaciones: reciboData.observaciones || "",
      caja_id: reciboData.cajaId,
      creado_por: reciboData.creadoPor
    };

    const { data, error } = await supabase
      .from("recibos_caja")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Actualizar consecutivo
    await this.updateConsecutivo(tenantId, consecutivo + 1);
    
    return data;
  },

  // Anular recibo
  async anular(id, motivoAnulacion, anuladoPor) {
    const { data, error } = await supabase
      .from("recibos_caja")
      .update({
        estado: 'anulado',
        motivo_anulacion: motivoAnulacion,
        anulado_por: anuladoPor,
        anulado_en: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Obtener siguiente consecutivo sincronizado desde la configuración de la clínica
  async getNextConsecutivo(tenantId, tipoField = "contReciboCaja") {
    try {
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const config = cfgRow?.config || {};
      const list = Array.isArray(config.consecutivos) ? config.consecutivos : [];
      const activeCons = list[0] || {};

      let val = Number(activeCons[tipoField] ?? 0);

      // Fallback a conteo de tabla si el valor es 0
      if (!val || val === 0) {
        try {
          const { data: maxRow } = await supabase
            .from("recibos_caja")
            .select("nro_consecutivo")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (maxRow?.nro_consecutivo) {
            val = parseInt(maxRow.nro_consecutivo, 10) || 0;
          }
        } catch (e) {}
      }

      return (val > 0 ? val : 0) + 1;
    } catch (err) {
      console.warn("Error leyendo consecutivo desde website_config:", err.message);
      return 1;
    }
  },

  // Actualizar consecutivo en website_config para sincronización inmediata
  async updateConsecutivo(tenantId, nuevoValor, tipoField = "contReciboCaja") {
    try {
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const list = Array.isArray(currentConfig.consecutivos) ? currentConfig.consecutivos : [];

      let updatedList;
      if (list.length > 0) {
        updatedList = list.map((item, idx) => idx === 0 ? { ...item, [tipoField]: nuevoValor } : item);
      } else {
        updatedList = [{ id: "consecutivo-principal", nombre: "Consecutivo Principal", [tipoField]: nuevoValor }];
      }

      await supabase
        .from("website_config")
        .upsert({
          tenant_id: tenantId,
          config: {
            ...currentConfig,
            consecutivos: updatedList,
            updatedAt: new Date().toISOString()
          }
        }, { onConflict: "tenant_id" });
    } catch (err) {
      console.warn("Advertencia al actualizar consecutivo en website_config:", err.message);
    }
  }
};

// ===============================================================
// 2. CAJAS
// ===============================================================

export const cajasService = {
  // Obtener cajas de un tenant
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("cajas")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Abrir nueva caja
  async abrir(tenantId, usuarioId, usuarioNombre, saldoInicial = 0) {
    const payload = {
      tenant_id: tenantId,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      estado: 'abierta',
      saldo_inicial: saldoInicial,
      saldo_actual: saldoInicial
    };

    const { data, error } = await supabase
      .from("cajas")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Cerrar caja
  async cerrar(cajaId, observaciones = "") {
    const { data, error } = await supabase
      .from("cajas")
      .update({
        estado: 'cerrada',
        fecha_cierre: new Date().toISOString(),
        observaciones
      })
      .eq("id", cajaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar saldo de caja
  async actualizarSaldo(cajaId, nuevoSaldo, tipoMovimiento, monto) {
    // Calcular totales
    let totalIngresos = 0;
    let totalEgresos = 0;

    if (tipoMovimiento === 'ingreso') {
      totalIngresos = monto;
    } else {
      totalEgresos = monto;
    }

    const { data, error } = await supabase
      .from("cajas")
      .update({
        saldo_actual: nuevoSaldo,
        total_ingresos: supabase.sql`total_ingresos + ${totalIngresos}`,
        total_egresos: supabase.sql`total_egresos + ${totalEgresos}`
      })
      .eq("id", cajaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ===============================================================
// 3. MOVIMIENTOS DE CAJA
// ===============================================================

export const movimientosCajaService = {
  // Obtener movimientos de una caja
  async getByCaja(cajaId) {
    const { data, error } = await supabase
      .from("movimientos_caja")
      .select("*")
      .eq("caja_id", cajaId)
      .order("fecha", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Crear movimiento
  async create(movimientoData) {
    const payload = {
      caja_id: movimientoData.cajaId,
      tenant_id: movimientoData.tenantId,
      tipo: movimientoData.tipo, // 'ingreso' o 'egreso'
      concepto: movimientoData.concepto,
      monto: movimientoData.monto,
      metodo_pago: movimientoData.metodoPago,
      descripcion: movimientoData.descripcion || "",
      paciente_id: movimientoData.pacienteId,
      paciente_nombre: movimientoData.pacienteNombre,
      recibo_id: movimientoData.reciboId,
      usuario_id: movimientoData.usuarioId,
      usuario_nombre: movimientoData.usuarioNombre,
      fecha: movimientoData.fecha || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("movimientos_caja")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ===============================================================
// 4. PROFESIONALES
// ===============================================================

export const profesionalesService = {
  // Obtener profesionales de un tenant
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("profesionales")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("activo", true)
      .order("nombre_completo");
    
    if (error) throw error;
    return data || [];
  },

  // Crear profesional
  async create(tenantId, profesionalData) {
    const payload = {
      tenant_id: tenantId,
      nombre_completo: profesionalData.nombreCompleto,
      especialidad: profesionalData.especialidad || "",
      telefono: profesionalData.telefono || "",
      email: profesionalData.email || "",
      registro_medico: profesionalData.registroMedico || ""
    };

    const { data, error } = await supabase
      .from("profesionales")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar profesional
  async update(id, updates) {
    const { data, error } = await supabase
      .from("profesionales")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Desactivar profesional
  async deactivate(id) {
    return this.update(id, { activo: false });
  }
};

// ===============================================================
// 5. EPS CATÁLOGO
// ===============================================================

export const epsCatalogoService = {
  // Obtener EPS de un tenant
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("eps_catalogo")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("activo", true)
      .order("nombre");
    
    if (error) throw error;
    return data || [];
  },

  // Crear EPS
  async create(tenantId, nombre, codigo = "") {
    const payload = {
      tenant_id: tenantId,
      nombre: nombre.trim(),
      codigo: codigo.trim()
    };

    const { data, error } = await supabase
      .from("eps_catalogo")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ===============================================================
// 6. BARRIOS CATÁLOGO
// ===============================================================

export const barriosCatalogoService = {
  // Obtener barrios de un tenant
  async getByTenant(tenantId) {
    try {
      const { data, error } = await supabase
        .from("barrios_catalogo")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nombre");
      
      if (error) {
        console.warn("barrios_catalogo getByTenant notice:", error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // Crear barrio
  async create(tenantId, nombre, ciudad = "") {
    const payload = {
      tenant_id: tenantId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim()
    };

    try {
      const { data, error } = await supabase
        .from("barrios_catalogo")
        .insert([payload])
        .select();

      if (error) {
        console.warn("barrios_catalogo create notice (RLS/Permission):", error.message);
        return payload;
      }
      return data?.[0] || payload;
    } catch (e) {
      console.warn("barrios_catalogo create catch:", e.message);
      return payload;
    }
  }
};

// ===============================================================
// 7. MÉTODOS DE PAGO
// ===============================================================

export const metodosPagoService = {
  // Obtener métodos de pago de un tenant
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("metodos_pago")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("activo", true)
      .order("orden", "nombre");
    
    if (error) throw error;
    return data || [];
  },

  // Crear método de pago
  async create(tenantId, metodoData) {
    const payload = {
      tenant_id: tenantId,
      nombre: metodoData.nombre,
      requiere_referencia: metodoData.requiereReferencia || false,
      orden: metodoData.orden || 0
    };

    const { data, error } = await supabase
      .from("metodos_pago")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ===============================================================
// 8. CONFIGURACIÓN DE FORMULARIOS
// ===============================================================

export const configuracionFormulariosService = {
  // Obtener configuración de formulario (primero website_config, luego configuracion_formularios, luego legacy)
  async get(tenantId, tipoFormulario = "formulario_pacientes") {
    if (!tenantId) return null;
    try {
      // 1. Principal: sección cacheada de website_config para la clínica activa
      const websiteConfig = await getConfigSection(tenantId, tipoFormulario, null);
      if (websiteConfig) return websiteConfig;

      // 2. Fallback: tabla configuracion_formularios
      const { data: formCfg, error: formErr } = await supabase
        .from("configuracion_formularios")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("tipo_formulario", tipoFormulario)
        .maybeSingle();

      if (!formErr && formCfg?.configuracion) {
        return formCfg.configuracion;
      }
    } catch (e) {
      console.warn(`Error fetching ${tipoFormulario} config:`, e);
    }
    return null;
  },

  // Guardar configuración de formulario en website_config
  async save(tenantId, tipoFormulario = "formulario_pacientes", configuracion) {
    if (!tenantId) throw new Error("Tenant ID no proporcionado");

    await saveConfigSection(tenantId, tipoFormulario, configuracion);

    const { error } = await supabase
      .from("configuracion_formularios")
      .upsert([{
        tenant_id: tenantId,
        tipo_formulario: tipoFormulario,
        configuracion
      }], { onConflict: "tenant_id,tipo_formulario" });

    if (error) throw error;
    return configuracion;

  }
};

// ===============================================================
// 9. DOCUMENTOS CLÍNICOS
// ===============================================================

export const documentosClinicosService = {
  // Obtener documentos de un paciente
  async getByPaciente(pacienteId, tipo = null) {
    const client = supabaseAdmin || supabase;
    let query = client
      .from("documentos_clinicos")
      .select("*")
      .eq("paciente_id", pacienteId);

    if (tipo) {
      query = query.eq("tipo_documento", tipo);
    }

    const { data, error } = await query
      .order("fecha_documento", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Crear documento clínico
  async create(tenantId, documentoData) {
    const payload = {
      tenant_id: tenantId,
      paciente_id: documentoData.pacienteId,
      tipo_documento: documentoData.tipoDocumento,
      contenido: documentoData.contenido,
      creado_por: documentoData.creadoPor,
      fecha_documento: documentoData.fechaDocumento || new Date().toISOString().split('T')[0]
    };

    const { data, error } = await supabase
      .from("documentos_clinicos")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar documento
  async update(id, updates) {
    const { data, error } = await supabase
      .from("documentos_clinicos")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Firmar documento
  async firmar(id, firmaData) {
    const updates = {
      firma_doctor: firmaData.firmaDoctor,
      firmado_en: new Date().toISOString(),
      firmado_por: firmaData.firmadoPor
    };

    return this.update(id, updates);
  }
};

// ===============================================================
// 10. UTILIDADES GENERALES
// ===============================================================

export const supabaseUtils = {
  // Obtener configuración del tenant
  async getTenantConfig(tenantId) {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (error) throw error;
    return data;
  },

  // Búsqueda de pacientes (mediante consultas de Supabase)
  async searchPacientes(tenantId, searchTerm, limit = 20) {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nombres, apellidos, documento, telefono, email")
      .eq("tenant_id", tenantId)
      .or(`nombres.ilike.%${searchTerm}%,apellidos.ilike.%${searchTerm}%,documento.ilike.%${searchTerm}%`)
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Función genérica para obtener datos con paginación
  async getPaginatedData(tableName, tenantId, page = 0, pageSize = 20, orderBy = "created_at") {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error, count } = await supabase
      .from(tableName)
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order(orderBy, { ascending: false })
      .range(start, end);

    if (error) throw error;

    return {
      data: data || [],
      hasMore: count ? end < count - 1 : false,
      totalCount: count || 0
    };
  }
};

// ===============================================================
// 10. UNIFIED DOCTOR LOADER
// ===============================================================

export const getDoctorsList = async (userProfile, patient = null) => {
  // 1. If a patient is provided, return ONLY the professionals assigned to that patient (from ProfesionalesTab / historial_medico)
  if (patient) {
    let assigned = [];
    const pHist = patient.historial_medico || patient.historialMedico;
    
    if (patient.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
      assigned = patient.profesionales;
    } else if (pHist?.profesionales && Array.isArray(pHist.profesionales) && pHist.profesionales.length > 0) {
      assigned = pHist.profesionales;
    } else if (patient.id) {
      try {
        const { data: pData } = await supabase
          .from("pacientes")
          .select("historial_medico, profesional_id, profesional_nombre")
          .eq("id", patient.id)
          .maybeSingle();
        if (pData?.historial_medico?.profesionales && Array.isArray(pData.historial_medico.profesionales) && pData.historial_medico.profesionales.length > 0) {
          assigned = pData.historial_medico.profesionales;
        } else if (pData?.profesional_nombre) {
          assigned = [{ id: pData.profesional_id || "default-doc", nombre: pData.profesional_nombre }];
        }
      } catch (err) {
        console.warn("Error fetching assigned professionals for patient:", err);
      }
    } else if (patient.profesional_nombre || patient.profesionalNombre) {
      assigned = [{ id: patient.profesional_id || patient.profesionalId || "default-doc", nombre: patient.profesional_nombre || patient.profesionalNombre }];
    }

    if (assigned && assigned.length > 0) {
      const mapDoctors = new Map();
      assigned.forEach(d => {
        const name = d.nombreCompleto || d.nombre || `${d.nombres || ''} ${d.apellidos || ''}`.trim();
        const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
        if (name.trim() && docId) {
          mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: d.email || '', raw: d });
        }
      });
      return Array.from(mapDoctors.values()).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    }

    // Patient has no assigned professionals
    return [];
  }

  // 2. If NO patient is provided (global/tenant context), load all tenant professionals/doctors:
  const mapDoctors = new Map();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // A. Tabla profesionales
  try {
    let query = supabase.from('profesionales').select('*');
    if (inquilino) {
      query = query.eq('tenant_id', inquilino);
    }
    const { data: profData } = await query;
    if (profData && Array.isArray(profData)) {
      profData.forEach(d => {
        if (d.activo !== false) {
          const name = d.nombre_completo || d.nombre || `${d.nombres || ''} ${d.apellidos || ''}`.trim();
          const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
          if (name.trim() && docId && !mapDoctors.has(docId)) {
            mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: d.correo || d.email || '', raw: d });
          }
        }
      });
    }
  } catch (e) {}

  // B. Tabla profiles
  try {
    let query = supabase.from('profiles').select('*');
    if (inquilino) query = query.eq('tenant_id', inquilino);
    const { data: profsData } = await query;
    if (profsData && Array.isArray(profsData)) {
      profsData.forEach(u => {
        const name = u.full_name || u.nombreCompleto || u.nombre || u.email || '';
        const docId = String(u.id || (name ? name.toLowerCase() : ''));
        if (name.trim() && docId && !mapDoctors.has(docId)) {
          mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: u.email || '', raw: u });
        }
      });
    }
  } catch (e) {}

  // D. website_config
  try {
    if (inquilino) {
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      if (cfgRow?.config) {
        const usuarios = cfgRow.config.usuarios || cfgRow.config.users || [];
        const doctores = cfgRow.config.doctores || cfgRow.config.profesionales || [];

        usuarios.forEach(u => {
          const name = u.nombreCompleto || u.nombre || u.displayName || u.email || "";
          const docId = String(u.id || u.uid || (name ? name.toLowerCase() : ''));
          if (name.trim() && docId && !mapDoctors.has(docId)) {
            mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: u.email || '', raw: u });
          }
        });

        doctores.forEach(d => {
          const name = d.nombreCompleto || d.nombre || d.displayName || d.email || "";
          const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
          if (name.trim() && docId && !mapDoctors.has(docId)) {
            mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: d.email || '', raw: d });
          }
        });
      }
    }
  } catch (e) {}

  // E. SIEMPRE incluir al usuario actual en sesión (ej. Johne Madrid / Carlos Madrid)
  if (userProfile) {
    const myId = String(userProfile.uid || userProfile.id || 'current_user');
    const myName = userProfile.nombreCompleto ||
      userProfile.nombre ||
      `${userProfile.nombre || ''} ${userProfile.apellido || ''}`.trim() ||
      userProfile.displayName ||
      userProfile.email ||
      "Doctor Principal";

    if (myName.trim() && !mapDoctors.has(myId)) {
      mapDoctors.set(myId, { id: myId, nombre: myName, nombreCompleto: myName, email: userProfile.email || '' });
    }
  }

  // F. Fallback por si la clínica es nueva
  if (mapDoctors.size === 0) {
    mapDoctors.set('doc_default', { id: 'doc_default', nombre: 'Dr. Odontólogo Principal', nombreCompleto: 'Dr. Odontólogo Principal', email: '' });
  }

  return Array.from(mapDoctors.values());
};

export const getActiveCaja = async (tenantId, userId = null) => {
  if (!tenantId) return null;
  let activeCaja = null;

  // 1. Consultar tabla cajas en Supabase
  try {
    const { data: dbCajas } = await supabase
      .from("cajas")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("estado", "abierta");

    if (dbCajas && dbCajas.length > 0) {
      if (userId) {
        activeCaja = dbCajas.find(c => String(c.usuario_id || c.usuarioId) === String(userId));
      }
      if (!activeCaja) {
        activeCaja = dbCajas[0];
      }
    }
  } catch (e) {}

  // 2. Fallback a website_config
  if (!activeCaja) {
    try {
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const cfgCajas = cfgRow?.config?.cajas || [];
      const openCajas = cfgCajas.filter(c => (c.estado || "").toLowerCase() === "abierta");

      if (openCajas.length > 0) {
        if (userId) {
          activeCaja = openCajas.find(c => String(c.usuario_id || c.usuarioId) === String(userId));
        }
        if (!activeCaja) {
          activeCaja = openCajas[0];
        }
      }
    } catch (e) {}
  }

  return activeCaja;
};

export const epsCatalogo = epsCatalogoService;
export const barriosCatalogo = barriosCatalogoService;
export const configuracionFormularios = configuracionFormulariosService;

export default {
  recibosCaja: recibosCajaService,
  cajas: cajasService,
  movimientosCaja: movimientosCajaService,
  profesionales: profesionalesService,
  epsCatalogo: epsCatalogoService,
  barriosCatalogo: barriosCatalogoService,
  metodosPago: metodosPagoService,
  configuracionFormularios: configuracionFormulariosService,
  documentosClinicos: documentosClinicosService,
  getDoctorsList,
  getActiveCaja,
  utils: supabaseUtils
};
