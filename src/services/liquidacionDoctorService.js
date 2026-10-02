// src/services/liquidacionDoctorService.js
import supabase from "../lib/supabaseClient";
import { isDoctorUser } from "../utils/doctorHelpers";
import { getConfigSection, saveConfigSection } from "./configPersistenceService";
import { getDoctorsList } from "./supabaseServices";

const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === "object" && dateStr instanceof Date) return dateStr;
    const parts = String(dateStr).split("T")[0].split("-");
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateStr);
};

const safeNumber = (val) => {
    if (val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
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
                .select("id, nombre, apellido, nombreCompleto, documento, cedula")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) pacientesList = data;
        } catch (e) {}
        if (pacientesList.length === 0) {
            pacientesList = await getConfigSection(tenantId, "pacientes", []);
        }
        const pacientesMap = {};
        pacientesList.forEach(p => {
            const fullName = p.nombreCompleto || [p.nombre, p.apellido].filter(Boolean).join(" ") || "Paciente";
            pacientesMap[p.id] = {
                nombre: fullName,
                documento: p.cedula || p.documento || ""
            };
        });

        // 5. Cargar Pagos (para saber si el ítem o plan está pagado por el cliente)
        let pagosList = [];
        try {
            const { data } = await supabase
                .from("pagos")
                .select("*")
                .eq("tenant_id", tenantId);
            if (data && data.length > 0) pagosList = data;
        } catch (e) {}
        if (pagosList.length === 0) {
            pagosList = await getConfigSection(tenantId, "pagos", []);
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
                        usar_pago_fijo: it.usar_pago_fijo === true || it.pago_fijo_doctor !== undefined,
                        pago_fijo_doctor: it.pago_fijo_doctor !== undefined && it.pago_fijo_doctor !== "" ? safeNumber(it.pago_fijo_doctor) : null
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
            const planTotalmentePagado = planTotal > 0 && planAbonado >= planTotal;

            const pacInfo = pacientesMap[plan.paciente_id] || { nombre: "Paciente", documento: "" };

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
                    item.estado === "realizado"
                );

                // Buscar en evoluciones si este ítem fue evolucionado
                let matchedEvolution = parsedEvoluciones.find(evo => 
                    evo.paciente_id === plan.paciente_id && (
                        evo.plantillaItems?.[itemId]?.realizado === true ||
                        evo.plantillaItems?.[itemId]?.checked === true ||
                        evo._tData?.plantillaItems?.[itemId]?.realizado === true ||
                        evo._tData?.plantillaItems?.[itemId]?.checked === true
                    )
                );

                if (!isRealizado && matchedEvolution) {
                    isRealizado = true;
                }

                // Debe estar realizado para poderse liquidar
                if (!isRealizado) return;

                // Regla C: Identificar profesional que realizó el ítem
                // Prioridad: profesional asignado en el ítem, en la evolución, en el pago, o en el plan
                const paidDocInfo = paidItemsDoctorMap[String(itemId)] || {};
                const itemDoctorId = item.profesionalId || item.doctorId || item.profesional_id || 
                    matchedEvolution?.doctorId || paidDocInfo.doctorId || planDoctorId;
                const itemDoctorName = item.profesional || item.doctor || matchedEvolution?.doctorName || 
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
                
                const fechaObj = fechaRealizadoRaw ? new Date(fechaRealizadoRaw) : new Date(plan.created_at || 0);
                if (isNaN(fechaObj.getTime())) return;

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

                // Regla F: Forma de pago del usuario (Doctor)
                // Si formaPago es "Realizadas y pagadas", verificar que esté pagado por el cliente
                const isPaid = (
                    item.pagado === true || 
                    item.pagada === true || 
                    paidItemsSet.has(String(itemId)) ||
                    paidItemsSet.has(itemKey) ||
                    safeNumber(item.pagado) >= safeNumber(item.precio || item.valor) ||
                    planTotalmentePagado || 
                    planAbonado >= safeNumber(item.precio || item.valor) ||
                    (planAbonado > 0 && Math.abs(planTotal - planAbonado) < 1)
                );

                const formaPagoDoctor = String(currentDoctor.formaPago || "").toLowerCase();
                const requierePagado = formaPagoDoctor.includes("pagada") || formaPagoDoctor.includes("pagado");

                if (requierePagado && !isPaid) {
                    // El doctor solo se liquida cuando está Realizado Y Pagado por el cliente
                    return;
                }

                // Cálculo del valor del ítem
                const itemValor = safeNumber(item.precio || item.valor || item.costo || item.valorPrestacion);
                const valorPagarCalculado = tipoLiquidacion === "fijo" 
                    ? pagoFijoValor 
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
                    valorPrestacion: itemValor,
                    valorRecaudado: itemValor,
                    tipoLiquidacion: tipoLiquidacion,
                    pagoFijoValor: pagoFijoValor,
                    porcentaje: currentDoctor.comisionPorcentaje,
                    costoLaboratorio: safeNumber(item.costoLaboratorio || item.costoLab || 0),
                    valorAPagar: valorPagarCalculado,
                    estadoPagoCliente: isPaid ? "Pagado" : "Pendiente de pago",
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
    const pagoId = `pago_liq_${Date.now()}`;

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
        concepto: `Liquidación de comisiones período ${liquidacion.fechaInicio} al ${liquidacion.fechaFin}`,
        monto: safeNumber(liquidacion.totalPagar),
        total: safeNumber(liquidacion.totalPagar),
        items: [{
            concepto: `Liquidación comisiones ${doctorName} (${liquidacion.fechaInicio} a ${liquidacion.fechaFin})`,
            cantidad: 1,
            precio: safeNumber(liquidacion.totalPagar),
            total: safeNumber(liquidacion.totalPagar)
        }],
        observaciones: `Generado automáticamente desde módulo de Liquidaciones. Liquidación ID: ${liquidacion.id}`,
        liquidacionId: liquidacion.id,
        created_at: nowIso,
        created_by: userProfile?.nombre || userProfile?.email || "Administración"
    };

    // Guardar en pagos_proveedor
    try {
        await supabase.from("pagos_proveedor").insert([pagoRecord]);
    } catch (_) {}

    try {
        const currPagos = await getConfigSection(tenantId, "pagos_proveedor", []);
        await saveConfigSection(tenantId, "pagos_proveedor", [
            pagoRecord,
            ...(Array.isArray(currPagos) ? currPagos : [])
        ]);
    } catch (e) {
        console.error("Error guardando pago en config:", e);
    }

    // 2. Actualizar estado de la liquidación a "Pagada"
    let currentLiqs = await getConfigSection(tenantId, "liquidaciones", []);
    currentLiqs = currentLiqs.map(l => {
        if (l.id === liquidacion.id) {
            return {
                ...l,
                estado: "Pagada",
                pagoProveedorId: pagoId,
                fechaPago: todayStr,
                medioPago: pagoRecord.medioPago,
                bancoCaja: pagoRecord.bancoCaja,
                pagadoPor: userProfile?.nombre || userProfile?.email || "Administración",
                updated_at: nowIso
            };
        }
        return l;
    });
    await saveConfigSection(tenantId, "liquidaciones", currentLiqs);

    try {
        await supabase.from("liquidaciones").update({ estado: "Pagada" }).eq("id", liquidacion.id);
    } catch (_) {}

    return pagoRecord;
};
