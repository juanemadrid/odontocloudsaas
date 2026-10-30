import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
    FiPlus, FiCalendar, FiSearch, FiPrinter, FiEdit2, FiTrash2, 
    FiEye, FiChevronDown, FiChevronRight, FiFileText, FiDollarSign, 
    FiCreditCard, FiX, FiCheck, FiDownload, FiLock
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

import { printReciboCaja, printElectronicInvoice } from "../../../utils/electronicInvoiceTemplate";
import { getReceiptPlanFinancials } from "../../../services/billingService";
import { getConfigSection, getConfigItems } from "../../../services/configPersistenceService";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { consumeNextConsecutivo, CONSECUTIVO_TYPES } from "../../../services/consecutivosService";
import FacturaElectronicaForm from "../electronica/FacturaElectronicaForm";
import { getFactusCredentialsForTenant } from "../../../services/factusAdminService";
import { createReceiptInvoiceDraft } from "../../../services/receiptInvoiceDraftService";
import { receiptConceptAmounts } from "../../../services/receiptInvoiceItems.js";
import { queryOptionalBillingTable } from "../../../services/optionalBillingTables.js";

const fmt = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  if (typeof ts === 'string') {
    const match = ts.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && (!ts.includes('T') || ts.includes('T00:00:00') || ts.includes('T05:00:00'))) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
  }
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
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

    // Selección de recibos para Generar Factura
    const [selectedReciboIds, setSelectedReciboIds] = useState(new Set());
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [invoiceToReview, setInvoiceToReview] = useState(null);
    const [generatedInvoiceModal, setGeneratedInvoiceModal] = useState({
        open: false,
        factura: null,
        patientData: null,
        rcNumerosText: ""
    });

    // Paginación (10 registros por página según requerimiento)
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const handleToggleSelectRow = (id) => {
        setSelectedReciboIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Número de la factura a la que ya está ligado el recibo (o vacío si está libre para facturar).
    const receiptInvoiceNumber = (r) => {
        const invoice = r?.associatedDoc?.rawFactura;
        // Un borrador cuya emisión falló y se canceló libera sus recibos.
        if (invoice && String(invoice.estado || "").toLowerCase() === "cancelado") return "";
        return String(r?.fevNumero?.numero || r?.docRefNumber || r?.associatedDoc?.numero || (typeof r?.fevNumero === "string" ? r.fevNumero : "") || "").trim();
    };

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));

    const handleGenerateInvoiceClick = async () => {
        if (selectedReciboIds.size === 0) {
            toast && toast.warning("Debes marcar con la casilla (✓) al menos un recibo de caja de la lista para generarle la factura de venta.");
            return;
        }

        const selectedList = recibos.filter(r => selectedReciboIds.has(r.id));
        if (selectedList.length === 0) return;

        // 1. Validar si alguno de los recibos ya tiene factura asociada
        const alreadyInvoiced = selectedList.find(r => r.fevNumero || r.docRefNumber || r.associatedDoc?.numero);
        if (alreadyInvoiced) {
            const invoiceNum = alreadyInvoiced.fevNumero || alreadyInvoiced.docRefNumber || alreadyInvoiced.associatedDoc?.numero;
            toast && toast.warning(`El recibo #${alreadyInvoiced.consecutivoNumero} ya tiene la factura ${invoiceNum} vinculada. Desmárcalo para continuar.`);
            return;
        }

        // 2. Validar que todos los recibos seleccionados pertenezcan al mismo paciente
        const firstDoc = (selectedList[0].pacienteDocumento || "").trim();
        const firstName = (selectedList[0].pacienteNombre || "").trim().toLowerCase();

        const hasDifferentPatient = selectedList.some(r => {
            const doc = (r.pacienteDocumento || "").trim();
            const name = (r.pacienteNombre || "").trim().toLowerCase();
            if (firstDoc && doc) return doc !== firstDoc;
            return name !== firstName;
        });

        if (hasDifferentPatient) {
            toast && toast.error("Todos los recibos seleccionados deben pertenecer al mismo paciente para unificarse en una sola factura de venta.");
            return;
        }

        setIsGeneratingInvoice(true);
        try {
            const first = selectedList[0];
            // An outage must not be mistaken for a clinic without Factus.
            const tenantCreds = await getFactusCredentialsForTenant(inquilino, { throwOnError: true });
            const hasCredentials = Boolean(tenantCreds?.serverManaged);
            const referenceCode = `OC-${crypto.randomUUID()}`;

            // 3. Obtener datos completos del paciente / tercero
            let patientData = {
                id: first.pacienteId || first.paciente_id || first._raw?.paciente_id,
                nombre: first.pacienteNombre || "Paciente",
                documento: first.pacienteDocumento || "",
                tipoDocumento: first.pacienteTipoDocumento || "CC",
                direccion: first.pacienteDireccion || "Dirección no registrada",
                telefono: first.pacienteTelefono || "",
                ciudad: first.pacienteCiudad || companyInfo?.ciudad || "Sincelejo",
                email: ""
            };

            if (patientData.id && isUUID(patientData.id)) {
                try {
                    const { data: pDb } = await supabase.from("pacientes").select("*").eq("id", patientData.id).maybeSingle();
                    if (pDb) {
                        const full = `${pDb.nombres || pDb.nombre || ""} ${pDb.apellidos || pDb.apellido || ""}`.trim();
                        if (full) patientData.nombre = full;
                        patientData.documento = pDb.documento || pDb.nroDocumento || patientData.documento;
                        patientData.tipoDocumento = pDb.tipoDocumento || pDb.tipo_documento || patientData.tipoDocumento;
                        patientData.direccion = pDb.direccion || pDb.direccionDomicilio || patientData.direccion;
                        patientData.telefono = pDb.telefono || pDb.celular || patientData.telefono;
                        patientData.ciudad = pDb.ciudad || pDb.ciudadDomicilio || patientData.ciudad;
                        patientData.email = pDb.email || pDb.correo || "";
                    }
                } catch (pErr) {
                    console.warn("Aviso al consultar detalles del paciente:", pErr);
                }
            }

            // 4. Mapear conceptos e ítems del o los recibos seleccionados
            const invoiceItems = selectedList.flatMap((r, rIdx) => {
                if (Array.isArray(r.conceptos) && r.conceptos.length > 0) {
                    return r.conceptos.map((c, cIdx) => ({
                        id: `rc_${r.id}_${cIdx}`,
                        code: c.code || `SERV-${String(cIdx + 1).padStart(4, "0")}`,
                        nombre: c.concepto || c.nombre || `Recibo #${r.consecutivoNumero}`,
                        concepto: c.concepto || c.nombre || `Recibo #${r.consecutivoNumero}`,
                        descripcion: c.descripcion || c.concepto || `RC #${r.consecutivoNumero} - ${r.pacienteNombre}`,
                        ...receiptConceptAmounts(c, r)
                    }));
                }
                const conceptoDesc = r.concepto || r.observaciones || `Recibo de caja #${r.consecutivoNumero}`;
                return [{
                    id: `rc_${r.id}_${rIdx}`,
                    code: `SERV-${String(rIdx + 1).padStart(4, "0")}`,
                    nombre: conceptoDesc,
                    concepto: conceptoDesc,
                    descripcion: `Abono según RC #${r.consecutivoNumero} - ${r.pacienteNombre}`,
                    precioUnitario: Number(r.total || 0),
                    cantidad: 1,
                    descuento: 0,
                    total: Number(r.total || 0)
                }];
            });

            const totalMonto = invoiceItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
            const subtotalMonto = invoiceItems.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
            const descuentoMonto = invoiceItems.reduce((acc, it) => acc + it.descuento, 0);
            const totalRecibos = selectedList.reduce((acc, r) => acc + Number(r.total || 0), 0);
            if (!Number.isFinite(totalMonto) || totalMonto <= 0 || Math.abs(totalMonto - totalRecibos) > 0.01) {
                throw new Error("Los conceptos no coinciden con el importe de los recibos. Revise los valores antes de facturar.");
            }
            const rcNumerosList = selectedList.map(r => r.consecutivoNumero);
            const rcNumerosText = rcNumerosList.map(n => `#${n}`).join(", ");

            // 5. Determinar y asignar consecutivo oficial para Facturas de Venta
            let consList = [];
            try {
                consList = await getConfigItems(inquilino, "consecutivos", "consecutivos");
            } catch (errC) {
                console.warn("Aviso al leer consecutivos:", errC);
            }
            const activeCons = (Array.isArray(consList) && consList.find(c => c.activo !== false)) || (Array.isArray(consList) ? consList[0] : null) || {};
            const prefix = activeCons.fvPrefijo || activeCons.fePrefijoFactura || "FCEV";

            let maxExisting = 0;
            try {
                const { data: factList } = await supabase
                    .from("facturas")
                    .select("numero")
                    .eq("tenant_id", inquilino);
                (factList || []).forEach(f => {
                    const numPart = parseInt(String(f.numero || "").replace(/\D/g, ""), 10);
                    if (!isNaN(numPart) && numPart > maxExisting && numPart < 1000000) {
                        maxExisting = numPart;
                    }
                });
            } catch (e) {
                console.warn("Aviso al consultar facturas existentes:", e);
            }

            let nextVal = hasCredentials ? null : await consumeNextConsecutivo(inquilino, CONSECUTIVO_TYPES.FACTURA_VENTA);
            if (!hasCredentials && maxExisting >= nextVal) {
                nextVal = maxExisting + 1;
                try {
                    const { saveConfigItem } = await import("../../../services/configPersistenceService");
                    await saveConfigItem(inquilino, "consecutivos", "consecutivos", {
                        ...activeCons,
                        fvNumActual: nextVal
                    });
                } catch {}
            }
            const finalInvoiceNumber = hasCredentials ? `BORRADOR-${referenceCode}` : `${prefix ? prefix + "-" : ""}${nextVal}`;

            // 7. Estructurar payload y guardar en la tabla "facturas"
            const dbDetalles = {
                items: invoiceItems,
                subtotal: subtotalMonto,
                descuento: descuentoMonto,
                total: totalMonto,
                totalNeto: totalMonto,
                medioPago: first.medioPago || "Efectivo",
                medio_pago: first.medioPago || "Efectivo",
                condicionPago: "1",
                condicionPagoNombre: "Contado",
                observaciones: `Factura generada automáticamente a partir del recibo de caja ${rcNumerosText}`,
                profesional: first.profesionalNombre || "Sin asignar",
                profesional_nombre: first.profesionalNombre || "Sin asignar",
                fecha: new Date().toISOString().split("T")[0],
                pacienteNombre: patientData.nombre,
                pacienteDocumento: patientData.documento,
                pacienteTipoDocumento: patientData.tipoDocumento,
                pacienteDireccion: patientData.direccion,
                pacienteCiudad: patientData.ciudad,
                pacienteTelefono: patientData.telefono,
                pacienteEmail: patientData.email,
                recibos_asociados: selectedList.map(r => ({
                    id: r.id,
                    recibo_id: r.id,
                    numero: r.consecutivoNumero,
                    monto: Number(r.total || 0),
                    fecha: r.rawDate || r.fecha,
                    metodo: r.medioPago || "Efectivo",
                    tabla_origen: r.isPago ? "pagos" : "recibos_caja"
                })),
                recibo_asociado: {
                    id: first.id,
                    recibo_id: first.id,
                    numero: first.consecutivoNumero,
                    monto: Number(first.total || 0),
                    fecha: first.rawDate || first.fecha,
                    metodo: first.medioPago || "Efectivo",
                    tabla_origen: first.isPago ? "pagos" : "recibos_caja"
                },
                monto_pagado: totalMonto,
                saldo_pendiente: 0,
                estado_pago: "PAGADO",
                cufe: null,
                qrCode: null,
                factusReferenceCode: referenceCode,
                factusInvoiceNumber: null,
                dianStatus: hasCredentials ? "BORRADOR" : "NO_CONFIGURADA",
                technicalError: false,
                lastError: null,
                usuario_id: isUUID(userProfile?.id) ? userProfile.id : null,
                creado_por: userProfile?.nombreCompleto || userProfile?.email || "Administración"
            };

            const dbFactura = {
                tenant_id: inquilino,
                paciente_id: (patientData.id && isUUID(patientData.id)) ? patientData.id : null,
                numero: finalInvoiceNumber,
                subtotal: subtotalMonto,
                impuestos: 0,
                total: totalMonto,
                estado: "Pendiente",
                fecha_emision: new Date().toISOString(),
                detalles: dbDetalles,
                created_at: new Date().toISOString()
            };

            const savedFactura = await createReceiptInvoiceDraft(dbFactura, selectedList);

            // 9. Limpiar selección y recargar datos de la tabla
            setSelectedReciboIds(new Set());
            await loadData();

            if (hasCredentials) {
                // Un solo clic: se emite enseguida con el mismo proceso de "Facturas de venta".
                // Si la DIAN/Factus rechaza algo, se abre el formulario con el error para corregir.
                setInvoiceToReview(savedFactura);
                return;
            }
            toast.warning("Documento guardado sin emisión electrónica: Factus no está configurado.");

            // 10. Abrir modal de confirmación con opción de impresión directa
            setGeneratedInvoiceModal({
                open: true,
                factura: savedFactura,
                patientData: patientData,
                rcNumerosText: rcNumerosText
            });

        } catch (err) {
            console.error("Error generando factura automática:", err);
            toast && toast.error(`Error al generar la factura: ${err.message || "Ocurrió un error inesperado"}`);
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const handlePrintGeneratedInvoice = () => {
        if (!generatedInvoiceModal.factura) return;
        const fac = generatedInvoiceModal.factura;
        const pac = generatedInvoiceModal.patientData;
        const tenantData = companyInfo || {
            nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenantNombre || "ATM Centro del Dolor Orofacial",
            nit: userProfile?.tenant?.nit || "64576359-3",
            direccion: userProfile?.tenant?.direccion || "Calle 16#17-68",
            ciudad: userProfile?.tenant?.ciudad || "Sincelejo",
            telefono: userProfile?.tenant?.telefono || "3103583706",
            email: userProfile?.tenant?.email || "atmcentrodedolor@gmail.com",
            logoUrl: userProfile?.tenant?.logo_url || userProfile?.tenant?.logoUrl || ""
        };

        const invoicePayload = {
            ...fac,
            numero: fac.numero,
            factusNumero: fac.numero,
            fecha: fac.fecha_emision,
            fecha_emision: fac.fecha_emision,
            fecha_vencimiento: fac.fecha_emision,
            total: Number(fac.total || 0),
            subtotal: Number(fac.subtotal || fac.total || 0),
            formaPago: "10",
            medioPago: fac.detalles?.medioPago || "Efectivo",
            observaciones: fac.detalles?.observaciones || "",
            items: fac.detalles?.items || [],
            cufe: fac.detalles?.cufe || "",
            qrCode: fac.detalles?.qrCode || "",
            pacienteNombre: pac?.nombre,
            pacienteDocumento: pac?.documento,
            pacienteTipoDocumento: pac?.tipoDocumento || "CC",
            pacienteDireccion: pac?.direccion,
            pacienteCiudad: pac?.ciudad,
            pacienteTelefono: pac?.telefono
        };

        printElectronicInvoice({
            factura: invoicePayload,
            patient: pac,
            userProfile,
            tenant: tenantData,
            items: fac.detalles?.items || []
        });
    };


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
    const handlePrint = async (recibo) => {
        try {
            const inq = userProfile?.inquilino || userProfile?.tenantId || inquilino || "";
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

            // Buscar plan de tratamiento real asociado de manera centralizada y precisa
            const targetPlanId = recibo.planId || recibo._meta?.planId || recibo._raw?.planId;
            const targetPatientId = recibo.paciente_id || recibo.pacienteId || recibo._raw?.paciente_id || recibo.paciente;
            const dynamicPlanTitle = recibo.planTitle || recibo._meta?.planTitle || "";

            const planFinancials = await getReceiptPlanFinancials({
                planId: targetPlanId,
                patientId: targetPatientId,
                tenantId: inq,
                receiptAmount: Number(recibo.total || recibo.monto || 0),
                planTitle: dynamicPlanTitle
            });

            const profName = recibo.profesionalNombre || recibo._meta?.profesional || recibo.profesional || (isDoctorUser(userProfile) ? userProfile?.nombreCompleto : "") || "Sin asignar";
            const consNum = recibo.consecutivoNumero || recibo.nroConsecutivo || recibo._meta?.nroConsecutivo || "1";

            printReciboCaja({
                recibo: {
                    ...recibo,
                    nroConsecutivo: consNum,
                    fecha: recibo.rawDate || recibo.fecha || new Date(),
                    pacienteNombre: recibo.pacienteNombre,
                    pacienteDocumento: recibo.pacienteDocumento,
                    pacienteTipoDocumento: recibo.pacienteTipoDocumento || "CC",
                    pacienteDireccion: recibo.pacienteDireccion,
                    pacienteCiudad: recibo.pacienteCiudad,
                    profesionalNombre: profName,
                    registradoPor: recibo.registradoPor || recibo.registrado_por || recibo.usuarioCreador || recibo.usuario_nombre || recibo.usuarioNombre || recibo.creadoPor || recibo.creado_por || recibo.cajero || recibo.usuario || userProfile?.nombreCompleto || "",
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
                    id: recibo.pacienteId || recibo.paciente_id,
                    nombreCompleto: recibo.pacienteNombre,
                    documento: recibo.pacienteDocumento,
                    tipoDocumento: recibo.pacienteTipoDocumento || "CC",
                    tipo_documento: recibo.pacienteTipoDocumento || "CC",
                    direccion: recibo.pacienteDireccion,
                    ciudad: recibo.pacienteCiudad,
                    telefono: recibo.pacienteTelefono
                },
                userProfile: userProfile,
                tenant: tenantData,
                planInfo: planFinancials
            });
        } catch (printErr) {
            console.error("Error al imprimir recibo de caja:", printErr);
            toast && toast.error("Error al preparar la impresión del recibo");
        }
    };

    // --- IMPRESIÓN DOCUMENTO ASOCIADO (Factura de Venta / Factura Electrónica) ---
    const handlePrintAssociatedDoc = async (recibo) => {
        try {
            if (!recibo) return;
            const assoc = recibo.associatedDoc || {};
            let rawFac = assoc.rawFactura;

            // Si aún no tenemos rawFactura completa, buscar en Supabase por número o ID
            if (!rawFac) {
                const targetNum = assoc.numero || recibo.docRefNumber || recibo.fevNumero;
                const targetId = assoc.id || recibo.factura_id || recibo._raw?.factura_id || recibo._meta?.factura_id;
                
                if (targetNum || targetId) {
                    try {
                        let query = supabase.from("facturas").select("*").eq("tenant_id", inquilino);
                        if (targetId && targetNum) {
                            query = query.or(`id.eq.${targetId},numero.eq.${targetNum}`);
                        } else if (targetId) {
                            query = query.eq("id", targetId);
                        } else {
                            query = query.eq("numero", targetNum);
                        }
                        const { data: foundFac } = await query.maybeSingle();
                        if (foundFac) {
                            rawFac = foundFac;
                        } else {
                            const { data: foundElec } = await queryOptionalBillingTable('facturas_electronicas', (table) => {
                            let qElec = table.select("*").eq("tenant_id", inquilino);
                            if (targetId && targetNum) {
                                qElec = qElec.or(`id.eq.${targetId},numero.eq.${targetNum}`);
                            } else if (targetId) {
                                qElec = qElec.eq("id", targetId);
                            } else {
                                qElec = qElec.eq("numero", targetNum);
                            }
                            return qElec.maybeSingle();
                            });
                            if (foundElec) rawFac = foundElec;
                        }
                    } catch (e) {
                        console.warn("Aviso al consultar factura para impresión:", e);
                    }
                }
            }

            const tenantData = companyInfo || {
                nombreComercial: userProfile?.tenant?.nombreComercial || userProfile?.tenantNombre || "ATM Centro del Dolor Orofacial",
                nit: userProfile?.tenant?.nit || "64576359-3",
                direccion: userProfile?.tenant?.direccion || "Calle 16#17-68",
                ciudad: userProfile?.tenant?.ciudad || "Sincelejo",
                telefono: userProfile?.tenant?.telefono || "3103583706",
                email: userProfile?.tenant?.email || "atmcentrodedolor@gmail.com",
                logoUrl: userProfile?.tenant?.logo_url || userProfile?.tenant?.logoUrl || ""
            };

            const pacData = {
                id: recibo.pacienteId || recibo.paciente_id || recibo._raw?.paciente_id,
                nombreCompleto: recibo.pacienteNombre,
                nombres: recibo.pacienteNombre,
                documento: recibo.pacienteDocumento,
                nroDocumento: recibo.pacienteDocumento,
                tipoDocumento: recibo.pacienteTipoDocumento || "CC",
                tipo_documento: recibo.pacienteTipoDocumento || "CC",
                direccion: recibo.pacienteDireccion,
                ciudad: recibo.pacienteCiudad,
                telefono: recibo.pacienteTelefono
            };

            const numFactura = rawFac?.numero || (rawFac?.prefix && rawFac?.number ? `${rawFac.prefix}${rawFac.number}` : null) || assoc.numero || recibo.docRefNumber || "FCEV-0001";
            const totalFactura = Number(rawFac?.total || assoc.total || recibo.total || 0);

            let parsedDet = rawFac?.detalles;
            if (typeof parsedDet === "string") {
                try { parsedDet = JSON.parse(parsedDet); } catch {}
            }

            let invoiceItems = [];
            if (Array.isArray(rawFac?.items) && rawFac.items.length > 0) {
                invoiceItems = rawFac.items;
            } else if (Array.isArray(parsedDet?.items) && parsedDet.items.length > 0) {
                invoiceItems = parsedDet.items;
            } else if (Array.isArray(recibo.conceptos) && recibo.conceptos.length > 0) {
                invoiceItems = recibo.conceptos;
            } else if (recibo.concepto) {
                invoiceItems = [{
                    concepto: recibo.concepto,
                    precioUnitario: totalFactura,
                    cantidad: 1,
                    total: totalFactura
                }];
            } else {
                invoiceItems = [{
                    concepto: "Tratamiento Odontológico",
                    precioUnitario: totalFactura,
                    cantidad: 1,
                    total: totalFactura
                }];
            }

            const facturaPayload = {
                ...rawFac,
                id: rawFac?.id || assoc.id || recibo.id,
                numero: numFactura,
                factusNumero: rawFac?.factusNumero || numFactura,
                fecha: rawFac?.fecha || rawFac?.fecha_emision || rawFac?.created_at || recibo.rawDate || recibo.fecha || new Date(),
                fecha_emision: rawFac?.fecha_emision || rawFac?.fecha || rawFac?.created_at || recibo.rawDate || recibo.fecha || new Date(),
                fecha_vencimiento: rawFac?.fecha_vencimiento || rawFac?.vencimiento || rawFac?.fecha || new Date(),
                total: totalFactura,
                subtotal: rawFac?.subtotal !== undefined ? Number(rawFac.subtotal) : totalFactura,
                formaPago: rawFac?.formaPago || rawFac?.metodo_pago || recibo.medioPago || "10",
                medioPago: rawFac?.medioPago || recibo.medioPago || "Efectivo",
                observaciones: rawFac?.observaciones || rawFac?.notas || recibo.observaciones || "",
                items: invoiceItems,
                cufe: rawFac?.cufe || rawFac?.factusCufe || "",
                qrCode: rawFac?.qrCode || rawFac?.factusQr || rawFac?.qr || "",
                pacienteNombre: pacData.nombreCompleto,
                pacienteDocumento: pacData.documento,
                pacienteTipoDocumento: pacData.tipoDocumento,
                pacienteDireccion: pacData.direccion,
                pacienteCiudad: pacData.ciudad,
                pacienteTelefono: pacData.telefono
            };

            printElectronicInvoice({
                factura: facturaPayload,
                patient: pacData,
                userProfile,
                tenant: tenantData,
                items: invoiceItems
            });
        } catch (err) {
            console.error("Error al imprimir factura asociada:", err);
            toast && toast.error("Error al preparar la impresión de la factura asociada");
        }
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
                            tipoDocumento: p.tipo_documento || p.tipoDocumento || "CC",
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
                if (!errRecs && data && data.length > 0) {
                    dataRecibos = data;
                    // Auto-corrección garantizada de colisión histórica 2088 -> 2089
                    const luzDarisRecibo = dataRecibos.find(r => 
                        r.id === "939b3571-9ccc-4689-a029-af0a2331f27c" && 
                        (String(r.numero) === "2088" || String(r.nroConsecutivo) === "2088" || String(r.nro_consecutivo) === "2088")
                    );
                    if (luzDarisRecibo) {
                        luzDarisRecibo.numero = "2089";
                        luzDarisRecibo.nroConsecutivo = "2089";
                        luzDarisRecibo.nro_consecutivo = "2089";
                        supabase.from("recibos_caja").update({
                            numero: "2089",
                            nroConsecutivo: "2089",
                            nro_consecutivo: "2089"
                        }).eq("id", luzDarisRecibo.id).then(({ error }) => {
                            if (!error) console.log("✅ Consecutivo de Luz Daris actualizado a 2089 en Supabase exitosamente.");
                        });
                    }
                }
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

            // 4. Mapeo de Facturas vinculadas a recibos (P1-FEV1 / Facturas de Venta)
            let invoiceMap = {};
            try {
                const [factsRes, fevRes] = await Promise.all([
                    Promise.resolve(supabase.from("facturas").select("*").eq("tenant_id", inquilino)).catch(() => ({ data: [] })),
                    queryOptionalBillingTable('facturas_electronicas', (table) => table.select("*").eq("tenant_id", inquilino)).catch(() => ({ data: [] }))
                ]);
                const allInvoices = [...(factsRes?.data || []), ...(fevRes?.data || [])];
                allInvoices.forEach((f) => {
                    let det = f.detalles;
                    if (typeof det === "string") {
                        try { det = JSON.parse(det); } catch {}
                    }
                    const numFact = f.numero || (f.prefix && f.number ? `${f.prefix}${f.number}` : null) || (f.id ? `FE-${f.id.slice(0, 6)}` : "");
                    const isFev = Boolean(f.prefix || f.number || f.cufe || f.track_id);
                    const invObj = {
                        id: f.id,
                        numero: numFact,
                        tipo: isFev ? "Factura Electrónica" : "Factura de venta",
                        total: Number(f.total || det?.total || 0),
                        rawFactura: f
                    };

                    const linked = Array.isArray(det?.recibos_asociados)
                        ? det.recibos_asociados
                        : det?.recibo_asociado
                        ? [det.recibo_asociado]
                        : [];
                    linked.forEach((lr) => {
                        const lrId = lr.id || lr.recibo_id;
                        if (lrId) {
                            invoiceMap[lrId] = invObj;
                        }
                    });
                    if (f.recibo_id) {
                        invoiceMap[f.recibo_id] = invObj;
                    }
                    if (f.id) {
                        invoiceMap[f.id] = invObj;
                    }
                    if (f.pago_id) {
                        invoiceMap[f.pago_id] = invObj;
                    }
                    if (numFact) {
                        invoiceMap[numFact] = invObj;
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

                    let rawDate = d.fecha || d.created_at;
                    if (d.created_at && d.fecha) {
                        const fDate = new Date(d.fecha);
                        const cDate = new Date(d.created_at);
                        if (cDate.getTime() - fDate.getTime() > 0 && cDate.getTime() - fDate.getTime() < 36 * 3600 * 1000) {
                            if (fDate.toLocaleDateString('es-CO') !== cDate.toLocaleDateString('es-CO')) {
                                rawDate = d.created_at;
                            }
                        }
                    }

                    return { 
                        ...d, 
                        pacienteNombre: pName,
                        pacienteDocumento: d.pacienteDocumento || pacInfo.documento || "",
                        pacienteTipoDocumento: d.pacienteTipoDocumento || d.paciente_tipo_documento || pacInfo.tipoDocumento || "CC",
                        pacienteTelefono: d.pacienteTelefono || pacInfo.telefono || "",
                        pacienteDireccion: d.pacienteDireccion || pacInfo.direccion || "",
                        pacienteCiudad: d.pacienteCiudad || pacInfo.ciudad || companyInfo?.ciudad || "Sincelejo",
                        tipoDoc: d.tipoDoc || "Recibo de caja",
                        profesionalNombre: d.profesionalNombre || d.doctorNombre || d.doctor || (isDoctorUser(userProfile) ? userProfile?.nombreCompleto : null) || "Sin asignar",
                        registradoPor: d.registradoPor || d.registrado_por || d.usuarioRegistro || d.usuario_nombre || d.creadoPor || d.creado_por || d.cajero || d.usuario || "",
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
                        fecha: rawDate,
                        rawDate: rawDate,
                        planId: d.planId || d.plan_id || null,
                        planTitle: d.planTitle || d.plan_title || null,
                        _raw: d,
                        _meta: d._meta || d.metadata || {}
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

                    const effectiveProf = metadata.profesionalNombre || metadata.profesional || pData.profesional || metadata.doctor || pData.doctor || (isDoctorUser(userProfile) ? userProfile?.nombreCompleto : null) || "Sin asignar";

                    let rawDate = pData.fechaISO || pData.created_at || pData.fecha;
                    if (pData.created_at && (pData.fecha || pData.fechaISO)) {
                        const fDate = new Date(pData.fecha || pData.fechaISO);
                        const cDate = new Date(pData.created_at);
                        if (cDate.getTime() - fDate.getTime() > 0 && cDate.getTime() - fDate.getTime() < 36 * 3600 * 1000) {
                            if (fDate.toLocaleDateString('es-CO') !== cDate.toLocaleDateString('es-CO')) {
                                rawDate = pData.created_at;
                            }
                        }
                    }

                    return {
                        id: pData.id,
                        fecha: rawDate,
                        rawDate: rawDate,
                        pacienteNombre: pName,
                        pacienteDocumento: pacInfo.documento || "",
                        pacienteTipoDocumento: metadata.pacienteTipoDocumento || metadata.paciente_tipo_documento || pacInfo.tipoDocumento || "CC",
                        pacienteTelefono: pacInfo.telefono || "",
                        pacienteDireccion: pacInfo.direccion || "",
                        pacienteCiudad: metadata.pacienteCiudad || pacInfo.ciudad || companyInfo?.ciudad || "Sincelejo",
                        tipoDoc: metadata.tipoDoc || "Recibo de caja",
                        profesionalNombre: effectiveProf,
                        registradoPor: pData.registrado_por || pData.registradoPor || metadata.registradoPor || metadata.registrado_por || pData.usuario_nombre || pData.creadoPor || pData.creado_por || pData.cajero || pData.usuario || "",
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

            // Helper de normalización numérica de consecutivos
            const normalizeReceiptNum = (val) => {
                if (val === null || val === undefined || val === "") return "";
                const str = String(val).trim();
                const clean = str.replace(/^[^\d]+/, "");
                if (/^\d+$/.test(clean)) {
                    return String(parseInt(clean, 10));
                }
                return str.toLowerCase();
            };

            // Evitar duplicados entre la tabla recibos_caja y la tabla pagos
            // IMPORTANTE: Nunca ocultar un pago legítimo solo por coincidir en número consecutivo.
            // Solo descartar si el registro de pagos ya tiene su espejo exacto en recibos_caja
            // (mismo UUID, o vinculado por pago_id, o misma combinación paciente+monto+número).
            const existingReceiptIds = new Set(
                mappedRecibos.map(r => String(r.id || "")).filter(Boolean)
            );
            const existingPagoIds = new Set(
                mappedRecibos.flatMap(r => [
                    r.pago_id, 
                    r.pagoId, 
                    r._raw?.pago_id, 
                    r._meta?.pago_id
                ]).map(id => String(id || "")).filter(Boolean)
            );
            const existingKeys = new Set(
                mappedRecibos.map(r => {
                    const pId = String(r.paciente_id || r.pacienteId || "");
                    const monto = Math.round(Number(r.total || r.monto || 0));
                    const num = normalizeReceiptNum(r.nroConsecutivo || r.numero || r.nro_consecutivo || r.consecutivo);
                    return `${pId}_${monto}_${num}`;
                }).filter(Boolean)
            );
            const existingSaldoFavorPatients = new Set(
                mappedRecibos.filter(r => {
                    const c = (r.concepto || r.observaciones || r.referencia || "").toUpperCase();
                    return c.includes("SALDO A FAVOR");
                }).map(r => {
                    const pId = String(r.paciente_id || r.pacienteId || "");
                    const monto = Math.round(Number(r.total || r.monto || 0));
                    return `${pId}_${monto}`;
                }).filter(Boolean)
            );

            const uniquePagos = mappedPagos.filter(p => {
                const pId = String(p.id || "");
                const pPatientId = String(p.paciente_id || p.pacienteId || p._raw?.paciente_id || p._meta?.paciente_id || "");
                const pMonto = Math.round(Number(p.monto || p._raw?.monto || 0));
                const pNum = normalizeReceiptNum(p.nroConsecutivo || p._raw?.nro_consecutivo || p._meta?.nroConsecutivo || "");
                const pKey = `${pPatientId}_${pMonto}_${pNum}`;

                // Descartar si el ID del pago ya existe como ID de un recibo_caja
                if (pId && existingReceiptIds.has(pId)) return false;
                // Descartar si un recibo_caja ya tiene este pago vinculado por pago_id
                if (pId && existingPagoIds.has(pId)) return false;
                // Descartar si la combinación exacta paciente+monto+número ya existe en recibos_caja
                if (pKey && existingKeys.has(pKey)) return false;

                const isSaldo = (p.referencia || "").toUpperCase().includes("SALDO A FAVOR") ||
                                (p.concepto || "").toUpperCase().includes("SALDO A FAVOR") ||
                                (p._meta?.concepto || "").toUpperCase().includes("SALDO A FAVOR");
                if (isSaldo && existingSaldoFavorPatients.has(`${pPatientId}_${pMonto}`)) {
                    return false;
                }

                return true;
            });

            // Combinar registros únicos y filtrar por rango de fechas
            let combined = [...mappedRecibos, ...uniquePagos];

            combined = combined.filter(r => {
                if (!startTime && !endTime) return true;
                if (!r.rawDate) return true;
                let rTime = null;
                if (typeof r.rawDate === 'string') {
                    const match = r.rawDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (match && (!r.rawDate.includes('T') || r.rawDate.includes('T00:00:00') || r.rawDate.includes('T05:00:00'))) {
                        const [, y, m, d] = match;
                        rTime = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0).getTime();
                    }
                }
                if (!rTime) {
                    const dObj = r.rawDate.toDate ? r.rawDate.toDate() : new Date(r.rawDate);
                    rTime = dObj.getTime();
                }
                if (isNaN(rTime)) return true;
                if (startTime && rTime < startTime) return false;
                if (endTime && rTime > endTime) return false;
                return true;
            });

            // Respetar estrictamente el número de documento asignado en base de datos (INMUTABLE - Nunca alterar números existentes)
            const withConsecutivos = combined.map((item) => {
                const rawC = item.nroConsecutivo || item._meta?.nroConsecutivo || item.consecutivo || item.numero || item.nro_consecutivo;
                const n = (!isNaN(Number(rawC)) && Number(rawC) > 0) ? Number(rawC) : (rawC || "—");

                const fid = item.factura_id || item._raw?.factura_id || item._meta?.factura_id || item.facturaId || item._raw?.facturaId || item._meta?.facturaId;
                const fnum = item.factura_numero || item._raw?.factura_numero || item._meta?.factura_numero || item.facturaNumero;

                const rawInv = (typeof item.fevNumero === "object" && item.fevNumero) ||
                               invoiceMap[item.id] ||
                               (fid ? invoiceMap[fid] : null) ||
                               (fnum ? invoiceMap[fnum] : null) ||
                               (item.fevNumero ? invoiceMap[item.fevNumero] || { numero: item.fevNumero, tipo: "Factura de venta" } : null);
                const docRefNum = typeof rawInv === "object" ? rawInv?.numero : (rawInv || item.fevNumero || null);

                return {
                    ...item,
                    nroConsecutivo: n,
                    consecutivoNumero: n,
                    docRefNumber: docRefNum,
                    associatedDoc: typeof rawInv === "object" ? rawInv : (docRefNum ? { numero: docRefNum, tipo: "Factura de venta", total: item.total } : null)
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

    // Paginación y selección por página (10 registros por página según solicitud)
    const totalPages = Math.max(1, Math.ceil(filteredRecibos.length / PAGE_SIZE));

    const paginatedRecibos = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRecibos.slice(start, start + PAGE_SIZE);
    }, [filteredRecibos, currentPage]);

    const selectableCurrentPage = useMemo(() => {
        return paginatedRecibos.filter(r => !(String(r.estado || "").toLowerCase() === "anulado" || Boolean(r.anulado)) && !receiptInvoiceNumber(r));
    }, [paginatedRecibos]);

    const isCurrentPageAllSelected = selectableCurrentPage.length > 0 && selectableCurrentPage.every(r => selectedReciboIds.has(r.id));

    const handleToggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedReciboIds(prev => {
                const next = new Set(prev);
                selectableCurrentPage.forEach(r => next.add(r.id));
                return next;
            });
        } else {
            setSelectedReciboIds(prev => {
                const next = new Set(prev);
                selectableCurrentPage.forEach(r => next.delete(r.id));
                return next;
            });
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fechaInicio, fechaFin]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const handleCreateNew = onNew || (() => navigate("nuevo"));

    if (invoiceToReview) {
        return <FacturaElectronicaForm
            initialFactura={invoiceToReview}
            autoEmit
            onCancel={() => { setInvoiceToReview(null); loadData(); }}
            onSuccess={() => { setInvoiceToReview(null); loadData(); }}
        />;
    }

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
                    type="button"
                    onClick={handleGenerateInvoiceClick}
                    disabled={isGeneratingInvoice}
                    className="px-4 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg font-bold text-[12px] shadow-sm transition-all flex items-center gap-2 cursor-pointer border-0 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                    title={selectedReciboIds.size > 0 ? `Generar factura automáticamente para ${selectedReciboIds.size} recibo(s) seleccionado(s)` : "Selecciona uno o varios recibos para generar su factura"}
                >
                    {isGeneratingInvoice ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Generando factura...</span>
                        </>
                    ) : (
                        <>
                            <FiPlus size={15} /> 
                            <span>+ Generar factura</span>
                            {selectedReciboIds.size > 0 && (
                                <span className="bg-white text-[#5b8c22] text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                                    {selectedReciboIds.size} {selectedReciboIds.size === 1 ? "recibo" : "recibos"}
                                </span>
                            )}
                        </>
                    )}
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
            <div className="text-[11px] text-slate-400 font-medium italic pl-1 flex items-center justify-between">
                <span>Arrastra una columna aquí para agrupar por ella</span>
                {selectedReciboIds.size > 0 && (
                    <div className="flex items-center gap-2 not-italic">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8CC63F]" />
                            {selectedReciboIds.size} {selectedReciboIds.size === 1 ? "recibo seleccionado" : "recibos seleccionados"}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedReciboIds(new Set())}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                        >
                            Deseleccionar
                        </button>
                    </div>
                )}
            </div>

            {/* MAIN TABLE CONTAINER (OralDrive Style) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        {/* Table Header */}
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                                {/* Checkbox seleccionar todos en la página */}
                                <th className="py-2.5 px-3 w-8 text-center">
                                    <input 
                                        type="checkbox"
                                        checked={isCurrentPageAllSelected}
                                        onChange={handleToggleSelectAll}
                                        className="w-3.5 h-3.5 rounded border border-slate-300 text-[#8CC63F] accent-[#8CC63F] cursor-pointer focus:ring-0 focus:outline-none transition-all"
                                        title="Seleccionar / deseleccionar todos los recibos de esta página"
                                    />
                                </th>
                                <th className="py-2.5 px-2 w-7 text-center text-slate-400"></th>
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
                                    <td colSpan="11" className="py-14 text-center text-slate-400 font-medium">
                                        <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                        Cargando recibos de caja...
                                    </td>
                                </tr>
                            ) : !hasSearched ? (
                                <tr>
                                    <td colSpan="11" className="py-16 text-center text-slate-400 font-medium">
                                        <FiCalendar size={32} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-[13px] font-bold text-slate-700">Selecciona el rango de fechas y haz clic en "Buscar"</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Los recibos de caja se consultarán únicamente para el período especificado.</p>
                                    </td>
                                </tr>
                            ) : filteredRecibos.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="py-12 text-center text-slate-400 font-medium italic">
                                        No se encontraron registros de recibos de caja en este rango de fechas.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecibos.map((r) => {
                                    const isAnulado = String(r.estado || "").toLowerCase() === "anulado" || Boolean(r.anulado);
                                    const isExpanded = expandedRowId === r.id;
                                    const isSelected = selectedReciboIds.has(r.id);

                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr 
                                                onClick={() => toggleRow(r.id)}
                                                className={`transition-colors cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-emerald-50/40 hover:bg-emerald-50/60 border-l-2 border-l-[#8CC63F]'
                                                        : isExpanded 
                                                            ? 'bg-blue-50/40' 
                                                            : isAnulado 
                                                                ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-2 border-l-rose-500' 
                                                                : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                {/* Checkbox de selección para facturar */}
                                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {receiptInvoiceNumber(r) ? (
                                                        <span className="inline-flex text-slate-400" title={`Ya facturado (${receiptInvoiceNumber(r)}): no se puede volver a facturar`}>
                                                            <FiLock size={12} />
                                                        </span>
                                                    ) : (
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectRow(r.id)}
                                                        disabled={isAnulado}
                                                        className="w-3.5 h-3.5 rounded border border-slate-300 text-[#8CC63F] accent-[#8CC63F] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus:ring-0 focus:outline-none transition-all"
                                                        title={isAnulado ? "No se puede facturar un recibo anulado" : "Palomear para generar factura"}
                                                    />
                                                    )}
                                                </td>

                                                {/* Expander Icon */}
                                                <td className="py-2.5 px-2 text-center text-slate-400">
                                                    {isExpanded ? <FiChevronDown size={14} className="text-blue-600" /> : <FiChevronRight size={14} />}
                                                </td>

                                                {/* Doc. (Consecutivo) */}
                                                <td className={`py-2.5 px-3 font-semibold font-mono ${isAnulado ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{r.consecutivoNumero}</span>
                                                        {isAnulado && (
                                                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold bg-rose-100 text-rose-700 rounded-md border border-rose-300">
                                                                ANULADO
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Doc. Ref. (Eye Button like OralDrive) */}
                                                <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setAssociatedDocsModal({ open: true, recibo: r })}
                                                        className="w-7 h-6 mx-auto inline-flex items-center justify-center bg-[#0090d9] hover:bg-[#007bbd] text-white rounded text-[11px] font-bold transition-all shadow-xs cursor-pointer border-0 active:scale-95"
                                                        title={r.docRefNumber ? `Ver documento asociado (${r.docRefNumber})` : "Ver documentos asociados"}
                                                    >
                                                        <FiEye size={13} />
                                                    </button>
                                                </td>

                                                {/* Pac./Ter. */}
                                                <td className={`py-2.5 px-4 font-semibold uppercase ${isAnulado ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                                                    {r.pacienteNombre}
                                                </td>

                                                {/* Profesional */}
                                                <td className={`py-2.5 px-4 font-medium ${isAnulado ? 'text-rose-500 opacity-80' : 'text-slate-600'}`}>
                                                    {r.profesionalNombre}
                                                </td>

                                                {/* Medio de pago */}
                                                <td className={`py-2.5 px-4 font-medium ${isAnulado ? 'text-rose-500 opacity-80' : 'text-slate-600'}`}>
                                                    {r.medioPago}
                                                </td>

                                                {/* Referencia */}
                                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                                    {r.referencia || "—"}
                                                </td>

                                                {/* Vence en */}
                                                <td className="py-2.5 px-3 text-center text-slate-600 font-semibold font-mono">
                                                    {r.venceEn || 0}
                                                </td>

                                                {/* T. Doc. */}
                                                <td className={`py-2.5 px-4 text-right font-bold font-mono ${isAnulado ? 'text-rose-600 line-through opacity-75' : 'text-slate-800'}`}>
                                                    {fmt(r.total)}
                                                </td>

                                                {/* Acciones directas (Imprimir y Anular) */}
                                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                    <td colSpan="11" className="py-4 px-8">
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

                {/* Paginador (1:1 OralDrive / OdontoCloud - 10 recibos por página) */}
                <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                        {filteredRecibos.length > 0 ? (
                            <span>
                                Mostrando <strong className="text-slate-700 font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</strong> a <strong className="text-slate-700 font-bold">{Math.min(currentPage * PAGE_SIZE, filteredRecibos.length)}</strong> de <strong className="text-slate-700 font-bold">{filteredRecibos.length}</strong> recibos
                            </span>
                        ) : (
                            <span>0 recibos</span>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
                                title="Página anterior"
                            >
                                ‹
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(pageNum => {
                                    if (totalPages <= 7) return true;
                                    if (pageNum === 1 || pageNum === totalPages) return true;
                                    return Math.abs(pageNum - currentPage) <= 1;
                                })
                                .map((pageNum, idx, arr) => {
                                    const prevPageNum = arr[idx - 1];
                                    const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;
                                    return (
                                        <React.Fragment key={pageNum}>
                                            {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-semibold transition-all cursor-pointer ${
                                                    currentPage === pageNum
                                                        ? "bg-[#8CC63F] text-white shadow-xs font-bold"
                                                        : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
                                title="Página siguiente"
                            >
                                ›
                            </button>
                        </div>
                    )}
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
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                                        <tr>
                                            <th className="py-2.5 px-4 font-semibold">Número documento</th>
                                            <th className="py-2.5 px-4 font-semibold">Tipo documento</th>
                                            <th className="py-2.5 px-4 font-semibold">Valor</th>
                                            <th className="py-2.5 px-4 text-center font-semibold">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {associatedDocsModal.recibo?.docRefNumber ? (
                                            <tr className="hover:bg-slate-50/60">
                                                <td className="py-3 px-4 font-bold font-mono text-slate-800">
                                                    {associatedDocsModal.recibo.associatedDoc?.numero || associatedDocsModal.recibo.docRefNumber}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 font-medium">
                                                    {associatedDocsModal.recibo.associatedDoc?.tipo || "Factura de venta"}
                                                </td>
                                                <td className="py-3 px-4 font-bold font-mono text-slate-800">
                                                    {fmt(associatedDocsModal.recibo.associatedDoc?.total || associatedDocsModal.recibo.total)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handlePrintAssociatedDoc(associatedDocsModal.recibo)}
                                                        className="w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded flex items-center justify-center mx-auto transition-colors shadow-xs cursor-pointer border-0"
                                                        title="Imprimir documento asociado"
                                                    >
                                                        <FiPrinter size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="py-12 text-center text-slate-400 text-xs font-normal">
                                                    No se encontraron documentos asociados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
                            <button 
                                type="button"
                                onClick={() => setAssociatedDocsModal({ open: false, recibo: null })}
                                className="px-5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium text-xs transition-colors cursor-pointer"
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

            {/* ========================================================================= */}
            {/* MODAL: FACTURA GENERADA AUTOMÁTICAMENTE CON ÉXITO                         */}
            {/* ========================================================================= */}
            {generatedInvoiceModal.open && generatedInvoiceModal.factura && (
                <div 
                    className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setGeneratedInvoiceModal({ open: false, factura: null, patientData: null, rcNumerosText: "" })}
                >
                    <div 
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-zoomIn"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header con gradiente verde institucional */}
                        <div className="px-6 py-5 bg-gradient-to-r from-[#8CC63F] to-emerald-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                                    <FiCheck size={22} className="stroke-[3]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white leading-tight">
                                        {generatedInvoiceModal.factura.detalles?.dianStatus === "ACEPTADA" ? "Factura aceptada por la DIAN" : "Documento guardado"}
                                    </h3>
                                    <p className="text-xs text-white/90">
                                        Creada y alojada en Facturas de Venta
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setGeneratedInvoiceModal({ open: false, factura: null, patientData: null, rcNumerosText: "" })}
                                className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer border-0"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Contenido con detalles resumidos */}
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-500 block">Número de factura:</span>
                                    <span className="text-lg font-black font-mono text-slate-800">
                                        #{generatedInvoiceModal.factura.numero}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[11px] font-semibold text-slate-500 block">Total facturado:</span>
                                    <span className="text-lg font-black font-mono text-emerald-600">
                                        {fmt(generatedInvoiceModal.factura.total)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 text-xs text-slate-600 border border-slate-100 rounded-xl p-3.5 bg-white">
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Paciente / Tercero:</span>
                                    <span className="font-bold text-slate-800 uppercase">
                                        {generatedInvoiceModal.patientData?.nombre}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Documento:</span>
                                    <span className="font-mono font-medium text-slate-700">
                                        {generatedInvoiceModal.patientData?.tipoDocumento} {generatedInvoiceModal.patientData?.documento}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Recibo(s) asociado(s):</span>
                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                        {generatedInvoiceModal.rcNumerosText}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="font-semibold text-slate-500">Módulo destino:</span>
                                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                        Facturas de venta
                                    </span>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-400 text-center italic">
                                Estado: {generatedInvoiceModal.factura.detalles?.dianStatus || "Sin emisión confirmada"}.
                                {generatedInvoiceModal.factura.detalles?.lastError || " Documento disponible en Facturas de Venta."}
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={handlePrintGeneratedInvoice}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <FiPrinter size={14} className="text-slate-500" />
                                <span>Imprimir factura</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setGeneratedInvoiceModal({ open: false, factura: null, patientData: null, rcNumerosText: "" })}
                                className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer border-0"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

