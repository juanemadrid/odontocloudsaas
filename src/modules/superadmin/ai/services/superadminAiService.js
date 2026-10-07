import supabase from "../../../../lib/supabaseClient.js";

/**
 * Invoca la Edge Function superadmin-assistant utilizando exclusivamente
 * el JWT de la sesión autenticada del superadministrador.
 *
 * Cero service_role, cero credenciales hardcodeadas, cero Gemini/LLMs.
 */
export async function invokeSuperadminAssistant(action, payload = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    const err = new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    err.status = 401;
    throw err;
  }

  const token = sessionData.session.access_token;
  const baseUrl = supabase.supabaseUrl || "https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io";
  const url = `${baseUrl}/functions/v1/superadmin-assistant`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (netErr) {
    const err = new Error("No fue posible consultar los datos en este momento.");
    err.status = 0;
    err.original = netErr;
    throw err;
  }

  if (response.status === 401) {
    const err = new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    err.status = 401;
    throw err;
  }
  if (response.status === 403) {
    const err = new Error("No tienes permisos para acceder al Centro IA.");
    err.status = 403;
    throw err;
  }
  if (response.status === 429) {
    let msg = "El asistente alcanzó temporalmente el límite gratuito. Intenta nuevamente más tarde.";
    try {
      const errJson = await response.json();
      if (errJson?.message) msg = errJson.message;
    } catch (_) {}
    const err = new Error(msg);
    err.status = 429;
    throw err;
  }
  if (!response.ok) {
    let msg = "No fue posible consultar los datos en este momento.";
    try {
      const errJson = await response.json();
      if (errJson?.message) msg = errJson.message;
      else if (errJson?.error) msg = errJson.error;
    } catch (_) {}
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const result = await response.json();
  if (!result?.success) {
    const err = new Error(result?.error || "Error en la consulta administrativa.");
    err.status = response.status;
    throw err;
  }

  return result.data;
}

export const getDashboardSummary = () => invokeSuperadminAssistant("get_dashboard_summary");
export const getClinicsSummary = () => invokeSuperadminAssistant("get_clinics_summary");
export const getExpiringClinics = (days = 30) => invokeSuperadminAssistant("get_expiring_clinics", { days });
export const getRecentActivity = () => invokeSuperadminAssistant("get_recent_activity");
export const getFactusUsageSummary = () => invokeSuperadminAssistant("get_factus_usage_summary");
export const getSubscriptionRequestsPending = () => invokeSuperadminAssistant("get_subscription_requests_pending");
export const getRecentEmailIssues = () => invokeSuperadminAssistant("get_recent_email_issues");
export const getPaymentSummary = () => invokeSuperadminAssistant("get_payment_summary");

/**
 * Consulta a Gemini mediante superadmin-assistant (action: "ask_ai").
 * En caso de fallo o indisponibilidad del modelo, activa fallback determinista
 * con datos reales para las preguntas operativas soportadas.
 */
export async function askAiAssistant(question, history = [], dashboardData = null) {
  try {
    const res = await invokeSuperadminAssistant("ask_ai", { question, history });
    if (res?.answer) {
      return {
        text: res.answer,
        tags: ["Gemini 3.7", "Datos Reales"],
        tools_used: res.tools_used || [],
      };
    }
  } catch (err) {
    console.warn("Fallo o indisponibilidad en asistente IA, evaluando fallback:", err);

    if (err?.status === 429) {
      return {
        text: err.message || "El asistente alcanzó temporalmente el límite gratuito. Intenta nuevamente más tarde.",
        tags: ["Límite de Consultas"],
      };
    }

    // Fallback determinista usando datos reales para preguntas conocidas
    try {
      const fallback = await answerQueryDeterministically(question, dashboardData);
      if (fallback && !fallback.tags?.includes("Operaciones Disponibles")) {
        return {
          text: fallback.text,
          tags: [...fallback.tags, "Fallback Operativo"],
        };
      }
    } catch (_) {}

    return {
      text: "El asistente inteligente no está disponible en este momento. Las consultas operativas básicas siguen disponibles.",
      tags: ["Asistente No Disponible"],
    };
  }

  return {
    text: "El asistente inteligente no está disponible en este momento. Las consultas operativas básicas siguen disponibles.",
    tags: ["Asistente No Disponible"],
  };
}

/**
 * Enrutador determinista de respuestas rápidas sin LLM.
 * Consume exclusivamente los datos reales de las herramientas del backend.
 */
export async function answerQueryDeterministically(query, dashboardData = null) {
  const q = (query || "").toLowerCase().trim();

  // 1. Vencimientos (Prioridad alta en router de intención)
  if (
    q.includes("vence") ||
    q.includes("vencimiento") ||
    q.includes("próximas a vencer") ||
    q.includes("proximas a vencer") ||
    q.includes("este mes")
  ) {
    let expData = dashboardData?.expiring?.internal_admin;
    if (!expData) {
      const res = await getExpiringClinics(30);
      expData = res?.internal_admin;
    }
    const totalRiesgo = expData?.total_en_riesgo ?? 0;
    const clinicas = expData?.clinicas || [];

    if (totalRiesgo === 0) {
      return {
        text: `**Sin vencimientos próximos.** No se registran clínicas que venzan dentro de los próximos 30 días. Todas las suscripciones activas se encuentran al día.`,
        tags: ["Datos Reales", "Sin Vencimientos"],
      };
    }

    let text = `Se identificaron **${totalRiesgo} clínica(s)** con vencimiento próximo dentro de los siguientes 30 días:\n\n`;
    clinicas.forEach((c) => {
      text += `• **${c.nombre}** (Plan ${c.plan || "N/A"})\n  - Vence en: **${c.dias_restantes} día(s)** (${c.subscription_end_date || "Fecha no especificada"})\n  - Estado: *${c.estado === "proxima_a_vencer" ? "Próxima a vencer" : c.estado}*\n`;
    });
    return {
      text,
      tags: ["Datos Reales", `${totalRiesgo} en Riesgo`],
    };
  }

  // 2. Factus / Facturación
  if (
    q.includes("factus") ||
    q.includes("factura") ||
    q.includes("facturacion") ||
    q.includes("facturación") ||
    q.includes("folios")
  ) {
    let factusData = dashboardData?.factus?.internal_admin;
    if (!factusData) {
      const res = await getFactusUsageSummary();
      factusData = res?.internal_admin;
    }
    const conf = factusData?.clinicas_con_factus ?? 0;
    const asignados = factusData?.total_folios_asignados ?? 0;
    const usados = factusData?.total_folios_usados ?? 0;
    const disponibles = factusData?.total_folios_disponibles ?? 0;
    const produccion = factusData?.produccion ?? 0;
    const sandbox = factusData?.sandbox ?? 0;
    const clinicas = factusData?.clinicas || [];

    let text = `Estado operativo de **Facturación Electrónica (Factus)**:\n\n`;
    text += `• **Clínicas configuradas:** ${conf} (${produccion} en Producción, ${sandbox} en Sandbox)\n`;
    text += `• **Total folios asignados:** ${asignados}\n`;
    text += `• **Total folios consumidos:** ${usados}\n`;
    text += `• **Total folios disponibles:** ${disponibles}\n\n`;
    text += `**Desglose por clínica:**\n`;
    clinicas.forEach((c) => {
      if (c.configured) {
        text += `• **${c.nombre}**: Configurada (${c.environment === "production" ? "Producción" : "Sandbox"}) — ${c.disponibles} folios disponibles de ${c.cuota} asignados (${c.usadas} usados).\n`;
      } else {
        text += `• **${c.nombre}**: *No configurada*\n`;
      }
    });

    return {
      text,
      tags: ["Datos Reales", `${conf} con Factus`],
    };
  }

  // 3. Actividad
  if (
    q.includes("actividad") ||
    q.includes("accesos") ||
    q.includes("ingresos") ||
    q.includes("ultimos usuarios") ||
    q.includes("últimos usuarios")
  ) {
    let actData = dashboardData?.activity?.internal_admin;
    if (!actData) {
      const res = await getRecentActivity();
      actData = res?.internal_admin;
    }
    const totalActivas = actData?.clinicas_activas_ultimas_24h ?? 0;
    const ultimos = actData?.ultimos_ingresos || [];

    let text = `Actividad reciente en OdontoCloud:\n\n`;
    text += `• **Clínicas con actividad en las últimas 24h:** ${totalActivas}\n\n`;
    if (ultimos.length > 0) {
      text += `**Últimos accesos registrados:**\n`;
      ultimos.slice(0, 5).forEach((u) => {
        text += `• **${u.user_name || "Usuario"}** (${u.role || "Sin rol"})\n  - Clínica: ${u.clinic_name || "N/A"}\n  - Último acceso: ${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Reciente"}\n`;
      });
    } else {
      text += `No se registran accesos en las últimas 24h.\n`;
    }

    return {
      text,
      tags: ["Datos Reales", "Actividad 24h"],
    };
  }

  // 4. Solicitudes
  if (
    q.includes("solicitud") ||
    q.includes("solicitudes") ||
    q.includes("registro") ||
    q.includes("suscripciones")
  ) {
    let reqData = dashboardData?.requests?.internal_admin;
    if (!reqData) {
      const res = await getSubscriptionRequestsPending();
      reqData = res?.internal_admin;
    }
    const pendientes = reqData?.total_pendientes ?? 0;
    const solicitudes = reqData?.solicitudes || [];

    if (pendientes === 0) {
      return {
        text: `**Sin solicitudes pendientes.** No hay clínicas nuevas ni peticiones de suscripción esperando aprobación administrativa.`,
        tags: ["Datos Reales", "0 Pendientes"],
      };
    }

    let text = `Se registran **${pendientes} solicitud(es) de suscripción pendiente(s)**:\n\n`;
    solicitudes.forEach((s) => {
      text += `• **${s.nombre_clinica || s.email}**\n  - Plan solicitado: ${s.plan_solicitado || "Estándar"}\n  - Fecha: ${s.created_at ? new Date(s.created_at).toLocaleDateString() : "Reciente"}\n`;
    });
    return {
      text,
      tags: ["Datos Reales", `${pendientes} Pendientes`],
    };
  }

  // 5. Correos / Email
  if (
    q.includes("correo") ||
    q.includes("email") ||
    q.includes("resend") ||
    q.includes("incidencias") ||
    q.includes("fallos")
  ) {
    let emailData = dashboardData?.emailIssues?.internal_admin;
    if (!emailData) {
      const res = await getRecentEmailIssues();
      emailData = res?.internal_admin;
    }
    const fallidos = emailData?.total_fallidos_recientes ?? emailData?.total_fallidos ?? 0;
    const incidentes = emailData?.incidentes || [];

    if (fallidos === 0) {
      return {
        text: `**Servicio de correo saludable.** No se registran errores recientes en los envíos de correos transaccionales a través de Resend.`,
        tags: ["Datos Reales", "0 Fallos Resend"],
      };
    }

    let text = `Se detectó(aron) **${fallidos} incidencia(s) reciente(s) de correo** en la plataforma:\n\n`;
    incidentes.slice(0, 5).forEach((inc) => {
      text += `• **Destinatario:** ${inc.recipient_email || "N/A"}\n  - Asunto: *${inc.subject || "Sin asunto"}*\n  - Error: \`${inc.error_message || inc.error || "Fallo en entrega"}\`\n  - Fecha: ${inc.created_at ? new Date(inc.created_at).toLocaleString() : "Reciente"}\n`;
    });
    return {
      text,
      tags: ["Datos Reales", `${fallidos} Incidencias`],
    };
  }

  // 6. Clínicas (Consulta general de clínicas)
  if (
    q.includes("clínica") ||
    q.includes("clinica") ||
    q.includes("cuantas") ||
    q.includes("cuántas") ||
    q.includes("tenemos") ||
    q.includes("total")
  ) {
    let clinicsData = dashboardData?.clinics?.internal_admin;
    if (!clinicsData) {
      const res = await getClinicsSummary();
      clinicsData = res?.internal_admin;
    }
    const total = clinicsData?.total_clinics ?? 0;
    const activas = clinicsData?.active_clinics ?? 0;
    const inactivas = clinicsData?.inactive_clinics ?? 0;
    const lista = clinicsData?.clinicas || [];

    let text = `Actualmente OdontoCloud cuenta con **${total} clínicas registradas**, de las cuales **${activas} están activas** y **${inactivas} inactivas**.\n\n`;
    if (lista.length > 0) {
      text += `**Clínicas en el sistema:**\n`;
      lista.forEach((c) => {
        text += `• **${c.nombre}** — Estado: *${c.activo ? "Activa" : "Inactiva"}* (Plan: ${c.plan ? c.plan.toUpperCase() : "Estándar"})\n`;
      });
    }
    return {
      text,
      tags: ["Datos Reales", `${activas} Activas`],
    };
  }

  // 7. Pregunta libre sin tool conectada
  return {
    text: `El asistente inteligente aún no está conectado. Por ahora puedo consultar clínicas, vencimientos, actividad, Factus, solicitudes y correos.`,
    tags: ["Operaciones Disponibles"],
  };
}
