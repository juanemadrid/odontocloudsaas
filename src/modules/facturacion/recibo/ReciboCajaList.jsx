import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
    FiPlus, FiCalendar, FiSearch, FiPrinter, FiEdit2, FiTrash2, 
    FiEye, FiChevronDown, FiChevronRight, FiFileText, FiDollarSign, 
    FiCreditCard, FiX, FiCheck, FiDownload
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

import { printReciboCaja } from "../../../utils/electronicInvoiceTemplate";
import { getConfigSection, getConfigItems } from "../../../services/configPersistenceService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export default function ReciboCajaList({ onNew }) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [recibos, setRecibos] = useState([]);
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [plansMap, setPlansMap] = useState({});

    // Modal: Documentos Asociados (Doc. Ref.)
    const [associatedDocsModal, setAssociatedDocsModal] = useState({ open: false, recibo: null });

    // Modal: Ver motivo de anulación
    const [viewVoidModal, setViewVoidModal] = useState({ open: false, recibo: null });

    // Modal: Anular
    const [voidModal, setVoidModal] = useState({ open: false, recibo: null });
    const [voidReason, setVoidReason] = useState("");
    const [voidUser, setVoidUser] = useState("");

    // Filters (Inicialmente vacíos para mostrar todos los recibos y no filtrar automáticamente de entrada)
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (userProfile) {
            setVoidUser(userProfile.nombreCompleto || userProfile.nombre || userProfile.email || "");
        }
    }, [userProfile]);

    useEffect(() => {
        if (!inquilino) return;
        (async () => {
            try {
                const [tenantRes, empConfig] = await Promise.all([
                    supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
                    getConfigSection(inquilino, "empresa_datos", {})
                ]);
                const t = tenantRes?.data || {};
                setCompanyInfo({
                    nombreComercial: empConfig.nombreComercial || t.nombre || "Clínica Dental",
                    nit: empConfig.nit || t.nit || "",
                    direccion: empConfig.direccion || t.direccion || "",
                    ciudad: empConfig.ciudad || t.ciudad || "Sincelejo",
                    telefono: empConfig.telefono || t.telefono || "",
                    email: empConfig.email || t.email || "",
                    logoUrl: empConfig.logoUrl || t.logo_url || ""
                });
            } catch (e) {
                console.warn("Error loading company info for receipt print:", e);
            }
        })();
    }, [inquilino]);

    const toggleRow = (id) => {
        setExpandedRowId(prev => prev === id ? null : id);
    };

    // --- PRINT ENGINE (OralDrive Formato Exacto Recibo de Caja) ---
    const handlePrint = (recibo) => {
        const tenantData = companyInfo || {
            nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenantNombre || "Clínica Dental",
            nit: userProfile?.tenant?.nit || "",
            direccion: userProfile?.tenant?.direccion || "",
            ciudad: userProfile?.tenant?.ciudad || "Sincelejo",
            telefono: userProfile?.tenant?.telefono || "",
            email: userProfile?.tenant?.email || "",
            logoUrl: userProfile?.tenant?.logo_url || userProfile?.tenant?.logoUrl || ""
        };

        let conceptosList = [];
        if (Array.isArray(recibo.conceptos) && recibo.conceptos.length > 0) {
            conceptosList = recibo.conceptos;
        } else if (recibo.concepto) {
            conceptosList = [{
                concepto: recibo.concepto,
                precioUnitario: Number(recibo.total || 0),
                cantidad: 1,
                total: Number(recibo.total || 0)
            }];
        } else {
            conceptosList = [{
                concepto: "Abono a tratamiento",
                precioUnitario: Number(recibo.total || 0),
                cantidad: 1,
                total: Number(recibo.total || 0)
            }];
        }

        // Buscar plan de tratamiento real asociado
        const targetPlanId = recibo.planId || recibo._meta?.planId || recibo._raw?.planId;
        const matchedPlan = targetPlanId ? plansMap[targetPlanId] : null;

        let dynamicPlanTitle = recibo.planTitle || recibo._meta?.planTitle || matchedPlan?.nombre || matchedPlan?.title || "";
        let dynamicTotalPlan = matchedPlan ? Number(matchedPlan.total || matchedPlan.detalles?.total || 0) : Number(recibo.total || 0);

        // Sumar pagos que pertenecen a este mismo plan
        let dynamicTotalPagado = 0;
        if (targetPlanId) {
            recibos.forEach(r => {
                const rPlanId = r.planId || r._meta?.planId || r._raw?.planId;
                if (String(rPlanId) === String(targetPlanId) && !r.anulado && r.estado !== "Anulado") {
                    dynamicTotalPagado += Number(r.total || 0);
                }
            });
        }
        if (dynamicTotalPagado < Number(recibo.total || 0)) {
            dynamicTotalPagado = Number(recibo.total || 0);
        }
        let dynamicSaldo = Math.max(0, dynamicTotalPlan - dynamicTotalPagado);

        const profName = recibo.profesionalNombre || recibo._meta?.profesional || recibo.profesional || userProfile?.nombreCompleto || "Doctor";
        const consNum = recibo.consecutivoNumero || recibo.nroConsecutivo || recibo._meta?.nroConsecutivo || "1";

        printReciboCaja({
            recibo: {
                ...recibo,
                nroConsecutivo: consNum,
                fecha: recibo.rawDate || recibo.fecha || new Date(),
                pacienteNombre: recibo.pacienteNombre,
                pacienteDocumento: recibo.pacienteDocumento,
                pacienteDireccion: recibo.pacienteDireccion,
                pacienteCiudad: recibo.pacienteCiudad,
                profesionalNombre: profName,
                medioPago: recibo.medioPago || "Efectivo",
                conceptos: conceptosList,
                total: Number(recibo.total || 0),
                observaciones: recibo.observaciones || recibo.notas || "",
                estado: recibo.estado,
                anulado: recibo.anulado,
                motivoAnulacion: recibo.motivoAnulacion,
                anuladoPor: recibo.anuladoPor,
                fechaAnulacion: recibo.fechaAnulacion
            },
            patient: {
                nombreCompleto: recibo.pacienteNombre,
                documento: recibo.pacienteDocumento,
                direccion: recibo.pacienteDireccion,
                ciudad: recibo.pacienteCiudad,
                telefono: recibo.pacienteTelefono
            },
            tenant: tenantData,
            planInfo: dynamicPlanTitle ? {
                planTitle: dynamicPlanTitle,
                totalPlan: dynamicTotalPlan,
                totalPagado: dynamicTotalPagado,
                saldo: dynamicSaldo
            } : null
        });
    };

    // --- ANULACIÓN ---
    const handleOpenVoid = (recibo) => {
        setVoidReason("");
        setVoidModal({ open: true, recibo });
    };

    const [voiding, setVoiding] = useState(false);

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            alert("El motivo de la anulación es obligatorio");
            return;
        }
        setVoiding(true);
        try {
            const recibo = voidModal.recibo;
            const nowIso = new Date().toISOString();
            const operator = voidUser.trim() || userProfile?.nombreCompleto || userProfile?.email || "Administración";
            const reason = voidReason.trim();

            if (recibo.isPago) {
                // 1. CASO TABLA PAGOS
                let prevNotes = {};
                try {
                    if (typeof recibo._raw?.notas === "string" && recibo._raw.notas.startsWith("{")) {
                        prevNotes = JSON.parse(recibo._raw.notas);
                    } else if (typeof recibo._raw?.notas === "object") {
                        prevNotes = recibo._raw.notas || {};
                    }
                } catch (e) {}

                const updatedNotes = {
                    ...prevNotes,
                    anulado: true,
                    estado: "Anulado",
                    motivoAnulacion: reason,
                    anuladoPor: operator,
                    fechaAnulacion: nowIso
                };

                const voidTextNote = `ANULADO - ${reason} (${operator})`;

                // Intentar actualizar en pagos con estado, referencia y notas
                const fullPayload = {
                    estado: "Anulado",
                    referencia: "ANULADO",
                    notas: JSON.stringify(updatedNotes),
                    motivoAnulacion: reason,
                    anuladoPor: operator,
                    fechaAnulacion: nowIso
                };

                const { error: errPago } = await supabase
                    .from("pagos")
                    .update(fullPayload)
                    .eq("id", recibo.id);

                if (errPago) {
                    console.warn("Fallo update completo en pagos, intentando fallback seguro:", errPago);
                    await supabase
                        .from("pagos")
                        .update({
                            referencia: "ANULADO",
                            notas: JSON.stringify(updatedNotes)
                        })
                        .eq("id", recibo.id);
                }

                // Si fue un saldo a favor en pagos, sincronizar saldo del paciente
                const pId = recibo.paciente_id || recibo.pacienteId || recibo._raw?.paciente_id || recibo._raw?.pacienteId;
                if (pId) {
                    try {
                        const { data: pac } = await supabase
                            .from("pacientes")
                            .select("id, saldo_favor")
                            .eq("id", pId)
                            .single();
                        if (pac) {
                            const curSaldo = Number(pac.saldo_favor || 0);
                            const montoRecibo = Number(recibo.total || recibo.monto || 0);
                            const medioStr = String(recibo.medioPago || "").toLowerCase();
                            const concStr = String(recibo._raw?.concepto || recibo.concepto || "").toUpperCase();

                            if (concStr.includes("SALDO A FAVOR") || medioStr === "saldo a favor") {
                                const newSaldo = Math.max(0, curSaldo - montoRecibo);
                                await supabase.from("pacientes").update({ saldo_favor: newSaldo }).eq("id", pId);
                            }
                        }
                    } catch (e) {
                        console.warn("Aviso al sincronizar saldo paciente en anulación:", e);
                    }
                }

            } else {
                // 2. CASO TABLA RECIBOS_CAJA
                const voidTextObs = `[ANULADO: ${reason} por ${operator}] ${recibo.observaciones || ""}`.trim();
                const voidTextConc = `[ANULADO] ${recibo.concepto || ""}`.trim();

                const fullReciboPayload = {
                    estado: "Anulado",
                    motivoAnulacion: reason,
                    motivo_anulacion: reason,
                    anuladoPor: operator,
                    anulado_por: operator,
                    fechaAnulacion: nowIso,
                    fecha_anulacion: nowIso,
                    observaciones: voidTextObs,
                    concepto: voidTextConc
                };

                const { error: errRecibo } = await supabase
                    .from("recibos_caja")
                    .update(fullReciboPayload)
                    .eq("id", recibo.id);

                if (errRecibo) {
                    console.warn("Fallo update completo en recibos_caja, aplicando fallback resiliente:", errRecibo);
                    const { error: errFallback1 } = await supabase
                        .from("recibos_caja")
                        .update({
                            estado: "Anulado",
                            observaciones: voidTextObs
                        })
                        .eq("id", recibo.id);

                    if (errFallback1) {
                        await supabase
                            .from("recibos_caja")
                            .update({
                                observaciones: voidTextObs,
                                concepto: voidTextConc
                            })
                            .eq("id", recibo.id);
                    }
                }
            }

            // 3. SINCRONIZACIÓN CON CAJA Y MOVIMIENTOS DE CAJA
            try {
                const targetCajaId = recibo.caja_id || recibo.cajaId || recibo._raw?.caja_id || recibo._raw?.cajaId;
                const pId = recibo.paciente_id || recibo.pacienteId || recibo._raw?.paciente_id;
                const pNombre = recibo.pacienteNombre || "Paciente";
                const montoAnulado = Number(recibo.total || recibo.monto || 0);

                if (montoAnulado > 0) {
                    await supabase
                        .from("movimientos_caja")
                        .insert([{
                            tenant_id: inquilino,
                            caja_id: targetCajaId || null,
                            usuario_id: userProfile?.uid || userProfile?.id || null,
                            tipo: "egreso",
                            concepto: `[ANULACION RC] ${recibo.consecutivoNumero ? `RC-${String(recibo.consecutivoNumero).padStart(4, "0")}` : "Recibo"}`,
                            monto: montoAnulado,
                            metodo_pago: recibo.medioPago || "Efectivo",
                            descripcion: `Anulación de documento: ${reason} (Operador: ${operator})`,
                            paciente_id: pId || null,
                            paciente_nombre: pNombre,
                            recibo_id: recibo.isPago ? null : recibo.id,
                            created_at: nowIso
                        }]);

                    if (targetCajaId) {
                        const { data: curCaja } = await supabase
                            .from("cajas")
                            .select("id, saldo_actual, total_ingresos, total_egresos")
                            .eq("id", targetCajaId)
                            .single();

                        if (curCaja) {
                            const curSaldo = Number(curCaja.saldo_actual || 0);
                            const curEgresos = Number(curCaja.total_egresos || 0);
                            await supabase
                                .from("cajas")
                                .update({
                                    saldo_actual: Math.max(0, curSaldo - montoAnulado),
                                    total_egresos: curEgresos + montoAnulado
                                })
                                .eq("id", targetCajaId);
                        }
                    }
                }
            } catch (cajaErr) {
                console.warn("Aviso al sincronizar egreso en movimientos_caja/cajas:", cajaErr);
            }

            // 4. Actualizar inmediatamente en memoria para feedback visual instantáneo
            setRecibos(prev => prev.map(item => {
                if (item.id === recibo.id) {
                    return {
                        ...item,
                        estado: "Anulado",
                        anulado: true,
                        motivoAnulacion: reason,
                        anuladoPor: operator,
                        fechaAnulacion: nowIso
                    };
                }
                return item;
            }));

            toast && toast.success("Documento anulado y sincronizado correctamente");
            setVoidModal({ open: false, recibo: null });
            await loadData();
        } catch (e) {
            console.error("Error voiding receipt:", e);
            toast && toast.error("Error al anular el recibo");
        } finally {
            setVoiding(false);
        }
    };

    // --- CARGA DE DATOS ---
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [y, m, d] = parts.map(Number);
        return new Date(y, m - 1, d);
    };

    const loadData = useCallback(async (customFilter = {}) => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const fIni = customFilter.fechaInicio !== undefined ? customFilter.fechaInicio : fechaInicio;
            const fFin = customFilter.fechaFin !== undefined ? customFilter.fechaFin : fechaFin;

            let startTime = null;
            let endTime = null;
            if (fIni) {
                const start = parseLocalDate(fIni);
                if (start) {
                    start.setHours(0, 0, 0, 0);
                    startTime = start.getTime();
                }
            }
            if (fFin) {
                const end = parseLocalDate(fFin);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    endTime = end.getTime();
                }
            }

            // 1. Pacientes map
            let patientMap = {};
            try {
                const { data: pacsData } = await supabase
                    .from("pacientes")
                    .select("*")
                    .eq("tenant_id", inquilino);
                
                (pacsData || []).forEach(p => {
                    const full = `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.nombreCompleto || p.documento || "Paciente";
                    const ciudadVal = p.ciudadDomicilio || p.ciudad || p.municipio || p.lugarResidencia || p.ciudad_domicilio || companyInfo?.ciudad || "Sincelejo";
                    if (p.id) {
                        patientMap[p.id] = {
                            nombre: full,
                            documento: p.documento || p.nroDocumento || "",
                            telefono: p.telefono || p.celular || "",
                            direccion: p.direccion || p.direccionDomicilio || p.direccion_domicilio || "",
                            ciudad: ciudadVal
                        };
                    }
                });
            } catch (e) {
                console.warn("Could not fetch pacientes:", e);
            }

            // 1.5. Treatment Plans map
            let pMap = {};
            try {
                const { data: plansData } = await supabase
                    .from("treatment_plans")
                    .select("*")
                    .eq("tenant_id", inquilino);
                (plansData || []).forEach(pl => {
                    if (pl.id) pMap[pl.id] = pl;
                });
                setPlansMap(pMap);
            } catch (e) {
                console.warn("Could not fetch treatment plans:", e);
            }

            // 2. Recibos de caja
            let dataRecibos = [];
            try {
                const { data, error: errRecs } = await supabase
                    .from("recibos_caja")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (!errRecs && data && data.length > 0) dataRecibos = data;
            } catch (e) {}

            // Fallback resiliente a website_config para no perder ningún recibo
            try {
                const cfgRecibos = await getConfigSection(inquilino, "recibos_caja", []);
                if (Array.isArray(cfgRecibos) && cfgRecibos.length > 0) {
                    const existingIds = new Set(dataRecibos.map(r => r.id));
                    cfgRecibos.forEach(cr => {
                        if (cr && cr.id && !existingIds.has(cr.id)) {
                            dataRecibos.push(cr);
                        }
                    });
                }
            } catch (e) {}

            // 3. Pagos / Recaudos
            let dataPagosRaw = [];
            try {
                const { data } = await supabase
                    .from("pagos")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (data && data.length > 0) dataPagosRaw = data;
            } catch (e) {}

            // 4. Mapeo de Facturas Electrónicas vinculadas a recibos (P1-FEV1)
            let invoiceMap = {};
            try {
                const [factsRes, fevRes] = await Promise.all([
                    supabase.from("facturas").select("id, numero, detalles, recibo_id, factura_id").eq("tenant_id", inquilino),
                    supabase.from("facturas_electronicas").select("id, numero, detalles, recibo_id, prefix, number").eq("tenant_id", inquilino)
                ]);
                const allInvoices = [...(factsRes?.data || []), ...(fevRes?.data || [])];
                allInvoices.forEach((f) => {
                    let det = f.detalles;
                    if (typeof det === "string") {
                        try { det = JSON.parse(det); } catch {}
                    }
                    const numFact = f.numero || (f.prefix && f.number ? `${f.prefix}${f.number}` : null) || (f.id ? `FE-${f.id.slice(0, 6)}` : "");
                    const linked = Array.isArray(det?.recibos_asociados)
                        ? det.recibos_asociados
                        : det?.recibo_asociado
                        ? [det.recibo_asociado]
                        : [];
                    linked.forEach((lr) => {
                        const lrId = lr.id || lr.recibo_id;
                        if (lrId) {
                            invoiceMap[lrId] = numFact;
                        }
                    });
                    if (f.recibo_id) {
                        invoiceMap[f.recibo_id] = numFact;
                    }
                    if (f.id) {
                        invoiceMap[f.id] = numFact;
                    }
                });
            } catch (e) {
                console.warn("Error cargando mapeo de facturas:", e);
            }

            const isConsumoSaldo = (item, metadata = {}) => {
                const cond = (item.condicionPago || item.condicion || item.metodo_pago || item.metodo || item.medio || metadata.metodo || metadata.medio || "").toLowerCase();
                const conc = (item.concepto || item.referencia || item.notas || metadata.concepto || metadata.referencia || "").toLowerCase();
                return cond.includes("consumo") || 
                       cond === "saldo a favor" || 
                       cond.includes("saldo a favor") ||
                       conc.includes("uso saldo a favor") ||
                       conc.includes("consumo s. a favor") ||
                       conc.includes("consumo saldo a favor");
            };

            const mappedRecibos = (dataRecibos || [])
                .filter(d => !isConsumoSaldo(d))
                .map(d => {
                    const pId = d.paciente_id || d.pacienteId || d.patient_id || d.paciente;
                    const pacInfo = patientMap[pId] || {};
                    const pName = d.pacienteNombre || d.patientNombre || pacInfo.nombre || "—";
                    const obsStr = String(d.observaciones || "");
                    const concStr = String(d.concepto || "");
                    const isReciboAnulado = 
                        Boolean(d.estado && d.estado.toLowerCase() === "anulado") ||
                        Boolean(d.anulado) ||
                        obsStr.includes("[ANULADO") ||
                        concStr.includes("[ANULADO");

                    let motivoRecibo = d.motivoAnulacion || d.motivo_anulacion || "";
                    if (!motivoRecibo && obsStr.includes("[ANULADO:")) {
                        const mMatch = obsStr.match(/\[ANULADO:\s*([^\]]+)\]/i);
                        if (mMatch) motivoRecibo = mMatch[1].replace(/por\s+.*$/i, "").trim();
                    }

                    return { 
                        ...d, 
                        pacienteNombre: pName,
                        pacienteDocumento: d.pacienteDocumento || pacInfo.documento || "",
                        pacienteTelefono: d.pacienteTelefono || pacInfo.telefono || "",
                        pacienteDireccion: d.pacienteDireccion || pacInfo.direccion || "",
                        pacienteCiudad: d.pacienteCiudad || pacInfo.ciudad || companyInfo?.ciudad || "Sincelejo",
                        tipoDoc: d.tipoDoc || "Recibo de caja",
                        profesionalNombre: d.profesionalNombre || d.doctorNombre || d.doctor || userProfile?.nombreCompleto || "Doctor",
                        medioPago: d.medioPago || d.condicionPago || d.medio || "Efectivo",
                        referencia: d.referencia || d.comprobante || "",
                        venceEn: 0,
                        isPago: false,
                        nroConsecutivo: d.nroConsecutivo || d.nro_consecutivo || d.numero || null,
                        estado: isReciboAnulado ? "Anulado" : (d.estado || "Activo"),
                        anulado: isReciboAnulado,
                        motivoAnulacion: motivoRecibo,
                        anuladoPor: d.anuladoPor || d.anulado_por || "",
                        fechaAnulacion: d.fechaAnulacion || d.fecha_anulacion || "",
                        fevNumero: invoiceMap[d.id] || d.factura_id || null,
                        rawDate: d.fecha || d.created_at
                    };
                });

            const mappedPagos = (dataPagosRaw || [])
                .map(pData => {
                    let metadata = {};
                    if (pData.notas && typeof pData.notas === "string" && pData.notas.trim().startsWith("{")) {
                        try { metadata = JSON.parse(pData.notas); } catch (e) {}
                    } else if (pData.notas && typeof pData.notas === "object") {
                        metadata = pData.notas;
                    }

                    const notesStr = typeof pData.notas === "string" ? pData.notas : JSON.stringify(pData.notas || "");
                    const refStr = String(pData.referencia || "").toUpperCase();
                    
                    const isPagoAnulado = 
                        Boolean(pData.estado && pData.estado.toLowerCase() === "anulado") ||
                        Boolean(metadata.anulado) ||
                        Boolean(metadata.estado && metadata.estado.toLowerCase() === "anulado") ||
                        refStr.includes("ANULADO") ||
                        notesStr.includes("ANULADO");

                    let motivoPago = pData.motivoAnulacion || metadata.motivoAnulacion || "";
                    if (!motivoPago && notesStr.includes("ANULADO")) {
                        const mMatch = notesStr.match(/ANULADO\s*-\s*([^()]+)/i);
                        if (mMatch) motivoPago = mMatch[1].trim();
                    }

                    const pId = pData.paciente_id || pData.pacienteId || metadata.paciente_id || pData.paciente;
                    const pacInfo = patientMap[pId] || {};
                    const pName = pData.patientNombre || pData.pacienteNombre || metadata.patientNombre || pacInfo.nombre || "Paciente";
                    const medioRaw = pData.metodo || pData.medio || metadata.metodo || metadata.medio || "Efectivo";

                    // Extraer conceptos reales de los procedimientos cancelados
                    let pagoConceptos = [];
                    if (Array.isArray(metadata.itemPayments) && metadata.itemPayments.length > 0) {
                        pagoConceptos = metadata.itemPayments.map(it => ({
                            concepto: it.desc || it.concepto || metadata.concepto || "Procedimiento Odontológico",
                            precioUnitario: Number(it.monto || 0),
                            cantidad: 1,
                            total: Number(it.monto || 0)
                        }));
                    } else if (metadata.concepto || pData.concepto) {
                        pagoConceptos = [{
                            concepto: metadata.concepto || pData.concepto || "Abono a tratamiento",
                            precioUnitario: Number(pData.monto || 0),
                            cantidad: 1,
                            total: Number(pData.monto || 0)
                        }];
                    }

                    const targetPlanId = metadata.planId || pData.planId;
                    const targetPlan = targetPlanId ? pMap[targetPlanId] : null;
                    const dynamicPlanTitle = metadata.planTitle || pData.planTitle || targetPlan?.nombre || targetPlan?.title || "";

                    const effectiveProf = metadata.profesional || pData.profesional || metadata.doctor || pData.doctor || userProfile?.nombreCompleto || "Doctor";

                    return {
                        id: pData.id,
                        fecha: pData.fechaISO || pData.created_at || pData.fecha,
                        rawDate: pData.fechaISO || pData.created_at || pData.fecha,
                        pacienteNombre: pName,
                        pacienteDocumento: pacInfo.documento || "",
                        pacienteTelefono: pacInfo.telefono || "",
                        pacienteDireccion: pacInfo.direccion || "",
                        pacienteCiudad: metadata.pacienteCiudad || pacInfo.ciudad || companyInfo?.ciudad || "Sincelejo",
                        tipoDoc: metadata.tipoDoc || "Recibo de caja",
                        profesionalNombre: effectiveProf,
                        medioPago: medioRaw,
                        referencia: metadata.referencia || pData.referencia || "",
                        venceEn: 0,
                        total: Number(pData.monto || 0),
                        concepto: metadata.concepto || pData.concepto || (pagoConceptos[0]?.concepto) || "Abono a tratamiento",
                        conceptos: pagoConceptos,
                        planId: targetPlanId,
                        planTitle: dynamicPlanTitle,
                        observaciones: metadata.observaciones || pData.observaciones || "",
                        estado: isPagoAnulado ? "Anulado" : (pData.estado || "Activo"),
                        anulado: isPagoAnulado,
                        motivoAnulacion: motivoPago,
                        anuladoPor: pData.anuladoPor || metadata.anuladoPor || "",
                        fechaAnulacion: pData.fechaAnulacion || metadata.fechaAnulacion || "",
                        nroConsecutivo: metadata.nroConsecutivo || pData.nroConsecutivo || pData.nro_consecutivo || "",
                        isPago: true,
                        fevNumero: invoiceMap[pData.id] || (pData.factura_id ? invoiceMap[pData.factura_id] || pData.factura_id : null),
                        _raw: pData,
                        _meta: metadata
                    };
                })
                .filter(p => !isConsumoSaldo(p._raw, p._meta));

            // Evitar duplicados entre la tabla recibos_caja y la tabla pagos
            const existingReceiptIds = new Set(
                mappedRecibos.map(r => String(r.id || "")).filter(Boolean)
            );
            const existingReceiptNumbers = new Set(
                mappedRecibos.map(r => String(r.nroConsecutivo || r.numero || r.nro_consecutivo || "")).filter(Boolean)
            );

            const uniquePagos = mappedPagos.filter(p => {
                const pId = String(p.id || "");
                const pNum = String(p.nroConsecutivo || p._raw?.nro_consecutivo || p._meta?.nroConsecutivo || "");
                if (pId && existingReceiptIds.has(pId)) return false;
                if (pNum && existingReceiptNumbers.has(pNum)) return false;
                return true;
            });

            // Combinar registros únicos y filtrar por rango de fechas
            let combined = [...mappedRecibos, ...uniquePagos];

            combined = combined.filter(r => {
                if (!startTime && !endTime) return true;
                if (!r.rawDate) return true;
                const rTime = new Date(r.rawDate).getTime();
                if (isNaN(rTime)) return true;
                if (startTime && rTime < startTime) return false;
                if (endTime && rTime > endTime) return false;
                return true;
            });

            // Respetar estrictamente el número de documento asignado en base de datos (INMUTABLE - Nunca alterar números existentes)
            const withConsecutivos = combined.map((item) => {
                const rawC = item.nroConsecutivo || item._meta?.nroConsecutivo || item.consecutivo || item.numero || item.nro_consecutivo;
                const n = (!isNaN(Number(rawC)) && Number(rawC) > 0) ? Number(rawC) : (rawC || "—");

                return {
                    ...item,
                    nroConsecutivo: n,
                    consecutivoNumero: n,
                    docRefNumber: item.fevNumero || invoiceMap[item.id] || null
                };
            });

            // Ordenar de mayor a menor (consecutivo más alto arriba, más bajo abajo)
            withConsecutivos.sort((a, b) => {
                const numA = Number(a.consecutivoNumero || a.nroConsecutivo || 0);
                const numB = Number(b.consecutivoNumero || b.nroConsecutivo || 0);
                if (numB !== numA) return numB - numA;
                return new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime();
            });
            setRecibos(withConsecutivos);
            setHasSearched(true);
        } catch (e) {
            console.error("Error cargando recibos:", e);
        } finally {
            setLoading(false);
        }
    }, [inquilino, fechaInicio, fechaFin, userProfile, companyInfo]);

    // Carga inicial automática de recibos para el período actual
    useEffect(() => {
        if (inquilino) {
            loadData();
        }
    }, [inquilino, loadData]);

    const filteredRecibos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return recibos;
        return recibos.filter(r => 
            String(r.consecutivoNumero).includes(term) ||
            (r.pacienteNombre || "").toLowerCase().includes(term) ||
            (r.profesionalNombre || "").toLowerCase().includes(term) ||
            (r.medioPago || "").toLowerCase().includes(term) ||
            (r.referencia || "").toLowerCase().includes(term) ||
            (r.docRefNumber || "").toLowerCase().includes(term)
        );
    }, [recibos, searchTerm]);

    const handleCreateNew = onNew || (() => navigate("nuevo"));

    return (
        <div className="p-4 md:p-6 max-w-[1700px] mx-auto space-y-4 animate-fadeIn">

            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <h1 className="text-[15px] font-bold text-slate-800">Recibo de caja</h1>
                    <span className="text-slate-400 cursor-help" title="Módulo de Recibos de Caja">
                        ⓘ
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium ml-2">
                        Facturación - Recibo de caja
                    </span>
                </div>
            </div>

            {/* Date Range Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
                            />
                            <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500"
                            />
                            <FiCalendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadData()}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-1.5 rounded-lg font-bold text-[12px] transition-all cursor-pointer border-0 shadow-sm"
                    >
                        Buscar
                    </button>
                    {(fechaInicio || fechaFin) && (
                        <button
                            type="button"
                            onClick={() => {
                                setFechaInicio("");
                                setFechaFin("");
                                loadData({ fechaInicio: "", fechaFin: "" });
                            }}
                            className="text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg font-medium text-[12px] transition-all cursor-pointer border border-slate-200 hover:bg-slate-50"
                        >
                            Ver todos
                        </button>
                    )}
                </div>
            </div>

            {/* SUB-BAR / ACTIONS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <button 
                    onClick={() => toast && toast.info("Función de generar factura a partir del recibo seleccionada.")}
                    className="px-4 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg font-bold text-[12px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border-0"
                >
                    <FiPlus size={15} /> + Generar factura
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Export icons */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                        <button 
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" 
                            title="Exportar a Excel"
                            onClick={() => toast && toast.success("Exportando listado de recibos...")}
                        >
                            <FiFileText size={16} />
                        </button>
                    </div>

                    {/* Global Search Bar */}
                    <div className="relative flex-1 sm:w-72">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Drag helper bar (OralDrive style) */}
            <div className="text-[11px] text-slate-400 font-medium italic pl-1">
                Arrastra una columna aquí para agrupar por ella
            </div>

            {/* MAIN TABLE CONTAINER (OralDrive Style) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        {/* Table Header */}
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                                <th className="py-2.5 px-3 w-10 text-center text-slate-400"></th>
                                <th className="py-2.5 px-3 w-20">Doc.</th>
                                <th className="py-2.5 px-3 w-24 text-center">Doc. Ref.</th>
                                <th className="py-2.5 px-4">Paciente / Tercero</th>
                                <th className="py-2.5 px-4">Profesional</th>
                                <th className="py-2.5 px-4">Medio de pago</th>
                                <th className="py-2.5 px-3">Referencia</th>
                                <th className="py-2.5 px-3 w-24 text-center">Vence en</th>
                                <th className="py-2.5 px-4 text-right w-28">Valor</th>
                                <th className="py-2.5 px-3 w-28 text-center">Acciones</th>
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="py-14 text-center text-slate-400 font-medium">
                                        <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                        Cargando recibos de caja...
                                    </td>
                                </tr>
                            ) : !hasSearched ? (
                                <tr>
                                    <td colSpan="10" className="py-16 text-center text-slate-400 font-medium">
                                        <FiCalendar size={32} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-[13px] font-bold text-slate-700">Selecciona el rango de fechas y haz clic en "Buscar"</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Los recibos de caja se consultarán únicamente para el período especificado.</p>
                                    </td>
                                </tr>
                            ) : filteredRecibos.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400 font-medium italic">
                                        No se encontraron registros de recibos de caja en este rango de fechas.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecibos.map((r) => {
                                    const isAnulado = String(r.estado || "").toLowerCase() === "anulado" || Boolean(r.anulado);
                                    const isExpanded = expandedRowId === r.id;

                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr 
                                                onClick={() => toggleRow(r.id)}
                                                className={`transition-colors cursor-pointer ${
                                                    isExpanded 
                                                        ? 'bg-blue-50/40' 
                                                        : isAnulado 
                                                            ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-500' 
                                                            : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                {/* Expander Icon */}
                                                <td className="py-3 px-3 text-center text-slate-400">
                                                    {isExpanded ? <FiChevronDown size={14} className="text-blue-600" /> : <FiChevronRight size={14} />}
                                                </td>

                                                {/* Doc. (Consecutivo) */}
                                                <td className={`py-3 px-3 font-semibold font-mono ${isAnulado ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{r.consecutivoNumero}</span>
                                                        {isAnulado && (
                                                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold bg-rose-100 text-rose-700 rounded-md border border-rose-300">
                                                                ANULADO
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Doc. Ref. (Blue Eye Button only if real linked invoice exists) */}
                                                <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                    {r.docRefNumber ? (
                                                        <button 
                                                            onClick={() => setAssociatedDocsModal({ open: true, recibo: r })}
                                                            className="w-7 h-6 bg-sky-500 hover:bg-sky-600 text-white rounded flex items-center justify-center mx-auto transition-colors shadow-xs cursor-pointer border-0"
                                                            title={`Ver factura asociada (${r.docRefNumber})`}
                                                        >
                                                            <FiEye size={13} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300 font-semibold select-none">—</span>
                                                    )}
                                                </td>

                                                {/* Pac./Ter. */}
                                                <td className={`py-3 px-4 font-semibold uppercase ${isAnulado ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                                                    {r.pacienteNombre}
                                                </td>

                                                {/* Profesional */}
                                                <td className={`py-3 px-4 font-medium ${isAnulado ? 'text-rose-500 opacity-80' : 'text-slate-600'}`}>
                                                    {r.profesionalNombre}
                                                </td>

                                                {/* Medio de pago */}
                                                <td className={`py-3 px-4 font-medium ${isAnulado ? 'text-rose-500 opacity-80' : 'text-slate-600'}`}>
                                                    {r.medioPago}
                                                </td>

                                                {/* Referencia */}
                                                <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                                                    {r.referencia || "—"}
                                                </td>

                                                {/* Vence en */}
                                                <td className="py-3 px-3 text-center text-slate-600 font-semibold font-mono">
                                                    {r.venceEn || 0}
                                                </td>

                                                {/* T. Doc. */}
                                                <td className={`py-3 px-4 text-right font-bold font-mono ${isAnulado ? 'text-rose-600 line-through opacity-75' : 'text-slate-800'}`}>
                                                    {fmt(r.total)}
                                                </td>

                                                {/* Acciones directas (Imprimir y Anular) */}
                                                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrint(r)}
                                                            className="w-7 h-7 rounded bg-slate-50 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-0"
                                                            title="Imprimir Recibo de Caja"
                                                        >
                                                            <FiPrinter size={13} />
                                                        </button>
                                                        {isAnulado ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewVoidModal({ open: true, recibo: r })}
                                                                className="w-7 h-7 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer border-0"
                                                                title="Ver motivo de anulación"
                                                            >
                                                                <FiEye size={13} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenVoid(r)}
                                                                className="w-7 h-7 rounded bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer border-0"
                                                                title="Anular Recibo"
                                                            >
                                                                <FiTrash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* EXPANDED ROW ACTIONS (OralDrive Style) */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/90 border-b border-slate-200/80 animate-fadeIn">
                                                    <td colSpan="10" className="py-4 px-8">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="space-y-1 text-xs">
                                                                <div>
                                                                    <span className="font-bold text-slate-500">Pendiente: </span>
                                                                    <span className="font-mono font-bold text-slate-700">$0</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-slate-500">Estado: </span>
                                                                    <span className={`font-bold ${isAnulado ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                        {isAnulado ? "Anulado" : "Activo"}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-slate-500">Factura Electrónica: </span>
                                                                    {r.fevNumero ? (
                                                                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                                            FEV: {r.fevNumero}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400 italic">Sin FEV vinculada</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Action buttons (Imprimir, Anular) */}
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-500 mr-1">Acciones:</span>

                                                                {/* Imprimir */}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePrint(r);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer border-0"
                                                                    title="Imprimir documento"
                                                                >
                                                                    <FiPrinter size={13} />
                                                                    <span>Imprimir</span>
                                                                </button>

                                                                {/* Anular / Ver Anulación */}
                                                                {isAnulado ? (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewVoidModal({ open: true, recibo: r });
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer border-0"
                                                                        title="Ver motivo de anulación"
                                                                    >
                                                                        <FiEye size={13} />
                                                                        <span>Ver Anulación</span>
                                                                    </button>
                                                                ) : (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenVoid(r);
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
                                                                        title="Anular recibo"
                                                                    >
                                                                        <FiTrash2 size={13} />
                                                                        <span>Anular</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL: DOCUMENTOS ASOCIADOS (Doc. Ref.)                                    */}
            {/* ========================================================================= */}
            {associatedDocsModal.open && associatedDocsModal.recibo && (
                <div 
                    className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setAssociatedDocsModal({ open: false, recibo: null })}
                >
                    <div 
                        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-zoomIn"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                Documentos asociados
                            </h3>
                            <button 
                                onClick={() => setAssociatedDocsModal({ open: false, recibo: null })}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Body / Table */}
                        <div className="p-6">
                            {associatedDocsModal.recibo?.docRefNumber ? (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                                            <tr>
                                                <th className="py-2.5 px-4">Número documento</th>
                                                <th className="py-2.5 px-4">Tipo documento</th>
                                                <th className="py-2.5 px-4">Valor</th>
                                                <th className="py-2.5 px-4 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                            <tr>
                                                <td className="py-3 px-4 font-bold font-mono text-slate-800">
                                                    {associatedDocsModal.recibo.docRefNumber}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-600">
                                                    Factura de venta
                                                </td>
                                                <td className="py-3 px-4 font-bold font-mono text-slate-800">
                                                    {fmt(associatedDocsModal.recibo.total)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        onClick={() => handlePrint(associatedDocsModal.recibo)}
                                                        className="w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded flex items-center justify-center mx-auto transition-colors shadow-xs cursor-pointer border-0"
                                                        title="Imprimir documento asociado"
                                                    >
                                                        <FiPrinter size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-8 px-4 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                        <FiFileText size={22} />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">Sin factura de venta asociada</h4>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                        Los recibos de caja son independientes de las facturas de venta. Este recibo no tiene ninguna factura vinculada automáticamente.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <button 
                                onClick={() => setAssociatedDocsModal({ open: false, recibo: null })}
                                className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: ANULACIÓN                                                          */}
            {/* ========================================================================= */}
            {voidModal.open && (
                <div 
                    className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setVoidModal({ open: false, recibo: null })}
                >
                    <div 
                        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-zoomIn"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                Anulación de Documento #{voidModal.recibo?.consecutivoNumero}
                            </h3>
                            <button 
                                onClick={() => setVoidModal({ open: false, recibo: null })}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Operador / Usuario</label>
                                <input 
                                    readOnly
                                    disabled
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                    value={voidUser || userProfile?.nombreCompleto || "Administración"}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Motivo de anulación <span className="text-rose-500">*</span>
                                </label>
                                <textarea 
                                    rows={3}
                                    required
                                    value={voidReason}
                                    onChange={e => setVoidReason(e.target.value)}
                                    placeholder="Ingresa la justificación obligatoria para anular este documento..."
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all resize-none shadow-xs"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                            <button 
                                type="button"
                                disabled={voiding}
                                onClick={() => setVoidModal({ open: false, recibo: null })}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                disabled={voiding}
                                onClick={handleConfirmVoid}
                                className="relative overflow-hidden px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer disabled:opacity-60"
                            >
                                {voiding ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                                        Anulando documento...
                                    </span>
                                ) : (
                                    "Confirmar Anulación"
                                )}
                                {voiding && <span className="animate-saving-bar" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: VER MOTIVO DE ANULACIÓN                                            */}
            {/* ========================================================================= */}
            {viewVoidModal.open && viewVoidModal.recibo && (
                <div 
                    className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setViewVoidModal({ open: false, recibo: null })}
                >
                    <div 
                        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-rose-100 animate-zoomIn"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-rose-600 font-bold text-sm">🚫 Documento Anulado</span>
                                <span className="text-xs font-mono font-bold text-rose-500">#{viewVoidModal.recibo.consecutivoNumero}</span>
                            </div>
                            <button 
                                onClick={() => setViewVoidModal({ open: false, recibo: null })}
                                className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <FiX size={15} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Paciente</span>
                                <span className="text-xs font-bold text-slate-800 uppercase">{viewVoidModal.recibo.pacienteNombre}</span>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Motivo de Anulación</span>
                                <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-3 text-xs font-medium text-rose-800">
                                    {viewVoidModal.recibo.motivoAnulacion || "Sin justificación registrada"}
                                </div>
                            </div>

                            {viewVoidModal.recibo.anuladoPor && (
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Anulado Por</span>
                                    <span className="text-xs font-semibold text-slate-700">{viewVoidModal.recibo.anuladoPor}</span>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <button 
                                onClick={() => setViewVoidModal({ open: false, recibo: null })}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
