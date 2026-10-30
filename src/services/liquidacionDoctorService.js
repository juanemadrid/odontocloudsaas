import { createSupplierExpense } from './supplierExpenseService';
// src/services/liquidacionDoctorService.js
import supabase from "../lib/supabaseClient";
import { isDoctorUser } from "../utils/doctorHelpers";
import { getConfigSection, saveConfigSection } from "./configPersistenceService";
import { getDoctorsList } from "./supabaseServices";

const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === "object" && dateStr instanceof Date) return dateStr;
    const s = String(dateStr).trim();

    // 1. Formato latinoamericano: DD/MM/YYYY (ej: "19/10/2026" o "19/10/2026 20:50")
    const slashParts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2}))?/);
    if (slashParts) {
        const day = Number(slashParts[1]);
        const month = Number(slashParts[2]) - 1;
        const year = Number(slashParts[3]);
        const hour = slashParts[4] !== undefined ? Number(slashParts[4]) : 12;
        const min = slashParts[5] !== undefined ? Number(slashParts[5]) : 0;
        return new Date(year, month, day, hour, min, 0);
    }

    // 2. Timestamp ISO completo con zona horaria (ej: toISOString() → "2026-10-20T01:50:00.000Z").
    //    Debe convertirse a hora local; si se lee solo la parte de fecha, en Colombia (UTC-5)
    //    los procedimientos hechos después de las 7 PM quedarían registrados al día siguiente.
    if (/^\d{4}-\d{1,2}-\d{1,2}T\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
        const isoDate = new Date(s);
        if (!isNaN(isoDate.getTime())) return isoDate;
    }

    // 3. Formato ISO / estándar sin zona: YYYY-MM-DD
    const dashMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (dashMatch) {
        const year = Number(dashMatch[1]);
        const month = Number(dashMatch[2]) - 1;
        const day = Number(dashMatch[3]);
        const hour = dashMatch[4] !== undefined ? Number(dashMatch[4]) : 12;
        const min = dashMatch[5] !== undefined ? Number(dashMatch[5]) : 0;
        return new Date(year, month, day, hour, min, 0);
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
};

const safeNumber = (val) => {
    if (val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

/**
 * Extrae y calcula el desglose financiero real de un ítem de un plan de tratamiento/presupuesto,
 * teniendo en cuenta:
 * - Cantidad de unidades (qty / cantidad)
 * - Valor unitario (amount / precio / valor / valorUnitario / tarifa)
 * - Descuento del presupuesto (descuento / discount en pesos o porcentaje desc_porc)
 * Total Procedimiento = (Valor Unitario * Cantidad) - Descuento
 */
export const calcularDetalleItemPlan = (item, matchedRule = null) => {
    if (!item || typeof item !== "object") {
        return {
            cantidad: 1,
            valorUnitario: 0,
            descuento: 0,
            subtotal: 0,
            valorTotal: 0
        };
    }

    // 1. Cantidad de unidades cotizadas/realizadas
    const rawQty = item.qty !== undefined ? item.qty : (item.cantidad !== undefined ? item.cantidad : (item.cant !== undefined ? item.cant : 1));
    const numQty = safeNumber(rawQty);
    const cantidad = numQty > 0 ? numQty : 1;

    // 2. Valor unitario
    let valorUnitario = safeNumber(
        item.amount ??
        item.precio ??
        item.valor ??
        item.valorUnitario ??
        item.precioUnitario ??
        item.costo ??
        item.tarifa ??
        item.valorPrestacion
    );

    // Si no tiene precio unitario directo pero existe tarifa en lista de precios
    if (valorUnitario === 0 && matchedRule?.precio) {
        valorUnitario = safeNumber(matchedRule.precio);
    }

    // Si aún es 0 y el ítem tiene un total directo mayor a 0
    if (valorUnitario === 0 && safeNumber(item.total) > 0) {
        valorUnitario = cantidad > 1 ? Math.round(safeNumber(item.total) / cantidad) : safeNumber(item.total);
    }

    const subtotal = valorUnitario * cantidad;

    // 3. Descuento aplicado en el presupuesto
    let descuento = safeNumber(
        item.descuento ??
        item.discount ??
        item.descuentoValor ??
        item.descuento_valor
    );

    // Si el descuento fue registrado en porcentaje
    if (descuento === 0) {
        const descPorc = safeNumber(item.desc_porc ?? item.descuentoPorcentaje ?? item.descuento_porcentaje);
        if (descPorc > 0) {
            descuento = Math.round(subtotal * (descPorc / 100));
        }
    }

    // 4. Valor total que el paciente cancela por este procedimiento
    let valorTotal = Math.max(0, subtotal - descuento);

    // Salvaguarda si valorTotal dio 0 pero item.total / item.costoTotal existía directamente
    if (valorTotal === 0 && safeNumber(item.total ?? item.costoTotal) > 0) {
        valorTotal = safeNumber(item.total ?? item.costoTotal);
    }

    return {
        cantidad,
        valorUnitario,
        descuento,
        subtotal,
        valorTotal
    };
};

/**
 * Carga todos los profesionales médicos configurados para liquidar en la clínica.
 */
export const getDoctoresParaLiquidacion = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const [sysDocs, userDetails, doctoresLiquidaciones] = await Promise.all([
            getDoctorsList(tenantId, null).catch(() => []),
            getConfigSection(tenantId, "user_details", {}),
            getConfigSection(tenantId, "doctores_liquidaciones", {})
        ]);

        let profilesList = [];
        try {
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) profilesList = data;
        } catch (e) {}

        if (profilesList.length === 0) {
            try {
                const { data: prof2 } = await supabase
                    .from("profesionales")
                    .select("*")
                    .eq("tenant_id", tenantId);
                if (prof2 && prof2.length > 0) profilesList = prof2;
            } catch (e) {}
        }

        const doctorsMap = new Map();

        // 1. Agregar desde el directorio central de doctores de la clínica (getDoctorsList)
        (sysDocs || []).forEach(doc => {
            const docId = String(doc.id || doc.uid || "").trim();
            if (!docId) return;
            const name = doc.nombreCompleto || doc.nombre || doc.displayName || "Doctor";
            const detail = userDetails[docId] || doctoresLiquidaciones[docId] || {};
            const pct = safeNumber(
                detail.comisionPorcentaje ?? 
                detail.comision ?? 
                doc.raw?.comisionPorcentaje ?? 
                doc.raw?.comisionGeneral ?? 
                35
            );
            const formaPago = detail.formaPago || doc.raw?.formaPago || "Realizadas y pagadas";

            doctorsMap.set(docId, {
                id: docId,
                nombre: name,
                cedula: doc.identificacion || doc.raw?.cedula || doc.raw?.documento || detail.numeroDocumento || "",
                email: doc.email || detail.email || "",
                comisionPorcentaje: pct,
                formaPago: formaPago,
                esDoctor: true
            });
        });

        // 2. Enriquecer o registrar con profiles/profesionales
        profilesList
            .filter(p => isDoctorUser(p, userDetails[p.id]))
            .forEach(p => {
                const docId = String(p.id).trim();
                const detail = userDetails[docId] || doctoresLiquidaciones[docId] || {};
                const name = p.full_name || p.nombreCompleto || p.nombre_completo || 
                    [p.nombre, p.apellido].filter(Boolean).join(" ") || detail.nombre || "Doctor";
                
                const pct = safeNumber(
                    detail.comisionPorcentaje ?? 
                    p.comisionPorcentaje ?? 
                    p.comisionGeneral ?? 
                    p.comisionEspecialista ?? 
                    detail.comision ?? 
                    35
                );
                const formaPago = detail.formaPago || p.formaPago || "Realizadas y pagadas";

                if (doctorsMap.has(docId)) {
                    const existing = doctorsMap.get(docId);
                    doctorsMap.set(docId, {
                        ...existing,
                        nombre: existing.nombre || name,
                        cedula: existing.cedula || p.cedula || p.documento || detail.numeroDocumento || "",
                        email: existing.email || p.email || detail.email || "",
                        comisionPorcentaje: existing.comisionPorcentaje || pct,
                        formaPago: existing.formaPago || formaPago
                    });
                } else {
                    doctorsMap.set(docId, {
                        id: docId,
                        nombre: name,
                        cedula: p.cedula || p.documento || detail.numeroDocumento || "",
                        email: p.email || detail.email || "",
                        comisionPorcentaje: pct,
                        formaPago: formaPago,
                        esDoctor: true
                    });
                }
            });

        const doctors = Array.from(doctorsMap.values());
        doctors.sort((a, b) => a.nombre.localeCompare(b.nombre));
        return doctors;
    } catch (e) {
        console.error("Error al cargar doctores para liquidación:", e);
        return [];
    }
};

/**
 * Obtiene los ítems pendientes por liquidar a un doctor en un rango de fechas.
 * Aplica todas las reglas de negocio de OralDrive / OdontoCloud:
 * - Ítems realizados por el doctor (con fecha de realización en rango).
 * - Exclusión de ítems con pago fijo = $0 en lista de precios.
 * - Pago de valor fijo si el ítem tiene usar_pago_fijo = true.
 * - Validación de pago del paciente si formaPago = "Realizadas y pagadas".
 * - Exclusión de ítems previamente liquidados en liquidaciones activas.
 */
export const getItemsPendientesPorDoctor = async (tenantId, doctorId, dateRange) => {
    if (!tenantId || !doctorId) return { doctor: null, items: [], totalItems: 0, totalValor: 0 };

    try {
        const start = parseLocalDate(dateRange.desde);
        start.setHours(0, 0, 0, 0);
        const end = parseLocalDate(dateRange.hasta);
        end.setHours(23, 59, 59, 999);

        // 1. Obtener doctores configurados
        const allDocs = await getDoctoresParaLiquidacion(tenantId);
        const currentDoctor = allDocs.find(d => d.id === doctorId) || {
            id: doctorId,
            nombre: "Doctor",
            comisionPorcentaje: 35,
            formaPago: "Realizadas y pagadas"
        };

        const currentDocNorm = (currentDoctor.nombre || "").toLowerCase().trim();
        const doctorNamesSet = new Set([
            currentDocNorm,
            ...currentDocNorm.split(" ").filter(w => w.length > 2)
        ]);
        const currentDocIdStr = String(currentDoctor.id || doctorId).toLowerCase().trim();

        // 2. Cargar Planes de Tratamiento
        let plansList = [];
        try {
            const { data } = await supabase
                .from("treatment_plans")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) plansList = data;
        } catch (e) {}

        if (plansList.length === 0) {
            plansList = await getConfigSection(tenantId, "treatment_plans", []);
        }

        // 3. Cargar Evoluciones
        let evolucionesList = [];
        try {
            const { data } = await supabase
                .from("evoluciones")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) evolucionesList = data;
        } catch (e) {}

        if (evolucionesList.length === 0) {
            evolucionesList = await getConfigSection(tenantId, "evoluciones", []);
        }

        // Parsear evoluciones
        const parsedEvoluciones = evolucionesList.map(e => {
            let tData = {};
            try {
                tData = typeof e.tratamiento === "string" ? JSON.parse(e.tratamiento) : (e.tratamiento || {});
            } catch (_) {
                tData = { raw: e.tratamiento };
            }
            return {
                id: e.id,
                ...e,
                _tData: tData,
                doctorId: e.profesional_id || tData.profesionalId || tData.doctorId || null,
                doctorName: tData.profesional || e.profesionalNombre || "",
                plantillaItems: tData.plantillaItems || {},
                fechaDate: new Date(e.fecha || e.created_at || tData.date || 0)
            };
        });

        // 4. Cargar Pacientes para nombres completos
        let pacientesList = [];
        try {
            const { data } = await supabase
                .from("pacientes")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) pacientesList = data;
        } catch (e) {}
        if (pacientesList.length === 0) {
            pacientesList = await getConfigSection(tenantId, "pacientes", []);
        }
        const pacientesMap = {};
        pacientesList.forEach(p => {
            const fullName = p.nombreCompleto || p.nombre_completo ||
                [p.nombres || p.nombre, p.apellidos || p.apellido].filter(Boolean).join(" ") || "Paciente";
            pacientesMap[p.id] = {
                nombre: fullName,
                documento: p.cedula || p.documento || ""
            };
        });

        // 5. Cargar Pagos y Recibos de Caja (para saber si el ítem o plan está pagado por el cliente)
        let pagosList = [];
        let recibosList = [];
        try {
            const [pRes, rRes] = await Promise.all([
                supabase.from("pagos").select("*").eq("tenant_id", tenantId),
                supabase.from("recibos_caja").select("*").eq("tenant_id", tenantId)
            ]);
            if (pRes.data && pRes.data.length > 0) pagosList = pRes.data;
            if (rRes.data && rRes.data.length > 0) recibosList = rRes.data;
        } catch (e) {}

        if (pagosList.length === 0) {
            pagosList = await getConfigSection(tenantId, "pagos", []);
        }
        if (recibosList.length === 0) {
            recibosList = await getConfigSection(tenantId, "recibos_caja", []);
        }

        // Mapear pagos activos por planId, por paciente y por ítem específico
        const pagosPorPlan = {};
        const pagosPorPaciente = {};
        const paidItemsSet = new Set();
        const paidItemsDoctorMap = {};

        pagosList.forEach(p => {
            if (p.estado === "Anulado" || p.concepto === "SALDO A FAVOR") return;
            const monto = safeNumber(p.monto || p.valor);

            let meta = {};
            if (p.notas && typeof p.notas === "object") {
                meta = p.notas;
            } else if (typeof p.notas === "string" && p.notas.trim().startsWith("{")) {
                try { meta = JSON.parse(p.notas); } catch (_) {}
            } else if (p.detalles && typeof p.detalles === "object") {
                meta = p.detalles;
            } else if (p.metadata && typeof p.metadata === "object") {
                meta = p.metadata;
            }

            const effectivePlanId = p.planId || meta.planId || meta.treatmentPlanId;
            const effectivePacienteId = p.pacienteId || p.paciente_id || meta.pacienteId;

            if (effectivePlanId) {
                pagosPorPlan[effectivePlanId] = (pagosPorPlan[effectivePlanId] || 0) + monto;
            }
            if (effectivePacienteId) {
                pagosPorPaciente[effectivePacienteId] = (pagosPorPaciente[effectivePacienteId] || 0) + monto;
            }

            // Registrar ítems pagados individualmente y profesional asignado al pago
            const itemPayments = meta.itemPayments || p.itemPayments || [];
            if (Array.isArray(itemPayments)) {
                itemPayments.forEach(itPay => {
                    const itId = itPay.id || itPay.itemId;
                    if (itId) {
                        paidItemsSet.add(String(itId));
                        if (effectivePlanId) {
                            paidItemsSet.add(`${effectivePlanId}_${itId}`);
                        }
                        if (itPay.profesionalId || itPay.profesional || meta.profesionalId || meta.profesional) {
                            paidItemsDoctorMap[String(itId)] = {
                                doctorId: itPay.profesionalId || meta.profesionalId || null,
                                doctorName: itPay.profesional || meta.profesional || ""
                            };
                        }
                    }
                });
            }
        });

        // Procesar también recibos de caja para vinculación por paciente y plan
        (recibosList || []).forEach(r => {
            if (r.estado === "Anulado" || r.anulado === true) return;
            const monto = safeNumber(r.total || r.monto);
            const pacId = r.paciente_id || r.pacienteId;
            if (pacId) {
                pagosPorPaciente[pacId] = (pagosPorPaciente[pacId] || 0) + monto;
            }
            const plId = r.plan_id || r.planId;
            if (plId) {
                pagosPorPlan[plId] = (pagosPorPlan[plId] || 0) + monto;
            }
            const rcConceptos = r.conceptos || [];
            if (Array.isArray(rcConceptos)) {
                rcConceptos.forEach(c => {
                    const cNombre = (c.concepto || c.descripcion || "").toLowerCase().trim();
                    if (cNombre) paidItemsSet.add(cNombre);
                });
            }
        });

        // 6. Cargar Listas de Precios para reglas de Valor Fijo y Exclusión ($0)
        let listasPrecios = [];
        try {
            const { data } = await supabase
                .from("listas_precios")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) listasPrecios = data;
        } catch (e) {}
        if (listasPrecios.length === 0) {
            listasPrecios = await getConfigSection(tenantId, "listas_precios", []);
        }

        // Crear mapa de tarifas de ítems: por código CUPS y por nombre normalizado
        const itemRulesMap = {};
        listasPrecios.forEach(lp => {
            let catItems = [];
            try {
                catItems = typeof lp.descripcion === "string" ? JSON.parse(lp.descripcion) : (lp.descripcion || []);
            } catch (_) {}
            if (Array.isArray(catItems)) {
                catItems.forEach(it => {
                    const rule = {
                        // El editor guarda siempre pago_fijo_doctor (0 por defecto) y usar_pago_fijo=false.
                        // Solo es pago fijo si el check está activo explícitamente, o si es un ítem
                        // antiguo sin el check pero con un valor fijo positivo.
                        usar_pago_fijo: it.usar_pago_fijo === true ||
                            (it.usar_pago_fijo === undefined && safeNumber(it.pago_fijo_doctor) > 0),
                        pago_fijo_doctor: it.pago_fijo_doctor !== undefined && it.pago_fijo_doctor !== null && it.pago_fijo_doctor !== "" ? safeNumber(it.pago_fijo_doctor) : null,
                        precio: safeNumber(it.precio || it.valor || it.tarifa || it.costo)
                    };
                    if (it.codigo) {
                        itemRulesMap[it.codigo.toUpperCase().trim()] = rule;
                    }
                    if (it.nombre) {
                        itemRulesMap[it.nombre.toLowerCase().trim()] = rule;
                    }
                });
            }
        });

        // 7. Cargar Liquidaciones existentes para no duplicar ítems liquidados
        let liquidaciones = [];
        try {
            const { data } = await supabase
                .from("liquidaciones")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) liquidaciones = data;
        } catch (e) {}
        if (liquidaciones.length === 0) {
            liquidaciones = await getConfigSection(tenantId, "liquidaciones", []);
        }

        const itemsLiquidadosKeys = new Set();
        liquidaciones.forEach(liq => {
            if (liq.estado === "Anulada" || liq.estado === "anulada") return;
            const keys = liq.conceptosLiquidados || liq.itemsIds || [];
            if (Array.isArray(keys)) {
                keys.forEach(k => itemsLiquidadosKeys.add(String(k)));
            }
            if (Array.isArray(liq.items)) {
                liq.items.forEach(it => {
                    if (it.key) itemsLiquidadosKeys.add(String(it.key));
                    if (it.id) itemsLiquidadosKeys.add(String(it.id));
                    if (it.itemId && it.planId) itemsLiquidadosKeys.add(`${it.planId}_${it.itemId}`);
                });
            }
        });

        // 8. Recorrer planes de tratamiento y procesar ítems realizados
        const pendingItems = [];

        plansList.forEach(plan => {
            const planDetails = plan.detalles || {};
            const rawItems = Array.isArray(plan.items) ? plan.items : (Array.isArray(planDetails.items) ? planDetails.items : (Array.isArray(planDetails) ? planDetails : []));
            const planDoctorId = plan.profesionalId || plan.profesional_id || planDetails.profesionalId || plan.doctor_id || "";
            const planDoctorName = plan.profesional || plan.profesional_nombre || planDetails.profesional || "";
            const planTotal = safeNumber(plan.total || planDetails.costoTotal || planDetails.total);
            const planAbonado = pagosPorPlan[plan.id] || 0;
            const planTotalmentePagado = planTotal > 0 && planAbonado >= (planTotal - 1);

            const pacInfo = pacientesMap[plan.paciente_id] || { nombre: "Paciente", documento: "" };

            // Mapeo exacto de pagos aplicados por ítem dentro de este plan
            const planItemsPaidMap = {};
            rawItems.forEach((it, idx) => {
                const itId = String(it.id || `item_${idx}`);
                planItemsPaidMap[itId] = 0;
            });

            let unallocatedPlanPayments = 0;

            // A. Procesar pagos de la tabla 'pagos' asignados a este plan o paciente
            pagosList.forEach(p => {
                if (p.estado === "Anulado" || p.concepto === "SALDO A FAVOR") return;
                const pMonto = safeNumber(p.monto || p.valor);
                if (pMonto <= 0) return;

                let meta = {};
                if (p.notas && typeof p.notas === "object") meta = p.notas;
                else if (typeof p.notas === "string" && p.notas.trim().startsWith("{")) {
                    try { meta = JSON.parse(p.notas); } catch (_) {}
                } else if (p.detalles && typeof p.detalles === "object") meta = p.detalles;
                else if (p.metadata && typeof p.metadata === "object") meta = p.metadata;

                const effectivePlanId = p.planId || meta.planId || meta.treatmentPlanId;
                const effectivePacId = p.pacienteId || p.paciente_id || meta.pacienteId;

                const isPlanMatch = effectivePlanId && String(effectivePlanId) === String(plan.id);
                const isPacMatch = effectivePacId && String(effectivePacId) === String(plan.paciente_id);

                if (!isPlanMatch && !isPacMatch) return;

                const itemPayments = meta.itemPayments || p.itemPayments || [];
                if (Array.isArray(itemPayments) && itemPayments.length > 0) {
                    let matchedAny = false;
                    itemPayments.forEach(ip => {
                        const ipId = String(ip.id || ip.itemId || "");
                        const ipMonto = safeNumber(ip.monto || ip.amount || ip.valor);
                        const ipDesc = String(ip.desc || ip.nombre || "").toLowerCase().trim();

                        if (ipId && planItemsPaidMap[ipId] !== undefined) {
                            planItemsPaidMap[ipId] += ipMonto;
                            matchedAny = true;
                        } else if (ipDesc) {
                            const found = rawItems.find(it => {
                                const n = String(it.nombre || it.desc || it.prestacion || "").toLowerCase().trim();
                                return n && (n === ipDesc || n.includes(ipDesc) || ipDesc.includes(n));
                            });
                            if (found) {
                                const fId = String(found.id);
                                planItemsPaidMap[fId] = (planItemsPaidMap[fId] || 0) + ipMonto;
                                matchedAny = true;
                            }
                        }
                    });
                    if (!matchedAny && isPlanMatch) {
                        unallocatedPlanPayments += pMonto;
                    }
                } else if (isPlanMatch) {
                    unallocatedPlanPayments += pMonto;
                }
            });

            // B. Procesar recibos de caja de la tabla 'recibos_caja'
            recibosList.forEach(r => {
                if (r.estado === "Anulado" || r.anulado === true) return;
                const rTotal = safeNumber(r.total || r.monto);
                if (rTotal <= 0) return;

                const rPlanId = r.plan_id || r.planId;
                const rPacId = r.paciente_id || r.pacienteId;

                const isPlanMatch = rPlanId && String(rPlanId) === String(plan.id);
                const isPacMatch = rPacId && String(rPacId) === String(plan.paciente_id);

                if (!isPlanMatch && !isPacMatch) return;

                const rcConceptos = r.conceptos || [];
                if (Array.isArray(rcConceptos) && rcConceptos.length > 0) {
                    let matchedAny = false;
                    rcConceptos.forEach(c => {
                        const cId = String(c.itemId || c.id || "");
                        const cMonto = safeNumber(c.total || (safeNumber(c.precioUnitario) * safeNumber(c.cantidad || 1)));
                        const cNombre = String(c.concepto || c.descripcion || "").toLowerCase().trim();

                        if (cId && planItemsPaidMap[cId] !== undefined) {
                            planItemsPaidMap[cId] += cMonto;
                            matchedAny = true;
                        } else if (cNombre) {
                            const found = rawItems.find(it => {
                                const n = String(it.nombre || it.desc || it.prestacion || "").toLowerCase().trim();
                                return n && (n === cNombre || n.includes(cNombre) || cNombre.includes(n));
                            });
                            if (found) {
                                const fId = String(found.id);
                                planItemsPaidMap[fId] = (planItemsPaidMap[fId] || 0) + cMonto;
                                matchedAny = true;
                            }
                        }
                    });
                    if (!matchedAny && isPlanMatch) {
                        unallocatedPlanPayments += rTotal;
                    }
                } else if (isPlanMatch) {
                    unallocatedPlanPayments += rTotal;
                }
            });

            // C. Si hay abonos genéricos al plan sin desglose por ítem, distribuirlos secuencialmente a los ítems con saldo pendiente
            if (unallocatedPlanPayments > 0) {
                let remainingGen = unallocatedPlanPayments;
                for (let i = 0; i < rawItems.length; i++) {
                    if (remainingGen <= 0) break;
                    const it = rawItems[i];
                    const itId = String(it.id || `item_${i}`);
                    const cupsK = String(it.codigo || it.cups || it.codigo_cups || "").toUpperCase().trim();
                    const nameK = String(it.nombre || it.desc || it.prestacion || "").toLowerCase().trim();
                    const ruleK = (cupsK && itemRulesMap[cupsK]) || (nameK && itemRulesMap[nameK]);
                    const itDetalleGen = calcularDetalleItemPlan(it, ruleK);
                    let itCost = itDetalleGen.valorTotal;

                    const alreadyPaid = planItemsPaidMap[itId] || 0;
                    const pendingSaldo = Math.max(0, itCost - alreadyPaid);
                    if (pendingSaldo > 0) {
                        const alloc = Math.min(pendingSaldo, remainingGen);
                        planItemsPaidMap[itId] = (planItemsPaidMap[itId] || 0) + alloc;
                        remainingGen -= alloc;
                    }
                }
            }

            rawItems.forEach((item, idx) => {
                const itemId = item.id || `item_${idx}`;
                const itemKey = `${plan.id}_${itemId}`;

                // Regla A: Si ya está liquidado en una liquidación activa, omitir
                if (item.liquidado === true || itemsLiquidadosKeys.has(itemKey) || itemsLiquidadosKeys.has(itemId)) {
                    return;
                }

                // Regla B: Verificar si el ítem está Realizado
                let isRealizado = (
                    item.realizado === true || 
                    item.realizada === true || 
                    item.estado === "completado" || 
                    item.estado === "realizado" ||
                    item.status === "completed" ||
                    item.status === "realizado"
                );

                // Buscar en evoluciones si este ítem fue evolucionado
                const itNameLower = String(item.nombre || item.desc || item.prestacion || "").toLowerCase().trim();
                const planIdStr = String(plan.id || "");

                let matchedEvolution = parsedEvoluciones.find(evo => {
                    if (evo.paciente_id !== plan.paciente_id) return false;

                    // A. Match directo por itemId en plantillaItems o serviciosIds
                    if (
                        evo.plantillaItems?.[itemId]?.realizado === true ||
                        evo.plantillaItems?.[itemId]?.checked === true ||
                        evo._tData?.plantillaItems?.[itemId]?.realizado === true ||
                        evo._tData?.plantillaItems?.[itemId]?.checked === true ||
                        (Array.isArray(evo.serviciosIds) && evo.serviciosIds.some(id => String(id) === String(itemId))) ||
                        (Array.isArray(evo._tData?.serviciosIds) && evo._tData.serviciosIds.some(id => String(id) === String(itemId)))
                    ) {
                        return true;
                    }

                    // B. Coincidencia por planId y texto del procedimiento / tratamiento
                    const evoPlanId = String(evo.planId || evo._tData?.planId || "");
                    const evoText = String(evo._tData?.treatment || evo._tData?.comentario || evo.tratamiento || "").toLowerCase();

                    if (evoPlanId && evoPlanId === planIdStr) {
                        if (!itNameLower || evoText.includes(itNameLower) || itNameLower.length < 3) return true;
                    }

                    // C. Coincidencia por nombre de procedimiento en la evolución
                    if (itNameLower && itNameLower.length >= 4 && evoText.includes(itNameLower)) {
                        return true;
                    }

                    return false;
                });

                if (!isRealizado && matchedEvolution) {
                    isRealizado = true;
                }

                // Debe estar realizado para poderse liquidar
                if (!isRealizado) return;

                // Regla C: Identificar profesional que realizó el ítem
                // Si la evolución clínica tiene un profesional asignado, ese tiene máxima prioridad (el profesional tratante que ejecutó el procedimiento)
                const evoDoctorId = matchedEvolution?.profesional_id || matchedEvolution?._tData?.profesionalId || matchedEvolution?._tData?.doctorId || matchedEvolution?.doctorId;
                const evoDoctorName = matchedEvolution?._tData?.profesional || matchedEvolution?.profesionalNombre || matchedEvolution?.doctorName;

                const paidDocInfo = paidItemsDoctorMap[String(itemId)] || {};
                const itemDoctorId = evoDoctorId || item.profesionalId || item.doctorId || item.profesional_id || 
                    paidDocInfo.doctorId || planDoctorId;
                const itemDoctorName = evoDoctorName || item.profesional || item.doctor || 
                    paidDocInfo.doctorName || planDoctorName;

                let matchesDoctor = false;
                if (itemDoctorId && (String(itemDoctorId) === String(doctorId) || String(itemDoctorId).toLowerCase() === currentDocIdStr)) {
                    matchesDoctor = true;
                } else if (itemDoctorName) {
                    const normDoc = itemDoctorName.toLowerCase().trim();
                    if (doctorNamesSet.has(normDoc) || normDoc.includes(currentDocNorm) || currentDocNorm.includes(normDoc)) {
                        matchesDoctor = true;
                    }
                }

                if (!matchesDoctor) return;

                // Regla D: Fecha de realización debe estar en el rango [desde, hasta]
                let fechaRealizadoRaw = item.fechaRealizado || item.fecha_realizado || 
                    matchedEvolution?.fecha || matchedEvolution?.created_at || item.fecha || plan.created_at;
                
                let fechaObj = fechaRealizadoRaw ? parseLocalDate(fechaRealizadoRaw) : new Date(plan.created_at || 0);
                if (!fechaObj || isNaN(fechaObj.getTime())) return;

                if (fechaObj < start || fechaObj > end) return;

                // Regla E: Buscar regla en Lista de Precios (Pago Fijo o Exclusión $0)
                const cupsKey = String(item.codigo || item.cups || item.codigo_cups || "").toUpperCase().trim();
                const nameKey = String(item.nombre || item.desc || item.prestacion || "").toLowerCase().trim();
                const matchedRule = (cupsKey && itemRulesMap[cupsKey]) || (nameKey && itemRulesMap[nameKey]);

                let tipoLiquidacion = "porcentaje";
                let pagoFijoValor = 0;

                if (matchedRule && matchedRule.usar_pago_fijo) {
                    // Si el valor fijo es $0, se excluye de la liquidación de doctores
                    if (matchedRule.pago_fijo_doctor === 0) {
                        return; // Excluido!
                    }
                    if (matchedRule.pago_fijo_doctor > 0) {
                        tipoLiquidacion = "fijo";
                        pagoFijoValor = matchedRule.pago_fijo_doctor;
                    }
                }

                // Cálculo del valor real del ítem teniendo en cuenta cantidades y descuentos aplicados
                const itemDetalle = calcularDetalleItemPlan(item, matchedRule);
                const itemValor = itemDetalle.valorTotal;

                // Regla F: Validación estricta de Pago Total por el Cliente
                // Si la forma de pago del doctor es "Realizadas y pagadas":
                // SOLO se permite liquidar si el procedimiento fue pagado en su TOTALIDAD por el paciente.
                // Si el paciente solo realizó un abono parcial a este ítem o tiene saldo pendiente, NO se liquida.
                const paidForItem = safeNumber(planItemsPaidMap[String(itemId)] ?? planItemsPaidMap[String(item.id)]);

                const isPaidInFull = (
                    planTotalmentePagado ||
                    (itemValor > 0 && paidForItem >= (itemValor - 1)) ||
                    (item.pagado === true && (item.saldo === undefined || item.saldo === 0)) ||
                    (item.pagada === true && (item.saldo === undefined || item.saldo === 0))
                );

                const formaPagoDoctor = String(currentDoctor.formaPago || "").toLowerCase();
                const requierePagado = formaPagoDoctor.includes("pagada") || formaPagoDoctor.includes("pagado");

                if (requierePagado && !isPaidInFull) {
                    // El doctor solo se liquida cuando el procedimiento está Realizado Y Pagado en su TOTALIDAD.
                    // Si el paciente solo realizó un abono parcial a este ítem, no se liquida.
                    return;
                }

                const valorPagarCalculado = tipoLiquidacion === "fijo" 
                    ? (pagoFijoValor * itemDetalle.cantidad) 
                    : Math.round(itemValor * currentDoctor.comisionPorcentaje / 100);

                pendingItems.push({
                    key: itemKey,
                    id: itemId,
                    planId: plan.id,
                    planTitulo: plan.nombre || planDetails.title || "Plan de Tratamiento",
                    pacienteId: plan.paciente_id,
                    pacienteNombre: pacInfo.nombre,
                    pacienteDocumento: pacInfo.documento,
                    prestacion: item.nombre || item.desc || item.prestacion || "Procedimiento Odontológico",
                    codigoCups: cupsKey || "—",
                    fechaRealizado: fechaObj.toISOString(),
                    fechaObj: fechaObj,
                    fechaFormateada: fechaObj.toLocaleDateString("es-CO"),
                    cantidad: itemDetalle.cantidad,
                    valorUnitario: itemDetalle.valorUnitario,
                    descuento: itemDetalle.descuento,
                    subtotal: itemDetalle.subtotal,
                    valorPrestacion: itemValor,
                    valorRecaudado: itemValor,
                    tipoLiquidacion: tipoLiquidacion,
                    pagoFijoValor: pagoFijoValor,
                    porcentaje: currentDoctor.comisionPorcentaje,
                    costoLaboratorio: safeNumber(item.costoLaboratorio || item.costoLab || 0),
                    valorAPagar: valorPagarCalculado,
                    estadoPagoCliente: isPaidInFull ? "Pagado total" : "Pendiente de pago",
                    rawItem: item
                });
            });
        });

        // Ordenar por fecha descendente
        pendingItems.sort((a, b) => b.fechaObj - a.fechaObj);

        const totalValor = pendingItems.reduce((acc, it) => acc + it.valorPrestacion, 0);

        return {
            doctor: currentDoctor,
            items: pendingItems,
            totalItems: pendingItems.length,
            totalValor: totalValor
        };

    } catch (e) {
        console.error("Error al obtener ítems pendientes de liquidación:", e);
        return { doctor: null, items: [], totalItems: 0, totalValor: 0 };
    }
};

/**
 * Guarda una nueva liquidación en estado "Generada".
 * Marca los ítems en los planes de tratamiento correspondientes como liquidados.
 */
export const crearLiquidacionGenerada = async (tenantId, liquidacionData, userProfile) => {
    const liqId = `liq_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newLiq = {
        id: liqId,
        tenant_id: tenantId,
        inquilino: tenantId,
        profesionalId: liquidacionData.doctor.id,
        profesionalNombre: liquidacionData.doctor.nombre,
        fechaInicio: liquidacionData.dateRange.desde,
        fechaFin: liquidacionData.dateRange.hasta,
        totalRecaudado: liquidacionData.totalRecaudado,
        totalItemsValor: liquidacionData.totalRecaudado,
        totalPagar: liquidacionData.totalNetoPagar,
        comisionesTotal: liquidacionData.totalComisiones,
        comisionPorcentaje: liquidacionData.comisionPct,
        gastos: liquidacionData.gastos || [],
        totalGastosLab: liquidacionData.totalGastosLab || 0,
        totalGastos: liquidacionData.totalGastos || 0,
        bonificaciones: liquidacionData.bonificaciones || [],
        totalBonificaciones: liquidacionData.totalBonificaciones || 0,
        deducciones: liquidacionData.deducciones || [],
        totalDeducciones: liquidacionData.totalDeducciones || 0,
        conceptosLiquidados: liquidacionData.conceptosLiquidados || [],
        items: liquidacionData.selectedItems || [],
        estado: "Generada",
        registradoPor: userProfile?.nombre || userProfile?.full_name || userProfile?.email || "Administración",
        created_at: nowIso,
        updated_at: nowIso
    };

    // 1. Intentar insertar en tabla liquidaciones
    try {
        await supabase.from("liquidaciones").insert([{
            id: newLiq.id,
            tenant_id: tenantId,
            profesional_id: newLiq.profesionalId,
            periodo: `${newLiq.fechaInicio} al ${newLiq.fechaFin}`,
            monto: newLiq.totalPagar,
            estado: "Generada",
            created_at: nowIso
        }]);
    } catch (e) {
        console.warn("Tabla liquidaciones no disponible directamente, sincronizando en config:", e.message);
    }

    // 2. Persistir siempre en website_config.liquidaciones
    try {
        const currentList = await getConfigSection(tenantId, "liquidaciones", []);
        await saveConfigSection(tenantId, "liquidaciones", [
            newLiq,
            ...(Array.isArray(currentList) ? currentList : [])
        ]);
    } catch (e) {
        console.error("Error guardando liquidación en website_config:", e);
    }

    // 3. Marcar ítems de treatment_plans como liquidados
    try {
        const affectedPlanIds = new Set();
        (liquidacionData.selectedItems || []).forEach(it => {
            if (it.planId) affectedPlanIds.add(it.planId);
        });

        for (const planId of affectedPlanIds) {
            let planRow = null;
            try {
                const { data } = await supabase.from("treatment_plans").select("*").eq("id", planId).maybeSingle();
                if (data) planRow = data;
            } catch (_) {}

            if (planRow) {
                const planDetails = planRow.detalles || {};
                const items = Array.isArray(planRow.items) ? planRow.items : (Array.isArray(planDetails.items) ? planDetails.items : []);
                const updatedItems = items.map((it, idx) => {
                    const itemId = it.id || `item_${idx}`;
                    const isSelected = (liquidacionData.selectedItems || []).some(sel => sel.planId === planId && sel.id === itemId);
                    if (isSelected) {
                        return { ...it, liquidado: true, liquidacionId: liqId };
                    }
                    return it;
                });

                await supabase.from("treatment_plans").update({
                    detalles: { ...planDetails, items: updatedItems },
                    updated_at: nowIso
                }).eq("id", planId);
            }
        }
    } catch (updatePlanErr) {
        console.warn("No se pudo actualizar la marca liquidado en treatment_plans:", updatePlanErr);
    }

    return newLiq;
};

/**
 * Anula una liquidación generada para que sus ítems vuelvan al listado de pendientes.
 */
export const anularLiquidacionGenerada = async (tenantId, liquidacionId) => {
    const nowIso = new Date().toISOString();

    // 1. Obtener la liquidación
    let currentLiqs = await getConfigSection(tenantId, "liquidaciones", []);
    const targetLiq = currentLiqs.find(l => l.id === liquidacionId);

    // Actualizar estado a "Anulada"
    currentLiqs = currentLiqs.map(l => {
        if (l.id === liquidacionId) {
            return { ...l, estado: "Anulada", anulado_at: nowIso };
        }
        return l;
    });
    await saveConfigSection(tenantId, "liquidaciones", currentLiqs);

    try {
        await supabase.from("liquidaciones").update({ estado: "Anulada" }).eq("id", liquidacionId);
    } catch (_) {}

    // 2. Liberar los ítems en treatment_plans
    if (targetLiq && Array.isArray(targetLiq.items)) {
        try {
            const affectedPlanIds = new Set();
            targetLiq.items.forEach(it => { if (it.planId) affectedPlanIds.add(it.planId); });

            for (const planId of affectedPlanIds) {
                let planRow = null;
                try {
                    const { data } = await supabase.from("treatment_plans").select("*").eq("id", planId).maybeSingle();
                    if (data) planRow = data;
                } catch (_) {}

                if (planRow) {
                    const planDetails = planRow.detalles || {};
                    const items = Array.isArray(planRow.items) ? planRow.items : (Array.isArray(planDetails.items) ? planDetails.items : []);
                    const updatedItems = items.map((it, idx) => {
                        const itemId = it.id || `item_${idx}`;
                        const isMatch = targetLiq.items.some(t => t.planId === planId && t.id === itemId);
                        if (isMatch) {
                            return { ...it, liquidado: false, liquidacionId: null };
                        }
                        return it;
                    });

                    await supabase.from("treatment_plans").update({
                        detalles: { ...planDetails, items: updatedItems },
                        updated_at: nowIso
                    }).eq("id", planId);
                }
            }
        } catch (e) {
            console.warn("Error al liberar ítems en treatment_plans:", e);
        }
    }

    return true;
};

/**
 * Paga una liquidación generada:
 * - Cambia estado a "Pagada"
 * - Genera el egreso en pagos_proveedor para que se vea en Facturación - Pagos
 */
export const pagarLiquidacion = async (tenantId, liquidacion, pagoOptions = {}, userProfile) => {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split("T")[0];
    const pagoId = `pago_liq_${crypto.randomUUID()}`;

    // 1. Crear registro de pago a proveedor (Médico)
    const doctorName = liquidacion.profesionalNombre || "Doctor";
    const pagoRecord = {
        id: pagoId,
        tenant_id: tenantId,
        fecha: todayStr,
        profesionalId: liquidacion.profesionalId,
        profesional: doctorName,
        tercero: doctorName,
        proveedor: doctorName,
        bancoCaja: pagoOptions.bancoCaja || "CAJA PRINCIPAL",
        medioPago: pagoOptions.medioPago || "Transferencia",
        condicionPago: "Contado",
        concepto: "Liquidación comisiones",
        monto: safeNumber(liquidacion.totalPagar),
        total: safeNumber(liquidacion.totalPagar),
        items: [{
            concepto: "Liquidación comisiones",
            cantidad: 1,
            precio: safeNumber(liquidacion.totalPagar),
            total: safeNumber(liquidacion.totalPagar)
        }],
        observaciones: "Generado automáticamente desde módulo de Liquidaciones.", // el ID queda en liquidacionId
        liquidacionId: liquidacion.id,
        created_at: nowIso,
        created_by: userProfile?.nombre || userProfile?.email || "Administración"
    };

    return createSupplierExpense(tenantId, pagoRecord, liquidacion.id);
};
