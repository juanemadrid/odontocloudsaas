import supabase from "../lib/supabaseClient";
import { getActiveCaja, ensureActiveCaja } from "./supabaseServices";
import { getConfigSection, saveConfigSection } from "./configPersistenceService";

/**
 * Valida si un string es un UUID estándar válido (v1-v5).
 */
export const isUUID = (str) => {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
};

/**
 * Resuelve el ID de la caja abierta activa en la que debe registrarse el movimiento.
 * Prioriza la caja preferida si está abierta, la caja activa del usuario, o cualquier caja abierta.
 */
export const resolveTargetCajaId = async (inquilino, userProfile = null, preferredCajaId = null) => {
  if (!inquilino) return null;

  // 1. Si se pasó preferredCajaId y es UUID, verificar si existe y está abierta en BD o website_config
  if (preferredCajaId && isUUID(preferredCajaId)) {
    try {
      const { data: cData } = await supabase
        .from("cajas")
        .select("id, estado")
        .eq("id", preferredCajaId)
        .maybeSingle();
      if (cData?.id && (cData.estado || "").toLowerCase() === "abierta") {
        return cData.id;
      }
    } catch (_) {}

    try {
      const cfgCajas = await getConfigSection(inquilino, "cajas", []);
      const matched = (Array.isArray(cfgCajas) ? cfgCajas : []).find(
        c => c.id === preferredCajaId && (c.estado || "").toLowerCase() === "abierta"
      );
      if (matched?.id) return matched.id;
    } catch (_) {}
  }

  const userId = userProfile?.uid || userProfile?.id || null;

  // 2. Intentar obtener la caja activa abierta del usuario actual
  try {
    const userCaja = await getActiveCaja(inquilino, userId);
    if (userCaja?.id && isUUID(userCaja.id)) {
      return userCaja.id;
    }
  } catch (_) {}

  // 3. Intentar obtener cualquier caja abierta en la clínica (BD o website_config)
  try {
    const anyCaja = await getActiveCaja(inquilino);
    if (anyCaja?.id && isUUID(anyCaja.id)) {
      return anyCaja.id;
    }
  } catch (_) {}

  try {
    const cfgCajas = await getConfigSection(inquilino, "cajas", []);
    const anyOpen = (Array.isArray(cfgCajas) ? cfgCajas : []).find(
      c => (c.estado || "").toLowerCase() === "abierta"
    );
    if (anyOpen?.id && isUUID(anyOpen.id)) {
      return anyOpen.id;
    }
  } catch (_) {}

  // 4. Intentar abrir/asegurar automáticamente una caja abierta para el usuario
  if (userProfile) {
    try {
      const ensured = await ensureActiveCaja(inquilino, userProfile);
      if (ensured?.id && isUUID(ensured.id)) {
        return ensured.id;
      }
    } catch (_) {}
  }

  // 5. Fallback: buscar la caja más reciente en la tabla cajas
  try {
    const { data: latestCajas } = await supabase
      .from("cajas")
      .select("id")
      .eq("tenant_id", inquilino)
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestCajas?.[0]?.id && isUUID(latestCajas[0].id)) {
      return latestCajas[0].id;
    }
  } catch (_) {}

  // 6. Si no existe ninguna caja en la BD, crear una caja inicial
  try {
    const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : null;
    if (newId) {
      const { data: created } = await supabase
        .from("cajas")
        .insert([{
          id: newId,
          tenant_id: inquilino,
          usuario_id: isUUID(userId) ? userId : null,
          usuario_nombre: userProfile?.nombreCompleto || userProfile?.nombre || "Cajero Principal",
          estado: "abierta",
          saldo_inicial: 0,
          saldo_actual: 0,
          total_ingresos: 0,
          total_egresos: 0
        }])
        .select()
        .single();
      if (created?.id) return created.id;
    }
  } catch (_) {}

  return null;
};

/**
 * Sincroniza la anulación de un recibo o pago registrando un egreso de devolución en movimientos_caja
 * y actualizando los saldos de la caja activa.
 */
export const syncVoidReceiptInCaja = async ({
  inquilino,
  receipt,
  userProfile = null,
  reason = "",
  operator = "",
  targetCajaId = null
}) => {
  if (!inquilino || !receipt) return { success: false, error: "Parámetros insuficientes" };

  const monto = Math.abs(Number(receipt.total ?? receipt.monto ?? receipt._raw?.monto ?? receipt._raw?.total ?? 0));
  if (monto <= 0) {
    return { success: true, skipped: true, reason: "monto_zero" };
  }

  const medioRaw = receipt.medioPago || receipt.metodo || receipt.medio || receipt._raw?.metodo || receipt._raw?.medio_pago || receipt._meta?.metodo || receipt._meta?.medio || "Efectivo";
  // Si fue consumo de saldo a favor, no hubo ingreso en efectivo a caja física, por lo que no hay egreso de caja física
  if (String(medioRaw).toLowerCase() === "saldo a favor") {
    return { success: true, skipped: true, reason: "saldo_a_favor" };
  }

  const rawNum = String(
    receipt.consecutivoNumero ||
    receipt.nroConsecutivo ||
    receipt.numero ||
    receipt._raw?.nro_consecutivo ||
    receipt._raw?.nroConsecutivo ||
    receipt._raw?.numero ||
    receipt._meta?.nroConsecutivo ||
    ""
  ).replace(/^RC-?/i, "").trim();

  const formattedRc = rawNum ? `RC-${rawNum.padStart(4, "0")}` : "RC-S/N";
  const reversalConcept = `[ANULACION RC] ${formattedRc}`;

  // 1. Evitar duplicar el egreso si ya existe un movimiento de anulación para este recibo
  try {
    const { data: existingMovs } = await supabase
      .from("movimientos_caja")
      .select("id, concepto, tipo")
      .eq("tenant_id", inquilino)
      .eq("tipo", "egreso")
      .ilike("concepto", `[ANULACION RC] ${formattedRc}%`);

    if (existingMovs && existingMovs.length > 0) {
      console.log(`[cajaSyncService] Ya existe movimiento de anulación para ${formattedRc}. Omitiendo inserción duplicada.`);
      return { success: true, existing: true, movimientoId: existingMovs[0].id };
    }
  } catch (checkErr) {
    console.warn("[cajaSyncService] Aviso al verificar duplicados en movimientos_caja:", checkErr);
  }

  // 2. Resolver caja destino
  const preferredId = targetCajaId || receipt.caja_id || receipt.cajaId || receipt._raw?.caja_id || receipt._raw?.cajaId || receipt._meta?.cajaId || receipt._meta?.caja_id;
  const finalCajaId = await resolveTargetCajaId(inquilino, userProfile, preferredId);

  if (!finalCajaId) {
    console.error("[cajaSyncService] No se pudo resolver una caja válida para el egreso de anulación.");
    return { success: false, error: "No se encontró ni se pudo abrir una caja válida" };
  }

  // 3. Preparar datos limpios y validados
  const pacienteNombre = 
    receipt.pacienteNombre || 
    receipt.patientNombre || 
    receipt._meta?.pacienteNombre || 
    receipt._meta?.patientNombre || 
    receipt._raw?.paciente_nombre || 
    receipt._raw?.pacienteNombre || 
    "Paciente";

  const rawPacId = 
    receipt.paciente_id || 
    receipt.pacienteId || 
    receipt._raw?.paciente_id || 
    receipt._meta?.pacienteId || 
    receipt._meta?.paciente_id;
  const pacienteId = isUUID(rawPacId) ? rawPacId : null;

  const rawUserId = userProfile?.uid || userProfile?.id;
  const userId = isUUID(rawUserId) ? rawUserId : null;

  const rawReciboId = receipt.isPago ? null : receipt.id;
  const reciboId = isUUID(rawReciboId) ? rawReciboId : null;

  const opName = operator || userProfile?.nombreCompleto || userProfile?.nombre || "Sistema";
  const nowIso = new Date().toISOString();

  const movPayload = {
    tenant_id: inquilino,
    caja_id: finalCajaId,
    usuario_id: userId,
    usuario_nombre: opName,
    tipo: "egreso",
    concepto: reversalConcept,
    monto: monto,
    metodo_pago: medioRaw,
    descripcion: `Devolución por anulación de recibo ${formattedRc}. Motivo: ${reason || "Anulación de documento"} (Operador: ${opName})`,
    paciente_id: pacienteId,
    paciente_nombre: pacienteNombre,
    recibo_id: reciboId,
    referencia: `Paciente: ${pacienteNombre} | Recibo: ${formattedRc} | Motivo: ${reason || "Anulación de recibo"}`,
    fecha: nowIso,
    created_at: nowIso
  };

  // 4. Insertar egreso en movimientos_caja
  const { data: insertedMov, error: insertErr } = await supabase
    .from("movimientos_caja")
    .insert([movPayload])
    .select()
    .single();

  if (insertErr) {
    console.error("[cajaSyncService] Error al insertar egreso en movimientos_caja:", insertErr);
    throw insertErr;
  }

  // 5. Actualizar saldos en la tabla cajas y en website_config.cajas
  try {
    const { data: boxRow } = await supabase
      .from("cajas")
      .select("saldo_actual, total_egresos")
      .eq("id", finalCajaId)
      .maybeSingle();

    const currentSaldo = Number(boxRow?.saldo_actual ?? 0);
    const currentEgresos = Number(boxRow?.total_egresos ?? 0);
    const updatedSaldo = currentSaldo - monto;
    const updatedEgresos = currentEgresos + monto;

    await supabase
      .from("cajas")
      .update({
        saldo_actual: updatedSaldo,
        total_egresos: updatedEgresos,
        updated_at: nowIso
      })
      .eq("id", finalCajaId);

    const cfgCajas = await getConfigSection(inquilino, "cajas", []);
    if (Array.isArray(cfgCajas) && cfgCajas.some(c => c.id === finalCajaId)) {
      const updatedCfg = cfgCajas.map(c => {
        if (c.id === finalCajaId) {
          return {
            ...c,
            saldo_actual: updatedSaldo,
            saldoActual: updatedSaldo,
            total_egresos: updatedEgresos,
            totalEgresos: updatedEgresos,
            updated_at: nowIso
          };
        }
        return c;
      });
      await saveConfigSection(inquilino, "cajas", updatedCfg);
    }
  } catch (balErr) {
    console.warn("[cajaSyncService] Aviso actualizando balance de caja:", balErr);
  }

  return { success: true, movimiento: insertedMov };
};

/**
 * Reconcilia recibos de caja y pagos anulados preexistentes que no cuenten con un egreso
 * registrado en movimientos_caja (ej. RC-2109 y anteriores).
 */
export const reconcileVoidedReceiptsInCaja = async (inquilino, userProfile = null) => {
  if (!inquilino) return [];
  try {
    const [pagosRes, recibosRes, movsRes] = await Promise.all([
      supabase.from("pagos").select("*").eq("tenant_id", inquilino),
      supabase.from("recibos_caja").select("*").eq("tenant_id", inquilino),
      supabase.from("movimientos_caja").select("id, concepto, tipo, caja_id").eq("tenant_id", inquilino).eq("tipo", "egreso")
    ]);

    // 0. Reparar movimientos de anulación que tengan caja_id null
    const orphanMovs = (movsRes?.data || []).filter(m => !m.caja_id && String(m.concepto || "").startsWith("[ANULACION RC]"));
    if (orphanMovs.length > 0) {
      try {
        const targetId = await resolveTargetCajaId(inquilino, userProfile);
        if (targetId) {
          for (const om of orphanMovs) {
            await supabase
              .from("movimientos_caja")
              .update({ caja_id: targetId })
              .eq("id", om.id);
            om.caja_id = targetId;
          }
        }
      } catch (orphanErr) {
        console.warn("[reconcileVoidedReceiptsInCaja] Aviso reparando movimientos huérfanos:", orphanErr);
      }
    }

    const existingEgresoConcepts = new Set(
      (movsRes?.data || []).map(m => String(m.concepto || "").trim().toUpperCase())
    );

    const voidedToSync = [];

    // 1. Revisar pagos
    (pagosRes?.data || []).forEach(p => {
      let meta = {};
      if (typeof p.notas === "string" && p.notas.trim().startsWith("{")) {
        try { meta = JSON.parse(p.notas); } catch (_) {}
      } else if (p.notas && typeof p.notas === "object") {
        meta = p.notas;
      }
      const refStr = String(p.referencia || "").toUpperCase();
      const notesStr = typeof p.notas === "string" ? p.notas.toUpperCase() : "";
      const isAnulado = 
        String(p.estado || "").toLowerCase() === "anulado" ||
        Boolean(meta.anulado) ||
        String(meta.estado || "").toLowerCase() === "anulado" ||
        refStr.includes("ANULADO") ||
        notesStr.includes("ANULADO");

      if (isAnulado) {
        const metodo = p.metodo || p.medio || meta.metodo || meta.medio || "Efectivo";
        if (metodo.toLowerCase() !== "saldo a favor") {
          const num = String(meta.nroConsecutivo || p.nroConsecutivo || p.nro_consecutivo || p.numero || "").replace(/^RC-?/i, "").trim();
          const formatted = num ? `RC-${num.padStart(4, "0")}` : "";
          const expectedConcept = `[ANULACION RC] ${formatted}`.toUpperCase();
          const monto = Number(p.monto || 0);

          const alreadyExists = formatted && Array.from(existingEgresoConcepts).some(c => c.startsWith(expectedConcept));
          if (!alreadyExists && monto > 0 && num) {
            voidedToSync.push({
              isPago: true,
              id: p.id,
              monto,
              consecutivoNumero: num,
              nroConsecutivo: num,
              paciente_id: p.paciente_id,
              pacienteNombre: meta.patientNombre || meta.pacienteNombre || p.pacienteNombre || p.patientNombre || "",
              medioPago: metodo,
              motivoAnulacion: p.motivoAnulacion || meta.motivoAnulacion || "Anulación de pago",
              anuladoPor: p.anuladoPor || meta.anuladoPor || "Sistema",
              _raw: p,
              _meta: meta
            });
          }
        }
      }
    });

    // 2. Revisar recibos_caja
    (recibosRes?.data || []).forEach(r => {
      const isAnulado = String(r.estado || "").toLowerCase() === "anulado" ||
        String(r.observaciones || "").toUpperCase().includes("ANULAD") ||
        String(r.concepto || "").toUpperCase().includes("ANULAD");

      if (isAnulado) {
        const metodo = r.medio_pago || r.medioPago || r.condicion_pago || "Efectivo";
        if (metodo.toLowerCase() !== "saldo a favor") {
          const num = String(r.nro_consecutivo || r.nroConsecutivo || r.numero || "").replace(/^RC-?/i, "").trim();
          const formatted = num ? `RC-${num.padStart(4, "0")}` : "";
          const expectedConcept = `[ANULACION RC] ${formatted}`.toUpperCase();
          const monto = Number(r.total || r.monto || 0);

          const alreadyExists = formatted && Array.from(existingEgresoConcepts).some(c => c.startsWith(expectedConcept));
          if (!alreadyExists && monto > 0 && num) {
            if (!voidedToSync.some(item => item.consecutivoNumero === num)) {
              voidedToSync.push({
                isPago: false,
                id: r.id,
                monto,
                consecutivoNumero: num,
                nroConsecutivo: num,
                paciente_id: r.paciente_id || r.pacienteId,
                pacienteNombre: r.paciente_nombre || r.pacienteNombre || "",
                medioPago: metodo,
                motivoAnulacion: r.motivoAnulacion || r.motivo_anulacion || "Anulación de recibo",
                anuladoPor: r.anuladoPor || r.anulado_por || "Sistema",
                _raw: r,
                _meta: {}
              });
            }
          }
        }
      }
    });

    const synced = [];
    for (const item of voidedToSync) {
      try {
        const res = await syncVoidReceiptInCaja({
          inquilino,
          receipt: item,
          userProfile,
          reason: item.motivoAnulacion,
          operator: item.anuladoPor
        });
        if (res?.success) {
          synced.push(item);
          const formatted = `RC-${String(item.consecutivoNumero).padStart(4, "0")}`;
          existingEgresoConcepts.add(`[ANULACION RC] ${formatted}`.toUpperCase());
        }
      } catch (e) {
        console.warn(`[reconcileVoidedReceiptsInCaja] Error reconciliando RC-${item.consecutivoNumero}:`, e);
      }
    }

    return synced;
  } catch (err) {
    console.warn("[reconcileVoidedReceiptsInCaja] Error en reconciliación:", err);
    return [];
  }
};
