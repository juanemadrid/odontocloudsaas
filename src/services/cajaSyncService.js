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

  // 1. Si se pasó preferredCajaId y es UUID, verificar si existe en BD o website_config
  if (preferredCajaId && isUUID(preferredCajaId)) {
    try {
      const { data: cData } = await supabase
        .from("cajas")
        .select("id, estado")
        .eq("id", preferredCajaId)
        .maybeSingle();
      if (cData?.id) {
        return cData.id;
      }
    } catch (_) {}

    try {
      const cfgCajas = await getConfigSection(inquilino, "cajas", []);
      const matched = (Array.isArray(cfgCajas) ? cfgCajas : []).find(
        c => c.id === preferredCajaId
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

  // 1. Evitar duplicar el egreso si ya existe un movimiento de anulación para este recibo.
  //    Si el recibo tiene id real se busca por ese id (el número puede repetirse si se reinicia el consecutivo).
  try {
    const voidReciboId = receipt.isPago ? null : receipt.id;
    let dupQuery = supabase
      .from("movimientos_caja")
      .select("id, concepto, tipo")
      .eq("tenant_id", inquilino)
      .eq("tipo", "egreso");
    dupQuery = isUUID(voidReciboId)
      ? dupQuery.eq("recibo_id", voidReciboId)
      : dupQuery.ilike("concepto", `[ANULACION RC] ${formattedRc}%`);
    const { data: existingMovs } = await dupQuery;

    if (existingMovs && existingMovs.length > 0) {
      console.log(`[cajaSyncService] Ya existe movimiento de anulación para ${formattedRc}. Omitiendo inserción duplicada.`);
      return { success: true, existing: true, movimientoId: existingMovs[0].id };
    }
  } catch (checkErr) {
    console.warn("[cajaSyncService] Aviso al verificar duplicados en movimientos_caja:", checkErr);
  }

    // 2. Resolver caja destino: buscar dónde estuvo el recibo original si no se pasó targetCajaId
  let originalCajaId = targetCajaId || receipt.caja_id || receipt.cajaId || receipt._raw?.caja_id || receipt._raw?.cajaId || receipt._meta?.cajaId || receipt._meta?.caja_id;
  if (!originalCajaId && rawNum) {
    try {
      const { data: origMovs } = await supabase
        .from("movimientos_caja")
        .select("caja_id")
        .eq("tenant_id", inquilino)
        .eq("tipo", "ingreso")
        .or(`concepto.ilike.%RC-${rawNum}%,referencia.ilike.%${rawNum}%`);
      if (origMovs && origMovs.length > 0 && origMovs[0].caja_id) {
        originalCajaId = origMovs[0].caja_id;
      }
    } catch (_) {}
  }
  const finalCajaId = targetCajaId || await resolveTargetCajaId(inquilino, userProfile, originalCajaId);

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
 * Sincroniza la anulación de un egreso registrando un ingreso de reintegro en movimientos_caja
 * y actualizando los saldos de la caja.
 */
export const syncVoidExpenseInCaja = async ({
  inquilino,
  expense,
  userProfile = null,
  reason = "",
  operator = "",
  targetCajaId = null
}) => {
  if (!inquilino || !expense) return { success: false, error: "Parámetros insuficientes" };

  const monto = Math.abs(Number(expense.total ?? expense.monto ?? expense.valor ?? 0));
  if (monto <= 0) {
    return { success: true, skipped: true, reason: "monto_zero" };
  }

  const medioRaw = expense.medioPago || expense.metodo || expense.medio || expense.bancoCaja || "Efectivo";
  const rawNum = String(
    expense.consecutivo ||
    expense.numero ||
    expense.nroConsecutivo ||
    expense.nroPago ||
    expense.id ||
    ""
  ).replace(/^EGR-?/i, "").replace(/^Egreso\s*#?\s*/i, "").trim();

  const formattedEgr = rawNum ? `Egreso #${rawNum}` : "Egreso S/N";
  const reversalConcept = `[REINTEGRO EGRESO] ${formattedEgr}`;

  // 1. Evitar duplicar el reintegro si ya existe en movimientos_caja
  try {
    const { data: existingMovs } = await supabase
      .from("movimientos_caja")
      .select("id, concepto, tipo")
      .eq("tenant_id", inquilino)
      .eq("tipo", "ingreso")
      .ilike("concepto", `[REINTEGRO EGRESO] %${rawNum || ""}%`);

    if (existingMovs && existingMovs.length > 0 && rawNum) {
      console.log(`[cajaSyncService] Ya existe movimiento de reintegro para ${formattedEgr}. Omitiendo inserción.`);
      return { success: true, existing: true, movimientoId: existingMovs[0].id };
    }
  } catch (checkErr) {
    console.warn("[cajaSyncService] Aviso al verificar duplicados de reintegro en movimientos_caja:", checkErr);
  }

  // 2. Resolver caja destino: buscar dónde estuvo el egreso original si no se pasó targetCajaId
  let originalCajaId = targetCajaId || expense.caja_id || expense.cajaId;
  if (!originalCajaId && rawNum) {
    try {
      const { data: origMovs } = await supabase
        .from("movimientos_caja")
        .select("caja_id")
        .eq("tenant_id", inquilino)
        .eq("tipo", "egreso")
        .or(`concepto.ilike.%${rawNum}%,referencia.ilike.%${rawNum}%`);
      if (origMovs && origMovs.length > 0 && origMovs[0].caja_id) {
        originalCajaId = origMovs[0].caja_id;
      }
    } catch (_) {}
  }

  const finalCajaId = targetCajaId || await resolveTargetCajaId(inquilino, userProfile, originalCajaId);

  if (!finalCajaId) {
    console.error("[cajaSyncService] No se pudo resolver una caja válida para el reintegro de egreso.");
    return { success: false, error: "No se encontró caja para el reintegro" };
  }

  const terceroNombre = expense.proveedor || expense.tercero || expense.profesional || "Proveedor / Tercero";
  const opName = operator || userProfile?.nombreCompleto || userProfile?.nombre || "Sistema";
  const nowIso = new Date().toISOString();

  const movPayload = {
    tenant_id: inquilino,
    caja_id: finalCajaId,
    usuario_id: isUUID(userProfile?.uid || userProfile?.id) ? (userProfile.uid || userProfile.id) : null,
    usuario_nombre: opName,
    tipo: "ingreso",
    concepto: reversalConcept,
    monto: monto,
    metodo_pago: medioRaw,
    descripcion: `Reintegro por anulación de ${formattedEgr}. Motivo: ${reason || "Anulación de documento"} (Operador: ${opName})`,
    paciente_nombre: terceroNombre,
    referencia: `Egreso: ${formattedEgr} | Proveedor: ${terceroNombre} | Motivo: ${reason || "Anulación de egreso"}`,
    fecha: nowIso,
    created_at: nowIso
  };

  const { data: insertedMov, error: insertErr } = await supabase
    .from("movimientos_caja")
    .insert([movPayload])
    .select()
    .single();

  if (insertErr) {
    console.error("[cajaSyncService] Error al insertar reintegro en movimientos_caja:", insertErr);
    throw insertErr;
  }

  // 3. Actualizar saldos en tabla cajas y en website_config.cajas
  try {
    const { data: boxRow } = await supabase
      .from("cajas")
      .select("saldo_actual, total_egresos")
      .eq("id", finalCajaId)
      .maybeSingle();

    const currentSaldo = Number(boxRow?.saldo_actual ?? 0);
    const currentEgresos = Number(boxRow?.total_egresos ?? 0);
    const updatedSaldo = currentSaldo + monto;
    const updatedEgresos = Math.max(0, currentEgresos - monto);

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
    console.warn("[cajaSyncService] Aviso actualizando balance de caja en reintegro:", balErr);
  }

  return { success: true, movimiento: insertedMov };
};

/**
 * Reconcilia recibos de caja y egresos anulados preexistentes que no cuenten con su movimiento
 * de devolución o reintegro registrado en movimientos_caja.
 */
export const reconcileVoidedReceiptsInCaja = async (inquilino, userProfile = null, currentCajaId = null) => {
  if (!inquilino) return [];
  try {
    const [pagosRes, cfgPagos, recibosRes, cfgRecibos, egresosRes, cfgEgresos, movsRes] = await Promise.all([
      supabase.from("pagos").select("*").eq("tenant_id", inquilino).catch(() => ({ data: [] })),
      getConfigSection(inquilino, "pagos", []).catch(() => []),
      supabase.from("recibos_caja").select("*").eq("tenant_id", inquilino).catch(() => ({ data: [] })),
      getConfigSection(inquilino, "recibos_caja", []).catch(() => []),
      supabase.from("pagos_proveedor").select("*").eq("tenant_id", inquilino).catch(() => ({ data: [] })),
      getConfigSection(inquilino, "pagos_proveedor", []).catch(() => []),
      supabase.from("movimientos_caja").select("id, concepto, tipo, caja_id, monto, recibo_id, referencia").eq("tenant_id", inquilino).catch(() => ({ data: [] }))
    ]);

    const allMovs = movsRes?.data || [];
    // 0. Reparar movimientos de anulación/reintegro que tengan caja_id null
    const orphanMovs = allMovs.filter(m => !m.caja_id && (
      String(m.concepto || "").startsWith("[ANULACION RC]") ||
      String(m.concepto || "").startsWith("[REINTEGRO EGRESO]")
    ));
    if (orphanMovs.length > 0) {
      try {
        const targetId = currentCajaId || await resolveTargetCajaId(inquilino, userProfile);
        if (targetId) {
          for (const om of orphanMovs) {
            await supabase.from("movimientos_caja").update({ caja_id: targetId }).eq("id", om.id);
            om.caja_id = targetId;
          }
        }
      } catch (orphanErr) {
        console.warn("[cajaSyncService] Aviso reparando movimientos huérfanos:", orphanErr);
      }
    }

    const existingEgresoConcepts = new Set(
      allMovs.filter(m => m.tipo === "egreso").map(m => String(m.concepto || "").trim().toUpperCase())
    );
    const existingIngresoConcepts = new Set(
      allMovs.filter(m => m.tipo === "ingreso").map(m => String(m.concepto || "").trim().toUpperCase())
    );

    const voidedRcToSync = [];
    const voidedEgrToSync = [];

    // 1. Revisar pagos (recibos desde tabla pagos + website_config pagos)
    const combinedPagos = [...(pagosRes?.data || [])];
    const pagoIds = new Set(combinedPagos.map(p => p.id));
    (Array.isArray(cfgPagos) ? cfgPagos : []).forEach(cp => {
      if (cp?.id && !pagoIds.has(cp.id)) combinedPagos.push(cp);
    });

    combinedPagos.forEach(p => {
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
        Boolean(p.anulado) ||
        Boolean(meta.anulado) ||
        String(meta.estado || "").toLowerCase() === "anulado" ||
        refStr.includes("ANULADO") ||
        notesStr.includes("ANULADO");

      if (isAnulado) {
        const metodo = p.metodo || p.medio || meta.metodo || meta.medio || "Efectivo";
        if (metodo.toLowerCase() !== "saldo a favor") {
          const num = String(meta.nroConsecutivo || p.nroConsecutivo || p.nro_consecutivo || p.numero || "").replace(/^RC-?/i, "").trim();
          const formatted = num ? `RC-${num.padStart(4, "0")}` : (p.id ? `RC-${String(p.id).slice(0, 6).toUpperCase()}` : "");
          const expectedConcept = `[ANULACION RC] ${formatted}`.toUpperCase();
          const monto = Number(p.monto || 0);

          const alreadyExists = formatted && Array.from(existingEgresoConcepts).some(c => c.startsWith(expectedConcept) || (num && c.includes(num)));
          if (!alreadyExists && monto > 0) {
            voidedRcToSync.push({
              isPago: true,
              id: p.id,
              monto,
              consecutivoNumero: num || String(p.id).slice(0, 6).toUpperCase(),
              nroConsecutivo: num || String(p.id).slice(0, 6).toUpperCase(),
              paciente_id: p.paciente_id,
              pacienteNombre: meta.patientNombre || meta.pacienteNombre || p.pacienteNombre || p.patientNombre || "",
              medioPago: metodo,
              motivoAnulacion: p.motivoAnulacion || meta.motivoAnulacion || "Anulación de pago",
              anuladoPor: p.anuladoPor || meta.anuladoPor || "Sistema",
              caja_id: p.caja_id || p.cajaId,
              _raw: p,
              _meta: meta
            });
          }
        }
      }
    });

    // 2. Revisar recibos_caja (tabla + config)
    const combinedRecibos = [...(recibosRes?.data || [])];
    const recIds = new Set(combinedRecibos.map(r => r.id));
    (Array.isArray(cfgRecibos) ? cfgRecibos : []).forEach(cr => {
      if (cr?.id && !recIds.has(cr.id)) combinedRecibos.push(cr);
    });

    combinedRecibos.forEach(r => {
      const isAnulado = String(r.estado || "").toLowerCase() === "anulado" ||
        Boolean(r.anulado) ||
        String(r.observaciones || "").toUpperCase().includes("ANULAD") ||
        String(r.concepto || "").toUpperCase().includes("ANULAD");

      if (isAnulado) {
        const metodo = r.medio_pago || r.medioPago || r.condicion_pago || "Efectivo";
        if (metodo.toLowerCase() !== "saldo a favor") {
          const num = String(r.nro_consecutivo || r.nroConsecutivo || r.numero || "").replace(/^RC-?/i, "").trim();
          const formatted = num ? `RC-${num.padStart(4, "0")}` : (r.id ? `RC-${String(r.id).slice(0, 6).toUpperCase()}` : "");
          const expectedConcept = `[ANULACION RC] ${formatted}`.toUpperCase();
          const monto = Number(r.total || r.monto || 0);

          const alreadyExists = formatted && Array.from(existingEgresoConcepts).some(c => c.startsWith(expectedConcept) || (num && c.includes(num)));
          if (!alreadyExists && monto > 0) {
            if (!voidedRcToSync.some(item => (num && item.consecutivoNumero === num) || item.id === r.id)) {
              voidedRcToSync.push({
                isPago: false,
                id: r.id,
                monto,
                consecutivoNumero: num || String(r.id).slice(0, 6).toUpperCase(),
                nroConsecutivo: num || String(r.id).slice(0, 6).toUpperCase(),
                paciente_id: r.paciente_id || r.pacienteId,
                pacienteNombre: r.paciente_nombre || r.pacienteNombre || "",
                medioPago: metodo,
                motivoAnulacion: r.motivoAnulacion || r.motivo_anulacion || "Anulación de recibo",
                anuladoPor: r.anuladoPor || r.anulado_por || "Sistema",
                caja_id: r.caja_id || r.cajaId,
                _raw: r,
                _meta: {}
              });
            }
          }
        }
      }
    });

    // 3. Revisar pagos_proveedor (egresos anulados) (tabla + config)
    const combinedEgresos = [...(egresosRes?.data || [])];
    const egrIds = new Set(combinedEgresos.map(e => e.id));
    (Array.isArray(cfgEgresos) ? cfgEgresos : []).forEach(ce => {
      if (ce?.id && !egrIds.has(ce.id)) combinedEgresos.push(ce);
    });

    combinedEgresos.forEach(e => {
      const isAnulado = String(e.estado || "").toLowerCase() === "anulado" ||
        Boolean(e.anulado) ||
        Boolean(e.motivoAnulacion) ||
        Boolean(e.motivo_anulacion);

      if (isAnulado) {
        const rawNum = String(
          e.consecutivo || e.numero || e.nroConsecutivo || e.nroPago || e.id || ""
        ).replace(/^EGR-?/i, "").replace(/^Egreso\s*#?\s*/i, "").trim();
        const expectedConcept = `[REINTEGRO EGRESO] EGRESO #${rawNum}`.toUpperCase();
        const monto = Number(e.monto || e.total || e.valor || 0);

        const alreadyExists = rawNum && Array.from(existingIngresoConcepts).some(c => c.startsWith(expectedConcept) || c.includes(`EGRESO #${rawNum}`.toUpperCase()));
        if (!alreadyExists && monto > 0 && rawNum) {
          voidedEgrToSync.push({
            id: e.id,
            monto,
            rawNum,
            proveedor: e.proveedor || e.tercero || e.profesional || "Proveedor",
            medioPago: e.medioPago || e.metodo || e.bancoCaja || "Efectivo",
            motivoAnulacion: e.motivoAnulacion || e.motivo_anulacion || "Anulación de egreso",
            anuladoPor: e.anuladoPor || e.anulado_por || "Sistema",
            caja_id: e.caja_id || e.cajaId,
            _raw: e
          });
        }
      }
    });

    // Sincronizar devoluciones de recibos
    const synced = [];
    for (const item of voidedRcToSync) {
      try {
        const res = await syncVoidReceiptInCaja({
          inquilino,
          receipt: item,
          userProfile,
          reason: item.motivoAnulacion,
          operator: item.anuladoPor,
          targetCajaId: item.caja_id || currentCajaId
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

    // Sincronizar reintegros de egresos
    for (const item of voidedEgrToSync) {
      try {
        const res = await syncVoidExpenseInCaja({
          inquilino,
          expense: item,
          userProfile,
          reason: item.motivoAnulacion,
          operator: item.anuladoPor,
          targetCajaId: item.caja_id || currentCajaId
        });
        if (res?.success) {
          synced.push(item);
          existingIngresoConcepts.add(`[REINTEGRO EGRESO] EGRESO #${item.rawNum}`.toUpperCase());
        }
      } catch (e) {
        console.warn(`[reconcileVoidedReceiptsInCaja] Error reconciliando Egreso #${item.rawNum}:`, e);
      }
    }

    return synced;
  } catch (err) {
    console.warn("[reconcileVoidedReceiptsInCaja] Error en reconciliación:", err);
    return [];
  }
};

export const reconcileVoidedMovementsInCaja = reconcileVoidedReceiptsInCaja;
