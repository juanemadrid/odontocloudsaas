// src/services/billingService.js
import supabase from "../lib/supabaseClient";
import { getConfigSectionCached } from "./configCacheService";

const s = (n) => Number(n || 0);

export const getPatientFinancials = async (patientId, tenantId) => {
    if (!patientId) return { facturas: [], pagos: [], plans: [], totals: {} };

    try {
        let pagos = [];
        let facturas = [];
        let plans = [];

        // 1. Load Pagos — solo columnas que existen en el schema de Supabase
        const PAGO_COLS = "id, paciente_id, tenant_id, monto, fecha, created_at, metodo, referencia, notas, estado";
        
        try {
            const { data, error } = await supabase
                .from("pagos")
                .select(PAGO_COLS)
                .eq("paciente_id", patientId)
                .order("created_at", { ascending: false });
            
            if (!error && data && data.length > 0) {
                pagos = data;
            }
        } catch (e) {}

        // Fallback 1: filtrar por tenant en servidor (no en JS)
        if (pagos.length === 0 && tenantId) {
            try {
                const { data: tenantPagos } = await supabase
                    .from("pagos")
                    .select(PAGO_COLS)
                    .eq("tenant_id", tenantId)
                    .eq("paciente_id", patientId);
                
                if (tenantPagos && tenantPagos.length > 0) {
                    pagos = tenantPagos;
                }
            } catch (e) {}
        }

        // Fallback 2: website_config — usando cache compartida
        if (pagos.length === 0 && tenantId) {
            try {
                const cfgPagos = await getConfigSectionCached(tenantId, "pagos", []);
                pagos = cfgPagos.filter(p => 
                    p.paciente_id === patientId || 
                    p.pacienteId === patientId || 
                    p.patient_id === patientId || 
                    p.patientId === patientId
                );
            } catch (e) {}
        }

        // 2. Load Facturas — columnas necesarias
        try {
            const { data } = await supabase
                .from("facturas")
                .select("id, paciente_id, total, estado, fecha_emision, created_at")
                .eq("paciente_id", patientId);
            if (data) facturas = data;
        } catch (e) {}

        // 3. Load Treatment Plans — columnas necesarias
        try {
            const { data } = await supabase
                .from("treatment_plans")
                .select("id, paciente_id, total, estado")
                .eq("paciente_id", patientId);
            if (data) plans = data;
        } catch (e) {}

        // Format facturas
        facturas = (facturas || []).map(f => ({
            id: f.id,
            ...f,
            total: s(f.total),
            estado: (f.estado || "pendiente").toLowerCase(),
            fechaISO: f.fecha_emision || f.created_at
        })).sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

        // Format pagos — los campos extra se leen desde notas (guardados como JSON)
        pagos = (pagos || []).map(p => {
            // Intentar parsear notas como JSON para extraer campos extra
            let notasParsed = {};
            try {
                if (p.notas && p.notas.startsWith("{")) {
                    notasParsed = JSON.parse(p.notas);
                }
            } catch (e) {}

            const isVoided = (p.estado || "").toLowerCase() === "anulado" ||
                             Boolean(p.anulado) ||
                             Boolean(notasParsed.anulado) ||
                             (p.referencia || "").toUpperCase().includes("ANULADO") ||
                             (p.notas || "").toUpperCase().includes("ANULADO");

            let motivo = notasParsed.motivoAnulacion || p.motivo_anulacion || "";
            if (!motivo && isVoided && p.notas && typeof p.notas === "string" && !p.notas.startsWith("{")) {
                motivo = p.notas.replace(/^ANULADO\s*-\s*/i, "").trim();
            }

            let rawConcepto = notasParsed.concepto || p.concepto || (p.referencia && p.referencia.toUpperCase().includes("SALDO A FAVOR") ? "SALDO A FAVOR" : p.referencia) || "ABONO GENERAL";
            if (notasParsed.planTitle && !rawConcepto.toLowerCase().includes(notasParsed.planTitle.toLowerCase())) {
                rawConcepto = `${rawConcepto} (${notasParsed.planTitle})`;
            }

            const validUser = notasParsed.registradoPor || notasParsed.usuarioNombre || p.registrado_por || p.usuario_nombre || p.creado_por || "";

            // Si la fecha fue guardada con el desfase de medianoche UTC (ej: T19:00 o T05:00) y created_at es del día siguiente
            let resolvedFecha = p.fecha || p.created_at;
            if (p.created_at && p.fecha) {
                const fDate = new Date(p.fecha);
                const cDate = new Date(p.created_at);
                if (cDate.getTime() - fDate.getTime() > 0 && cDate.getTime() - fDate.getTime() < 36 * 3600 * 1000) {
                    const fLocalDay = fDate.toLocaleDateString('es-CO');
                    const cLocalDay = cDate.toLocaleDateString('es-CO');
                    if (fLocalDay !== cLocalDay) {
                        resolvedFecha = p.created_at;
                        // Auto-sanar en segundo plano para que quede corregido en BD permanentemente
                        try {
                            supabase.from("pagos").update({ fecha: p.created_at }).eq("id", p.id).then();
                            supabase.from("recibos_caja").update({ fecha: p.created_at }).eq("pago_id", p.id).then();
                        } catch (_) {}
                    }
                }
            }

            return {
                id: p.id,
                ...p,
                monto: s(p.monto),
                fechaISO: resolvedFecha,
                fecha: resolvedFecha,
                medio: p.metodo || p.medio || "—",
                concepto: rawConcepto,
                referencia: notasParsed.referencia || p.referencia || "",
                estado: isVoided ? "Anulado" : (p.estado || "Completado"),
                motivoAnulacion: motivo,
                notas: notasParsed.notas || notasParsed.observaciones || (typeof p.notas === "string" && !p.notas.startsWith("{") ? p.notas : "") || "",
                notes: notasParsed.notas || notasParsed.observaciones || "",
                rawNotas: p.notas,
                metadata: notasParsed,
                _meta: notasParsed,
                planId: notasParsed.planId || p.planId || null,
                planTitle: notasParsed.planTitle || p.planTitle || "",
                itemPayments: notasParsed.itemPayments || p.itemPayments || [],
                profesional: notasParsed.profesional || p.profesional || "",
                profesionalId: notasParsed.profesionalId || p.profesionalId || null,
                nroConsecutivo: notasParsed.nroConsecutivo || p.nro_consecutivo || p.nroConsecutivo || "",
                consecutivo: notasParsed.nroConsecutivo || p.nro_consecutivo || p.consecutivo || "",
                registradoPor: validUser,
                usuarioNombre: validUser,
                tipoDoc: notasParsed.tipoDoc || p.tipoDoc || (rawConcepto === "SALDO A FAVOR" ? "Recibo de caja" : "")
            };
        }).sort((a, b) => {
            const numA = Number(a.nroConsecutivo || a.consecutivo || a.numero || a.nro_consecutivo || 0);
            const numB = Number(b.nroConsecutivo || b.consecutivo || b.numero || b.nro_consecutivo || 0);
            if (numA > 0 && numB > 0 && numA !== numB) {
                return numB - numA;
            }
            const timeA = new Date(a.fechaISO || a.fecha || a.created_at || 0).getTime();
            const timeB = new Date(b.fechaISO || b.fecha || b.created_at || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            return (b.id || "").localeCompare(a.id || "");
        });

        // Format plans
        plans = (plans || []).map(p => ({
            id: p.id,
            ...p,
            costoTotal: s(p.total),
            pagado: 0
        }));

        const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
        const facturaIds = facturas.map(f => f.id).filter(isValidUUID);
        let notasDebito = [];

        if (facturaIds.length > 0) {
            try {
                const { data, error: ndErr } = await supabase
                    .from("notas_debito")
                    .select("id,factura_id,monto,motivo,fecha,numero")
                    .in("factura_id", facturaIds);
                if (!ndErr && data) notasDebito = data;
            } catch (e) {}
        }

        // Leer saldo_favor del paciente de forma segura
        let patientSaldoFavor = 0;
        let pacData = null;
        try {
            const { data } = await supabase
                .from("pacientes")
                .select("saldo_favor")
                .eq("id", patientId)
                .maybeSingle();
            if (data) {
                pacData = data;
                patientSaldoFavor = Number(data.saldo_favor || 0);
            }
        } catch (e) {
            // ignorar
        }

        const isNotAnulado = (p) => {
            const estadoStr = (p.estado || "").toLowerCase();
            const refStr = (p.referencia || "").toUpperCase();
            const notesStr = (p.notas || p.notes || "").toUpperCase();
            return estadoStr !== "anulado" && !refStr.includes("ANULADO") && !notesStr.includes("ANULADO");
        };

        const isCreditTopUp = (p) => {
            const ref = (p.referencia || p.concepto || "").toUpperCase();
            const notes = (p.notas || p.notes || "").toUpperCase();
            const method = (p.metodo || p.medio || "").toLowerCase();
            const tipo = (p.tipo || "").toLowerCase();
            return method !== "saldo a favor" && tipo !== "egreso" && !ref.includes("DEVOLUCI") && !notes.includes("DEVOLUCI") && (ref === "SALDO A FAVOR" || notes.includes("SALDO A FAVOR")) && isNotAnulado(p);
        };

        const isCreditUsed = (p) => {
            const m = (p.metodo || p.medio || "").toLowerCase();
            const ref = (p.referencia || p.concepto || "").toUpperCase();
            const notes = (p.notas || p.notes || "").toUpperCase();
            const isDevolucion = ref.includes("DEVOLUCI") || notes.includes("DEVOLUCI") || (p.tipo === "egreso" && (ref.includes("SALDO") || notes.includes("SALDO")));
            return (m === "saldo a favor" || isDevolucion) && isNotAnulado(p);
        };

        const totalDebito = notasDebito
            .filter(n => isNotAnulado(n))
            .reduce((acc, n) => acc + s(n.monto), 0);

        const totalFacturado = facturas.reduce((acc, f) => acc + f.total, 0) + totalDebito;
        const totalPagado = pagos
            .filter(p => !isCreditUsed(p) && isNotAnulado(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const totalCredits = pagos
            .filter(p => isCreditTopUp(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const usedCredits = pagos
            .filter(p => isCreditUsed(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const totalSaldosAFavor = (pacData && pacData.saldo_favor != null)
            ? Number(pacData.saldo_favor)
            : Math.max(0, Math.max(patientSaldoFavor, totalCredits) - usedCredits);
        const totalAbonosTratamiento = pagos
            .filter(p => !isCreditTopUp(p) && !isCreditUsed(p) && isNotAnulado(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const facturasPagadas = facturas.filter((f) => ["pagada", "pagado", "paid"].includes(f.estado));
        const facturasPendientes = facturas.filter((f) => ["pendiente", "abierta", "open", "deuda"].includes(f.estado));

        const totalFacturasPagadas = facturasPagadas.reduce((acc, f) => acc + f.total, 0);
        const totalFacturasPendientes = facturasPendientes.reduce((acc, f) => acc + f.total, 0);

        const rawBalance = totalFacturado - totalPagado;
        const balance = rawBalance > 0 ? rawBalance : 0;

        return {
            facturas,
            pagos,
            plans,
            totals: {
                totalFacturado,
                totalPagado,
                totalAbonosTratamiento,
                totalFacturasPendientes,
                totalFacturasPagadas,
                totalSaldosAFavor,
                balance,
                rawBalance
            }
        };
    } catch (error) {
        console.error("Error al obtener estado financiero en Supabase:", error);
        return { facturas: [], pagos: [], plans: [], totals: {} };
    }
};

/**
 * Obtiene el resumen financiero sincronizado de un plan de tratamiento asociado a un recibo de caja / pago.
 * Calcula de manera acumulada y precisa:
 * - totalPlan: Valor total del presupuesto del plan de tratamiento.
 * - totalPagado: Suma acumulada de todos los pagos realizados a ese plan de tratamiento (sin mezclar otros planes).
 * - saldo: Saldo restante del plan (totalPlan - totalPagado).
 */
export const getReceiptPlanFinancials = async ({
    planId,
    patientId,
    tenantId,
    receiptAmount = 0,
    planTitle = ""
}) => {
    try {
        let targetPlanId = planId || null;
        let effectivePlanTitle = planTitle || "";
        let totalPlan = 0;
        let planData = null;

        // 1. Si tenemos planId, consultar directamente en treatment_plans
        if (targetPlanId) {
            try {
                const { data } = await supabase
                    .from("treatment_plans")
                    .select("*")
                    .eq("id", targetPlanId)
                    .maybeSingle();
                if (data) planData = data;
            } catch (_) {}
        }

        // 2. Si no se encontró por ID o no venía planId, buscar en los planes del paciente
        if (!planData && patientId) {
            try {
                const { data: pPlans } = await supabase
                    .from("treatment_plans")
                    .select("*")
                    .eq("paciente_id", patientId)
                    .order("created_at", { ascending: false });

                if (Array.isArray(pPlans) && pPlans.length > 0) {
                    if (effectivePlanTitle) {
                        const cleanSearch = effectivePlanTitle.trim().toLowerCase();
                        planData = pPlans.find(p => 
                            (p.nombre && p.nombre.trim().toLowerCase() === cleanSearch) ||
                            (p.title && p.title.trim().toLowerCase() === cleanSearch)
                        );
                    }
                    if (!planData && pPlans.length === 1) {
                        planData = pPlans[0];
                    }
                }
            } catch (_) {}
        }

        // Si no se encontró ningún plan de tratamiento asociado
        if (!planData) {
            if (effectivePlanTitle && receiptAmount > 0) {
                return {
                    planTitle: effectivePlanTitle,
                    totalPlan: Number(receiptAmount || 0),
                    totalPagado: Number(receiptAmount || 0),
                    saldo: 0
                };
            }
            return null;
        }

        targetPlanId = planData.id;
        effectivePlanTitle = planData.nombre || planData.title || effectivePlanTitle || "Tratamiento Odontológico";
        totalPlan = Number(planData.total || planData.detalles?.total || 0);

        const effectivePatientId = patientId || planData.paciente_id;

        // 3. Sumar todos los pagos acumulados para ESTE plan de tratamiento (sin mezclar con otros)
        let accumulatedPaid = 0;
        const seenPaymentIds = new Set();

        // 3.1. Consultar tabla pagos
        try {
            let pQuery = supabase
                .from("pagos")
                .select("id, monto, notas, estado, referencia, fecha, created_at, paciente_id, tenant_id");

            if (effectivePatientId) {
                pQuery = pQuery.eq("paciente_id", effectivePatientId);
            } else if (tenantId) {
                pQuery = pQuery.eq("tenant_id", tenantId);
            }

            const { data: payRows } = await pQuery;

            (payRows || []).forEach(p => {
                const estado = String(p.estado || "").toLowerCase();
                const ref = String(p.referencia || "").toUpperCase();
                if (estado === "anulado" || ref.includes("ANULADO")) return;

                let meta = {};
                if (typeof p.notas === "string" && p.notas.trim().startsWith("{")) {
                    try { meta = JSON.parse(p.notas); } catch (_) {}
                } else if (typeof p.notas === "object" && p.notas) {
                    meta = p.notas;
                }

                if (meta.estado === "Anulado" || meta.anulado) return;

                const pPlanId = meta.planId || meta.plan_id || p.planId || p.plan_id;
                const pTitle = meta.planTitle || p.planTitle || "";

                const matchesPlan = 
                    (pPlanId && String(pPlanId) === String(targetPlanId)) ||
                    (!pPlanId && pTitle && effectivePlanTitle && pTitle.trim().toLowerCase() === effectivePlanTitle.trim().toLowerCase());

                if (matchesPlan) {
                    accumulatedPaid += Number(p.monto || 0);
                    if (p.id) seenPaymentIds.add(String(p.id));
                }
            });
        } catch (errPagos) {
            console.warn("Error consultando pagos para plan:", errPagos);
        }

        // 3.2. Consultar tabla recibos_caja
        try {
            let rQuery = supabase
                .from("recibos_caja")
                .select("id, monto, total, observaciones, notas, estado, fecha, created_at, paciente_id, tenant_id");

            if (effectivePatientId) {
                rQuery = rQuery.eq("paciente_id", effectivePatientId);
            } else if (tenantId) {
                rQuery = rQuery.eq("tenant_id", tenantId);
            }

            const { data: recRows } = await rQuery;

            (recRows || []).forEach(r => {
                if (r.id && seenPaymentIds.has(String(r.id))) return;
                const estado = String(r.estado || "").toLowerCase();
                const obs = String(r.observaciones || "").toUpperCase();
                if (estado === "anulado" || obs.includes("ANULADO")) return;

                let rMeta = {};
                const rawN = r.notas || r.observaciones;
                if (typeof rawN === "string" && rawN.trim().startsWith("{")) {
                    try { rMeta = JSON.parse(rawN); } catch (_) {}
                } else if (typeof rawN === "object" && rawN) {
                    rMeta = rawN;
                }

                const rPlanId = r.plan_id || r.planId || rMeta.planId || rMeta.plan_id;
                const rTitle = r.planTitle || rMeta.planTitle || "";

                const matchesPlan = 
                    (rPlanId && String(rPlanId) === String(targetPlanId)) ||
                    (!rPlanId && rTitle && effectivePlanTitle && rTitle.trim().toLowerCase() === effectivePlanTitle.trim().toLowerCase());

                if (matchesPlan) {
                    accumulatedPaid += Number(r.total || r.monto || 0);
                    if (r.id) seenPaymentIds.add(String(r.id));
                }
            });
        } catch (errRecibos) {
            console.warn("Error consultando recibos_caja para plan:", errRecibos);
        }

        // Asegurar que al menos incluya el monto del recibo actual si es mayor a lo acumulado encontrado
        if (accumulatedPaid < Number(receiptAmount || 0)) {
            accumulatedPaid = Number(receiptAmount || 0);
        }

        const saldo = Math.max(0, totalPlan - accumulatedPaid);

        return {
            planTitle: effectivePlanTitle,
            totalPlan: totalPlan,
            totalPagado: accumulatedPaid,
            saldo: saldo
        };
    } catch (e) {
        console.error("Error en getReceiptPlanFinancials:", e);
        return null;
    }
};



