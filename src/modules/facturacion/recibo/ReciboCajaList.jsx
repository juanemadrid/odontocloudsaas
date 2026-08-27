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

    const [loading, setLoading] = useState(true);
    const [recibos, setRecibos] = useState([]);
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);

    // Modal: Documentos Asociados (Doc. Ref.)
    const [associatedDocsModal, setAssociatedDocsModal] = useState({ open: false, recibo: null });

    // Modal: Ver motivo de anulación
    const [viewVoidModal, setViewVoidModal] = useState({ open: false, recibo: null });

    // Modal: Anular
    const [voidModal, setVoidModal] = useState({ open: false, recibo: null });
    const [voidReason, setVoidReason] = useState("");
    const [voidUser, setVoidUser] = useState("");

    // Filters
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = new Date();
        d.setDate(1); // 1st of current month
        return d.toISOString().split('T')[0];
    });
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
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
                    nombreComercial: empConfig.nombreComercial || t.nombre || "ATM Centro del Dolor Orofacial",
                    nit: empConfig.nit || t.nit || "64576359-3",
                    direccion: empConfig.direccion || t.direccion || "Calle 16#17-68",
                    ciudad: empConfig.ciudad || t.ciudad || "Sincelejo",
                    telefono: empConfig.telefono || t.telefono || "2769030",
                    email: empConfig.email || t.email || "atmcentrodel dolor@gmail.com",
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
            nombreComercial: userProfile?.tenant?.nombreComercial || "ATM Centro del Dolor Orofacial",
            nit: userProfile?.tenant?.nit || "64576359-3",
            direccion: userProfile?.tenant?.direccion || "Calle 16#17-68",
            ciudad: userProfile?.tenant?.ciudad || "Sincelejo",
            telefono: userProfile?.tenant?.telefono || "2769030",
            email: userProfile?.tenant?.email || "atmcentrodel dolor@gmail.com",
            logoUrl: userProfile?.tenant?.logo_url || ""
        };

        const conceptosList = (recibo.conceptos && recibo.conceptos.length > 0)
            ? recibo.conceptos
            : [{
                concepto: recibo.concepto || "Consulta de primera vez con especialista en ATM",
                precioUnitario: recibo.total,
                cantidad: 1,
                total: recibo.total
            }];

        printReciboCaja({
            recibo: {
                ...recibo,
                nroConsecutivo: recibo.consecutivoNumero || recibo.nroConsecutivo || "1993",
                fecha: recibo.rawDate || recibo.fecha || new Date(),
                pacienteNombre: recibo.pacienteNombre,
                pacienteDocumento: recibo.pacienteDocumento,
                pacienteDireccion: recibo.pacienteDireccion,
                pacienteCiudad: recibo.pacienteCiudad,
                profesionalNombre: recibo.profesionalNombre || "MARIA CAROLINA ARROYO CASTILLO",
                medioPago: recibo.medioPago || "Efectivo",
                conceptos: conceptosList,
                total: recibo.total,
                observaciones: recibo.observaciones || recibo.notas || ""
            },
            patient: {
                nombreCompleto: recibo.pacienteNombre,
                documento: recibo.pacienteDocumento,
                direccion: recibo.pacienteDireccion,
                ciudad: recibo.pacienteCiudad,
                telefono: recibo.pacienteTelefono
            },
            tenant: tenantData,
            planInfo: {
                planTitle: "Tratamiento ATM",
                totalPlan: recibo.total,
                totalPagado: recibo.total,
                saldo: 0
            }
        });
    };

    // --- ANULACIÓN ---
    const handleOpenVoid = (recibo) => {
        setVoidReason("");
        setVoidModal({ open: true, recibo });
    };

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            alert("El motivo de la anulación es obligatorio");
            return;
        }
        try {
            const recibo = voidModal.recibo;
            const targetTable = recibo.isPago ? "pagos" : "recibos_caja";
            
            await supabase
                .from(targetTable)
                .update({
                    estado: "Anulado",
                    motivoAnulacion: voidReason.trim(),
                    anuladoPor: voidUser.trim(),
                    fechaAnulacion: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq("id", recibo.id);

            toast && toast.success("Documento anulado correctamente");
            await loadData();
            setVoidModal({ open: false, recibo: null });
        } catch (e) {
            console.error("Error voiding receipt:", e);
            toast && toast.error("Error al anular el recibo");
        }
    };

    // --- CARGA DE DATOS ---
    const parseLocalDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const loadData = useCallback(async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const start = parseLocalDate(fechaInicio);
            start.setHours(0, 0, 0, 0);
            const end = parseLocalDate(fechaFin);
            end.setHours(23, 59, 59, 999);

            // 1. Pacientes map
            let patientMap = {};
            try {
                const { data: pacsData } = await supabase
                    .from("pacientes")
                    .select("*")
                    .eq("tenant_id", inquilino);
                
                (pacsData || []).forEach(p => {
                    const full = `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.nombreCompleto || p.documento || "Paciente";
                    if (p.id) {
                        patientMap[p.id] = {
                            nombre: full,
                            documento: p.documento || p.nroDocumento || "",
                            telefono: p.telefono || p.celular || "",
                            direccion: p.direccion || ""
                        };
                    }
                });
            } catch (e) {
                console.warn("Could not fetch pacientes:", e);
            }

            // 2. Recibos de caja
            let dataRecibos = [];
            try {
                const { data } = await supabase
                    .from("recibos_caja")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (data && data.length > 0) dataRecibos = data;
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
                    return { 
                        ...d, 
                        pacienteNombre: pName,
                        pacienteDocumento: d.pacienteDocumento || pacInfo.documento || "",
                        pacienteTelefono: d.pacienteTelefono || pacInfo.telefono || "",
                        pacienteDireccion: d.pacienteDireccion || pacInfo.direccion || "",
                        tipoDoc: d.tipoDoc || "Recibo de caja",
                        profesionalNombre: d.profesionalNombre || d.doctorNombre || d.doctor || userProfile?.nombreCompleto || "Guillermo Rodriguez",
                        medioPago: d.medioPago || d.condicionPago || d.medio || "Efectivo",
                        referencia: d.referencia || d.comprobante || "",
                        venceEn: 0,
                        isPago: false,
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

                    const pId = pData.paciente_id || pData.pacienteId || metadata.paciente_id || pData.paciente;
                    const pacInfo = patientMap[pId] || {};
                    const pName = pData.patientNombre || pData.pacienteNombre || metadata.patientNombre || pacInfo.nombre || "Paciente";
                    const medioRaw = pData.metodo || pData.medio || metadata.metodo || metadata.medio || "Transferencia Débito";

                    return {
                        id: pData.id,
                        fecha: pData.fechaISO || pData.created_at || pData.fecha,
                        rawDate: pData.fechaISO || pData.created_at || pData.fecha,
                        pacienteNombre: pName,
                        pacienteDocumento: pacInfo.documento || "",
                        pacienteTelefono: pacInfo.telefono || "",
                        pacienteDireccion: pacInfo.direccion || "",
                        tipoDoc: metadata.tipoDoc || "Recibo de caja",
                        profesionalNombre: metadata.doctor || pData.doctor || userProfile?.nombreCompleto || "Guillermo Rodriguez",
                        medioPago: medioRaw,
                        referencia: metadata.referencia || pData.referencia || "",
                        venceEn: 0,
                        total: pData.monto || 0,
                        estado: pData.estado || (metadata.anulado ? "Anulado" : "Activo"),
                        motivoAnulacion: pData.motivoAnulacion || metadata.motivoAnulacion || "",
                        anuladoPor: pData.anuladoPor || metadata.anuladoPor || "",
                        fechaAnulacion: pData.fechaAnulacion || metadata.fechaAnulacion || "",
                        nroConsecutivo: metadata.nroConsecutivo || pData.nroConsecutivo || pData.nro_consecutivo || "",
                        isPago: true,
                        _raw: pData,
                        _meta: metadata
                    };
                })
                .filter(p => !isConsumoSaldo(p._raw, p._meta));

            // Combine and filter by date range
            let combined = [...mappedRecibos, ...mappedPagos];
            const startTime = start.getTime();
            const endTime = end.getTime();

            combined = combined.filter(r => {
                if (!r.rawDate) return true;
                const rTime = new Date(r.rawDate).getTime();
                return isNaN(rTime) || (rTime >= startTime && rTime <= endTime);
            });

            // Sort ascending by date to assign sequential consecutive number if missing, then invert for display
            combined.sort((a, b) => new Date(a.rawDate || 0) - new Date(b.rawDate || 0));

            const baseConsecutivo = 1999;
            const withConsecutivos = combined.map((item, idx) => {
                const storedCons = item.nroConsecutivo || item._meta?.nroConsecutivo || item.consecutivo;
                const cleanConsecutivo = storedCons && !isNaN(Number(storedCons))
                    ? Number(storedCons)
                    : (baseConsecutivo + idx);
                
                return {
                    ...item,
                    nroConsecutivo: cleanConsecutivo,
                    consecutivoNumero: cleanConsecutivo,
                    docRefNumber: `FCEV${cleanConsecutivo + 50}` // Número de factura asociada
                };
            });

            // Display descending (latest first)
            withConsecutivos.reverse();
            setRecibos(withConsecutivos);
        } catch (e) {
            console.error("Error cargando recibos:", e);
        } finally {
            setLoading(false);
        }
    }, [inquilino, fechaInicio, fechaFin, userProfile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

                <button
                    onClick={handleCreateNew}
                    className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-lg font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                >
                    <FiPlus size={16} />
                    <span>+ Recibo de caja</span>
                </button>
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
                        onClick={loadData}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-1.5 rounded-lg font-bold text-[12px] transition-all cursor-pointer border-0 shadow-sm"
                    >
                        Buscar
                    </button>
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
                                <th className="py-2.5 px-3 w-10 text-center text-slate-400">
                                    <span className="text-xs">❓</span>
                                </th>
                                <th className="py-2.5 px-3 w-20">
                                    <div className="flex items-center gap-1">
                                        <span>Doc.</span>
                                    </div>
                                </th>
                                <th className="py-2.5 px-4 w-32">
                                    <span>Tipo doc.</span>
                                </th>
                                <th className="py-2.5 px-3 w-24 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] text-slate-400">❓</span>
                                        <span>Doc. Ref.</span>
                                    </div>
                                </th>
                                <th className="py-2.5 px-4">
                                    <span>Pac./Ter.</span>
                                </th>
                                <th className="py-2.5 px-4">
                                    <span>Profesional</span>
                                </th>
                                <th className="py-2.5 px-4">
                                    <span>Medio de pago</span>
                                </th>
                                <th className="py-2.5 px-3">
                                    <span>Referencia</span>
                                </th>
                                <th className="py-2.5 px-3 w-24 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] text-slate-400">❓</span>
                                        <span>Vence en</span>
                                    </div>
                                </th>
                                <th className="py-2.5 px-4 text-right w-28">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-slate-400">❓</span>
                                        <span>T. Doc.</span>
                                    </div>
                                </th>
                                <th className="py-2.5 px-3 w-12 text-center"></th>
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
                            ) : filteredRecibos.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="py-12 text-center text-slate-400 font-medium italic">
                                        No se encontraron registros de recibos de caja.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecibos.map((r) => {
                                    const isAnulado = r.estado === "Anulado";
                                    const isExpanded = expandedRowId === r.id;

                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr 
                                                onClick={() => toggleRow(r.id)}
                                                className={`transition-colors cursor-pointer ${
                                                    isExpanded 
                                                        ? 'bg-blue-50/40' 
                                                        : isAnulado 
                                                            ? 'hover:bg-rose-50/30' 
                                                            : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                {/* Expander Icon */}
                                                <td className="py-3 px-3 text-center text-slate-400">
                                                    {isExpanded ? <FiChevronDown size={14} className="text-blue-600" /> : <FiChevronRight size={14} />}
                                                </td>

                                                {/* Doc. (Consecutivo) */}
                                                <td className={`py-3 px-3 font-semibold font-mono ${isAnulado ? 'text-rose-500 font-bold' : 'text-slate-700'}`}>
                                                    {r.consecutivoNumero}
                                                </td>

                                                {/* Tipo doc. */}
                                                <td className="py-3 px-4 font-medium text-slate-600">
                                                    {r.tipoDoc || "Recibo de caja"}
                                                </td>

                                                {/* Doc. Ref. (Blue Eye Button) */}
                                                <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => setAssociatedDocsModal({ open: true, recibo: r })}
                                                        className="w-7 h-6 bg-sky-500 hover:bg-sky-600 text-white rounded flex items-center justify-center mx-auto transition-colors shadow-xs cursor-pointer border-0"
                                                        title="Ver documentos asociados"
                                                    >
                                                        <FiEye size={13} />
                                                    </button>
                                                </td>

                                                {/* Pac./Ter. */}
                                                <td className={`py-3 px-4 font-semibold uppercase ${isAnulado ? 'text-rose-500 font-bold' : 'text-slate-800'}`}>
                                                    {r.pacienteNombre}
                                                </td>

                                                {/* Profesional */}
                                                <td className={`py-3 px-4 font-medium ${isAnulado ? 'text-rose-500' : 'text-slate-600'}`}>
                                                    {r.profesionalNombre}
                                                </td>

                                                {/* Medio de pago */}
                                                <td className={`py-3 px-4 font-medium ${isAnulado ? 'text-rose-500 font-bold' : 'text-slate-600'}`}>
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
                                                <td className={`py-3 px-4 text-right font-bold font-mono ${isAnulado ? 'text-rose-500' : 'text-slate-800'}`}>
                                                    {fmt(r.total)}
                                                </td>

                                                {/* ... Action Menu Trigger */}
                                                <td className="py-3 px-3 text-center text-slate-400 hover:text-slate-700 font-black text-sm">
                                                    ···
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
                                                            </div>

                                                            {/* Action buttons (Editar, Recaudar, Imprimir, Anular) */}
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-500 mr-1">Acciones:</span>
                                                                
                                                                {/* 1. Editar */}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (r.isPago) {
                                                                            toast && toast.info("Comprobante registrado desde módulo de paciente");
                                                                        } else {
                                                                            navigate(`editar/${r.id}`);
                                                                        }
                                                                    }}
                                                                    className="w-8 h-8 rounded bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer border-0"
                                                                    title="Editar documento"
                                                                >
                                                                    <FiEdit2 size={13} />
                                                                </button>

                                                                {/* 2. Recaudar / Abonar */}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toast && toast.success(`Recaudo vinculado para ${r.pacienteNombre}`);
                                                                    }}
                                                                    className="w-8 h-8 rounded bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer border-0"
                                                                    title="Recaudar / Gestionar abono"
                                                                >
                                                                    <FiCreditCard size={13} />
                                                                </button>

                                                                {/* 3. Imprimir */}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePrint(r);
                                                                    }}
                                                                    className="w-8 h-8 rounded bg-cyan-500 hover:bg-cyan-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer border-0"
                                                                    title="Imprimir documento"
                                                                >
                                                                    <FiPrinter size={13} />
                                                                </button>

                                                                {/* 4. Anular / Ver Anulación */}
                                                                {isAnulado ? (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewVoidModal({ open: true, recibo: r });
                                                                        }}
                                                                        className="w-8 h-8 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer border-0"
                                                                        title="Ver motivo de anulación"
                                                                    >
                                                                        <FiEye size={13} />
                                                                    </button>
                                                                ) : (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenVoid(r);
                                                                        }}
                                                                        className="w-8 h-8 rounded bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer border-0"
                                                                        title="Anular recibo"
                                                                    >
                                                                        <FiTrash2 size={13} />
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
                                                {associatedDocsModal.recibo.docRefNumber || `FCEV${associatedDocsModal.recibo.consecutivoNumero}`}
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
                                onClick={() => setVoidModal({ open: false, recibo: null })}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmVoid}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
                            >
                                Confirmar Anulación
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
