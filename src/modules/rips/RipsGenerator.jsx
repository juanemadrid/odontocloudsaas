import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import {
    buildRipsJSON,
    buildUsuarioJSON,
    buildConsultaJSON,
    buildProcedimientoJSON,
    suggestClinicalCodes,
    formatNitForRips,
    validateCIE10,
    validateCUPS
} from '../../utils/ripsValidators';
import { 
    FiActivity, FiCalendar, FiChevronRight, FiDownload, FiSearch, 
    FiFileText, FiAlertTriangle, FiCheckCircle, FiSettings, FiLayers 
} from 'react-icons/fi';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";

export default function RipsGenerator() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const inquilino = userProfile?.inquilino || "";

    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);
    const [generatedFiles, setGeneratedFiles] = useState([]);
    const [logs, setLogs] = useState([]);

    // Filtros dinámicos
    const [sucursales, setSucursales] = useState([]);
    const [epsList, setEpsList] = useState([]);
    const [selectedSucursal, setSelectedSucursal] = useState('');
    const [selectedEps, setSelectedEps] = useState('');
    const [filterType, setFilterType] = useState('facturacion');

    // Datos del tenant
    const [tenantConfig, setTenantConfig] = useState({
        nit: "",
        codigoPrestador: "",
        razonSocial: "",
        esIps: false
    });
    const [configWarning, setConfigWarning] = useState("");

    // Listas de Previsualización y Validación
    const [dianDocs, setDianDocs] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [consultas, setConsultas] = useState([]);
    const [procedimientos, setProcedimientos] = useState([]);
    const [searched, setSearched] = useState(false);

    const fmt = (n) =>
      Number(n || 0).toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      });

    // Cargar historial y configuración de la empresa (Tenant)
    useEffect(() => {
        if (!inquilino) return;

        const loadTenantConfig = async () => {
            try {
                const tenantSnap = await getDoc(doc(db, "tenants", inquilino));
                if (tenantSnap.exists()) {
                    const data = tenantSnap.data();
                    const nitClean = formatNitForRips(data.nit || "");
                    const codPrestador = String(data.codigoPrestador || "").trim();
                    const rSocial = data.razonSocial || data.name || "";

                    setTenantConfig({
                        nit: nitClean,
                        codigoPrestador: codPrestador,
                        razonSocial: rSocial,
                        esIps: data.esIps || false
                    });

                    let warningMsg = "";
                    if (!nitClean) warningMsg += "Falta configurar el NIT de la empresa. ";
                    if (!codPrestador || codPrestador.length < 10) warningMsg += "Falta o es inválido el Código de Habilitación de Prestador (REPS). ";

                    setConfigWarning(warningMsg);
                }
            } catch (e) {
                console.error("Error al cargar configuración de la empresa:", e);
            }
        };

        const loadHistory = async () => {
            try {
                const q = query(
                    collection(db, "rips_generados"),
                    where("inquilino", "==", inquilino)
                );
                const snap = await getDocs(q);
                const files = snap.docs.map(doc => doc.data());
                
                files.sort((a, b) => {
                    const da = a.fechaGeneracion?.toDate ? a.fechaGeneracion.toDate() : new Date(a.fechaGeneracion || 0);
                    const db = b.fechaGeneracion?.toDate ? b.fechaGeneracion.toDate() : new Date(b.fechaGeneracion || 0);
                    return db.getTime() - da.getTime();
                });
                
                setGeneratedFiles(files);
            } catch (e) {
                console.error("Error al cargar historial RIPS:", e);
            }
        };
        
        const loadMetadata = async () => {
            try {
                const qS = query(collection(db, "sucursales"), where("inquilino", "==", inquilino));
                const snapS = await getDocs(qS);
                setSucursales(snapS.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                const qE = query(collection(db, "eps_catalogo"), where("inquilino", "==", inquilino));
                const snapE = await getDocs(qE);
                const uniqueEps = [...new Set(snapE.docs.map(doc => doc.data().nombre))].filter(Boolean).sort();
                setEpsList(uniqueEps);
            } catch (e) {
                console.error("Error al cargar metadatos RIPS:", e);
            }
        };

        loadTenantConfig();
        loadHistory();
        loadMetadata();
    }, [inquilino]);

    // Normaliza cualquier campo de fecha (Timestamp, Date, string YYYY-MM-DD) a string "YYYY-MM-DD"
    const normalizeFecha = (val) => {
        if (!val) return null;
        // Firestore Timestamp
        if (typeof val === 'object' && typeof val.toDate === 'function') {
            return val.toDate().toISOString().substring(0, 10);
        }
        // JS Date
        if (val instanceof Date) return val.toISOString().substring(0, 10);
        // String
        const s = String(val).trim();
        // ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm...
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        // DD/MM/YYYY
        const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        return s.substring(0, 10);
    };

    const handleGenerate = async () => {
        if (!dateRange.start || !dateRange.end) {
            toast.error("Seleccione un rango de fechas válido.");
            return;
        }

        setLoading(true);
        setLogs([]);
        const newFiles = [];
        
        const dianList = [];
        const userList = [];
        const conList = [];
        const procList = [];

        try {
            setLogs(prev => [...prev, `🔍 Iniciando consulta... Filtro por fecha de: ${filterType === 'facturacion' ? 'facturación' : 'realizado'}`]);

            // Helper: filtra docs por rango de fecha en memoria (admite Timestamp y string)
            const inRange = (docData) => {
                const raw = filterType === 'facturacion'
                    ? (docData.fecha || docData.fechaFactura || docData.fechaCreacion || docData.createdAt)
                    : (docData.fechaRealizado || docData.fechaServicio || docData.fecha || docData.createdAt);
                const fechaDoc = normalizeFecha(raw);
                if (!fechaDoc) return false;
                return fechaDoc >= dateRange.start && fechaDoc <= dateRange.end;
            };

            // 1. Consultar TODAS las colecciones de facturación del inquilino
            setLogs(prev => [...prev, `📂 Consultando colecciones de facturación...`]);

            const colecciones = [
                { nombre: "recibos_caja",         tipoDoc: "Recibo de Caja" },
                { nombre: "facturas",              tipoDoc: "Factura" },
                { nombre: "facturas_electronicas", tipoDoc: "Factura Electrónica" },
                { nombre: "facturas_venta",        tipoDoc: "Factura de Venta" },
                { nombre: "pagos",                 tipoDoc: "Pago" },
            ];

            const snapshots = await Promise.all(
                colecciones.map(({ nombre }) =>
                    getDocs(query(collection(db, nombre), where("inquilino", "==", inquilino)))
                        .catch(() => ({ docs: [] })) // si la colección no existe, ignorar
                )
            );

            let facturas = [];
            snapshots.forEach((snap, i) => {
                const docs = snap.docs
                    .map(d => ({ id: d.id, _coleccion: colecciones[i].nombre, _tipoDoc: colecciones[i].tipoDoc, ...d.data() }))
                    .filter(inRange);
                facturas.push(...docs);
            });

            // Deduplicar por id (por si el mismo documento aparece en varias colecciones)
            const seen = new Set();
            facturas = facturas.filter(f => {
                const key = `${f._coleccion}::${f.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            setLogs(prev => [...prev, `📋 ${facturas.length} documentos encontrados en el rango ${dateRange.start} → ${dateRange.end}`]);

            if (facturas.length === 0) {
                toast.error("No se encontraron registros de facturación en el rango seleccionado.");
                setLoading(false);
                return;
            }

            // 2. Cargar Pacientes y mapear por ID, Documento y Nombre
            const patSnap = await getDocs(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)));
            const pacientesById = {};
            const pacientesByDoc = {};
            const pacientesByName = {};

            patSnap.docs.forEach(d => {
                const p = { id: d.id, ...d.data() };
                // Indexar por Firestore doc ID (el más común referenciado en pacienteId)
                pacientesById[d.id] = p;
                // También indexar por campo id interno si difiere
                if (p.id && p.id !== d.id) pacientesById[p.id] = p;
                const docNum = String(p.nroDocumento || p.cedula || p.numDoc || "").trim();
                if (docNum) pacientesByDoc[docNum] = p;
                const full = (p.nombreCompleto || p.nombre || `${p.nombres || ""} ${p.apellidos || ""}`).trim().toLowerCase();
                if (full) pacientesByName[full] = p;
            });

            setLogs(prev => [...prev, `👥 ${patSnap.docs.length} pacientes cargados para cruce de datos`]);

            // 2.5 Filtros opcionales (Sucursal y EPS)
            if (selectedSucursal) {
                const sucursalObj = sucursales.find(s => s.id === selectedSucursal || s.nombre === selectedSucursal);
                const sucursalName = sucursalObj?.nombre || selectedSucursal;
                setLogs(prev => [...prev, `🏢 Filtrando por sucursal: ${sucursalName}`]);
                facturas = facturas.filter(f => {
                    const patient = pacientesById[f.pacienteId] || pacientesByDoc[f.pacienteDocumento] || pacientesByName[(f.pacienteNombre || "").toLowerCase()];
                    if (!patient) return false;
                    return patient.sucursal === sucursalName || patient.sucursalId === selectedSucursal || patient.sede === sucursalName;
                });
            }

            if (selectedEps) {
                setLogs(prev => [...prev, `🛡️ Filtrando por EPS/Tercero: ${selectedEps}`]);
                facturas = facturas.filter(f => {
                    const patient = pacientesById[f.pacienteId] || pacientesByDoc[f.pacienteDocumento] || pacientesByName[(f.pacienteNombre || "").toLowerCase()];
                    if (!patient) return false;
                    return (patient.nombreEps || "").trim().toUpperCase() === selectedEps.trim().toUpperCase();
                });
            }

            if (facturas.length === 0) {
                toast.error("No se encontraron facturas que coincidan con los filtros.");
                setLoading(false);
                return;
            }

            setLogs(prev => [...prev, `⚙️ Procesando ${facturas.length} facturas validadas...`]);

            const nitObligado = tenantConfig.nit || "900000000";
            const codPrestador = tenantConfig.codigoPrestador || "000000000001";

            if (!tenantConfig.nit) {
                setLogs(prev => [...prev, `⚠️ ADVERTENCIA: El NIT del obligado no está configurado en la empresa. Se usa valor por defecto.`]);
            }
            if (!tenantConfig.codigoPrestador) {
                setLogs(prev => [...prev, `⚠️ ADVERTENCIA: El Código REPS de Habilitación no está configurado. Se usa valor por defecto.`]);
            }

            // 3. Procesar cada documento -> RIPS JSON (Res. 2275)
            for (const f of facturas) {
                // Resolver ID y nombre del paciente desde distintos campos según la colección
                const pacId = f.pacienteId || f.patientId || f.paciente?.id || null;
                const pacNombre = f.pacienteNombre || f.patientName || f.paciente?.nombre || "DESCONOCIDO";
                const pacCedula = f.pacienteDocumento || f.paciente?.cedula || f.pacienteCedula || null;

                const pacienteData = (pacId && pacientesById[pacId])
                    || (pacCedula && pacientesByDoc[String(pacCedula).trim()])
                    || pacientesByName[pacNombre.toLowerCase()]
                    || null;

                const patientDoc = pacienteData?.nroDocumento || pacienteData?.cedula || pacienteData?.numDoc || pacCedula || "0";

                // Fecha normalizada del documento
                const fechaDoc = normalizeFecha(
                    f.fecha || f.fechaFactura || f.fechaCreacion || f.createdAt
                ) || new Date().toISOString().substring(0, 10);

                // Objeto Usuario (Res. 2275)
                const usuario = buildUsuarioJSON(pacienteData || {
                    tipoDoc: 'CC',
                    numDoc: patientDoc,
                    primerNombre: pacNombre
                });

                // Validaciones del paciente
                const userErrors = [];
                if (!pacienteData) {
                    userErrors.push("Paciente no encontrado en base de datos oficial");
                } else {
                    if (!pacienteData.fechaNacimiento) userErrors.push("Falta fecha de nacimiento");
                    if (!pacienteData.sexo && !pacienteData.genero) userErrors.push("Falta sexo/género");
                    if (!pacienteData.tipoDoc && !pacienteData.tipoDocumento) userErrors.push("Falta tipo de documento");
                }

                const userWithValidation = {
                    ...usuario,
                    nombreCompleto: pacienteData ? (pacienteData.nombreCompleto || `${pacienteData.nombres || ""} ${pacienteData.apellidos || ""}`.trim()) : f.pacienteNombre,
                    errors: userErrors
                };

                if (!userList.some(u => u.numDocumentoIdentificacion === userWithValidation.numDocumentoIdentificacion)) {
                    userList.push(userWithValidation);
                }

                // Partition Items en Consultas vs Procedimientos
                const invoiceConsultas = [];
                const invoiceProcedimientos = [];

                // Normalizar los ítems de servicio según la colección:
                // recibos_caja → conceptos[], facturas_electronicas → items[], facturas → items[]
                const rawItems = f.items || f.conceptos || f.servicios || [];
                const items = rawItems.length > 0
                    ? rawItems
                    : [{ concepto: f.concepto || f.descripcion || "Consulta Odontológica", total: f.total || f.valorTotal || f.valor || 0 }];

                items.forEach((item, idx) => {
                    const descText = item.desc || item.concepto || item.descripcion || "";
                    const smart = suggestClinicalCodes(descText);
                    const isConsulta = descText.toLowerCase().includes("consulta") || descText.toLowerCase().includes("valoracion");

                    const rowErrors = [];
                    if (!validateCIE10(smart.cie10)) rowErrors.push("Código CIE-10 no cumple estándar (ej. K021)");
                    if (!validateCUPS(smart.cups)) rowErrors.push("Código CUPS no cumple estándar (ej. 890201)");

                    const valorServ = Number(item.total || item.valor || item.precio || 0);

                    if (isConsulta) {
                        const consultaData = {
                            codPrestador: codPrestador,
                            fechaInicio: fechaDoc,
                            numAutorizacion: f.nroAutorizacion || f.autorizacion || null,
                            codConsulta: smart.cups,
                            dxPrincipal: smart.cie10,
                            tipoDx: "01",
                            valorServicio: valorServ,
                            codServicio: 345 // Odontología
                        };

                        conList.push({
                            ...consultaData,
                            docPaciente: patientDoc,
                            invoiceId: f.nroConsecutivo || f.numeroFactura || f.id.substring(0, 10),
                            errors: rowErrors
                        });

                        invoiceConsultas.push(buildConsultaJSON(consultaData, invoiceConsultas.length + 1));
                    } else {
                        const procData = {
                            codPrestador: codPrestador,
                            fechaProcedimiento: fechaDoc,
                            numAutorizacion: f.nroAutorizacion || f.autorizacion || null,
                            codProcedimiento: smart.cups,
                            dxPrincipal: smart.cie10,
                            tipoDx: "01",
                            valorServicio: valorServ,
                            codServicio: 345 // Odontología
                        };

                        procList.push({
                            ...procData,
                            docPaciente: patientDoc,
                            invoiceId: f.nroConsecutivo || f.numeroFactura || f.id.substring(0, 10),
                            errors: rowErrors
                        });

                        invoiceProcedimientos.push(buildProcedimientoJSON(procData, invoiceProcedimientos.length + 1));
                    }
                });

                // Validaciones de Factura
                const invoiceErrors = [];
                if (!fechaDoc) invoiceErrors.push("Falta fecha de documento");
                if (!pacNombre || pacNombre === 'DESCONOCIDO') invoiceErrors.push("Falta nombre de paciente");
                if (!tenantConfig.nit) invoiceErrors.push("Falta NIT de empresa emisora");

                const invoiceId = f.nroConsecutivo || f.numeroFactura || f.cufe?.substring(0, 12) || f.id.substring(0, 10);

                dianList.push({
                    id: invoiceId,
                    paciente: pacNombre,
                    cufe: f.cufe || f.cufeFactura || "SIN_CUFE",
                    errors: invoiceErrors
                });

                // Construcción de RIPS JSON oficial (Res. 2275)
                const ripsJson = buildRipsJSON({
                    nitObligado: nitObligado,
                    numeroFactura: invoiceId,
                    tipoNota: f.tipoNota || null,
                    numNota: f.numNota || null
                }, [usuario], invoiceConsultas, invoiceProcedimientos);

                const fileName = `${invoiceId}_RIPS.json`;
                const fileData = JSON.stringify(ripsJson, null, 2);

                const fileObj = {
                    name: fileName,
                    type: 'RIPS JSON (Res. 2275)',
                    size: fileData.length,
                    content: fileData,
                    fechaGeneracion: new Date().toISOString(),
                    inquilino: inquilino
                };

                newFiles.push(fileObj);

                try {
                    await addDoc(collection(db, "rips_generados"), {
                        ...fileObj,
                        fechaGeneracion: serverTimestamp()
                    });
                } catch (err) {
                    console.error("Error al guardar archivo RIPS en BD:", err);
                }
            }

            setGeneratedFiles(prev => {
                const combined = [...newFiles, ...prev];
                const unique = [];
                const seen = new Set();
                for (const file of combined) {
                    if (!seen.has(file.name)) {
                        seen.add(file.name);
                        unique.push(file);
                    }
                }
                return unique;
            });

            setDianDocs(dianList);
            setUsuarios(userList);
            setConsultas(conList);
            setProcedimientos(procList);
            setSearched(true);

            setLogs(prev => [...prev, `✅ Proceso finalizado. ${newFiles.length} archivos RIPS JSON (Res. 2275) generados exitosamente.`]);
            toast.success(`${newFiles.length} archivos RIPS JSON generados correctamente.`);

        } catch (error) {
            console.error("Error generando RIPS:", error);
            setLogs(prev => [...prev, `❌ Error: ${error.message}`]);
            toast.error("Ocurrió un error durante la generación de RIPS.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (file) => {
        const blob = new Blob([file.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadAll = () => {
        if (generatedFiles.length === 0) return;
        generatedFiles.forEach((file, index) => {
            setTimeout(() => {
                handleDownload(file);
            }, index * 250);
        });
        toast.info("Descargando lote de archivos RIPS JSON...");
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animation-fade-in-up font-sans text-slate-800 dark:text-slate-100 space-y-8">
            
            {/* Header & Breadcrumb */}
            <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    <span>Administración</span>
                    <FiChevronRight />
                    <span className="text-blue-500">RIPS JSON (Res. 2275)</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                            <FiActivity className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold font-display tracking-tight">Generador de RIPS JSON</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                                Registro Individual de Prestación de Servicios de Salud — Cumplimiento Resolución 2275 de 2023.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning Banner if Tenant Config is incomplete */}
            {configWarning && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <FiAlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Configuración Incompleta para RIPS</h4>
                            <p className="text-xs font-medium text-amber-700 mt-0.5">{configWarning}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(buildDashboardPath("config"))}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 shadow-sm"
                    >
                        <FiSettings size={14} /> Configurar Empresa
                    </button>
                </div>
            )}

            {/* Main configuration Form Card */}
            <div className="glass-panel p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.03)] rounded-2xl transition-all duration-300">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                    Parámetros de Generación de RIPS
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Fecha Inicial */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">
                            Fecha Inicial *
                        </label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.start} 
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-4 py-3 pl-10 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none transition-all duration-200"
                            />
                            <FiCalendar className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                        </div>
                    </div>

                    {/* Fecha Final */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">
                            Fecha Final *
                        </label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.end} 
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-4 py-3 pl-10 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none transition-all duration-200"
                            />
                            <FiCalendar className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                        </div>
                    </div>

                    {/* Sucursales */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">
                            Sucursales
                        </label>
                        <select 
                            value={selectedSucursal} 
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="w-full px-4 py-3 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none transition-all duration-200 cursor-pointer appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
                        >
                            <option value="">Todas las sedes...</option>
                            {sucursales.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre || 'Sede Principal'}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tercero (EPS/Aseguradora) */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">
                            Tercero (EPS / Aseguradora)
                        </label>
                        <select 
                            value={selectedEps} 
                            onChange={(e) => setSelectedEps(e.target.value)}
                            className="w-full px-4 py-3 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none transition-all duration-200 cursor-pointer appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
                        >
                            <option value="">Todos los terceros/EPS...</option>
                            {epsList.map(eps => (
                                <option key={eps} value={eps}>{eps}</option>
                            ))}
                        </select>
                    </div>

                    {/* Generar con (Radio Buttons) */}
                    <div className="md:col-span-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-3 block">
                            Generar con
                        </label>
                        <div className="flex flex-col sm:flex-row gap-6 mt-1 ml-1">
                            <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold">
                                <input 
                                    type="radio" 
                                    name="filterType"
                                    value="facturacion"
                                    checked={filterType === 'facturacion'}
                                    onChange={() => setFilterType('facturacion')}
                                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500/20"
                                />
                                <span className="text-slate-600 group-hover:text-slate-800 transition-colors">
                                    Filtro por fecha de facturación
                                </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold">
                                <input 
                                    type="radio" 
                                    name="filterType"
                                    value="realizado"
                                    checked={filterType === 'realizado'}
                                    onChange={() => setFilterType('realizado')}
                                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500/20"
                                />
                                <span className="text-slate-600 group-hover:text-slate-800 transition-colors">
                                    Filtro por fecha de realizado
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Search / Generate Button */}
                <div className="mt-8 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-6">
                    <button 
                        onClick={handleGenerate} 
                        disabled={loading || !dateRange.start || !dateRange.end}
                        className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg flex items-center gap-2.5 transition-all duration-300 text-white
                            ${loading || !dateRange.start || !dateRange.end 
                                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none' 
                                : 'bg-[#8cc33f] hover:bg-[#7db02b] active:scale-[0.98] shadow-[#8cc33f]/20'}`}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Procesando RIPS JSON Res. 2275...</span>
                            </>
                        ) : (
                            <>
                                <FiSearch className="w-4 h-4 stroke-[2.5]" />
                                <span>Buscar y Generar RIPS JSON</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Lower panel: Logs and Results */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Process Logs */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl h-80 flex flex-col">
                        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 mb-4">
                            Registro de Validación RIPS
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-1 text-xs font-mono text-slate-600 dark:text-slate-400 space-y-2">
                            {logs.length === 0 && (
                                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 italic">
                                    Esperando ejecución del proceso...
                                </div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className="pb-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 leading-relaxed">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Generated Results List */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-80 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                                Archivos Listos ({generatedFiles.length})
                            </h3>
                            {generatedFiles.length > 0 && (
                                <button
                                    onClick={handleDownloadAll}
                                    className="text-[11px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 transition-all"
                                >
                                    <FiDownload size={13} /> Descargar Lote
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {generatedFiles.length > 0 ? (
                                generatedFiles.map((file, idx) => (
                                    <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 hover:border-blue-400 dark:hover:border-blue-500/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                                                <FiFileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-700 dark:text-slate-300">{file.name}</div>
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                                                    {file.type} • {Math.round(file.size / 1024)} KB
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDownload(file)}
                                            className="px-4 py-2 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                        >
                                            <FiDownload className="w-3.5 h-3.5" />
                                            <span>Descargar JSON</span>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-center p-4">
                                    <FiFileText className="w-8 h-8 stroke-[1.5] mb-2 text-slate-300 dark:text-slate-700" />
                                    <p className="text-sm">Selecciona un rango de fechas y filtros para generar los archivos de RIPS.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Validation Previews */}
            {searched && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    
                    {/* Documentos DIAN */}
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Documentos DIAN & Factura</h3>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Total: {dianDocs.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-6 py-4 pl-8 w-24">Estado</th>
                                        <th className="px-6 py-4">Número de Factura</th>
                                        <th className="px-6 py-4">Paciente</th>
                                        <th className="px-6 py-4">Tipo Documento</th>
                                        <th className="px-6 py-4">CUFE</th>
                                        <th className="px-6 py-4">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                    {dianDocs.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-8 py-10 text-center text-slate-400 italic">Sin datos</td>
                                        </tr>
                                    ) : (
                                        dianDocs.map(doc => (
                                            <tr key={doc.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 pl-8">
                                                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${doc.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} title={doc.errors.join(", ") || "Validación Res. 2275 Exitosa"} />
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-800 uppercase tracking-tight">{doc.id}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500">{doc.paciente}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500">Factura Electrónica de Venta</td>
                                                <td className="px-6 py-4 font-mono text-xs text-slate-400">{doc.cufe}</td>
                                                <td className="px-6 py-4 text-xs font-semibold text-rose-500">
                                                    {doc.errors.length > 0 ? doc.errors.join("; ") : <span className="text-emerald-600 font-bold">Válido Res. 2275</span>}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50/80 px-8 py-3 border-t border-slate-100 flex gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <span>Validado correctamente: <strong className="text-emerald-600 font-black">{dianDocs.filter(d => d.errors.length === 0).length}</strong></span>
                            <span>Validado con observaciones: <strong className="text-rose-600 font-black">{dianDocs.filter(d => d.errors.length > 0).length}</strong></span>
                        </div>
                    </div>

                    {/* Usuarios */}
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Usuarios (Pacientes)</h3>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Total: {usuarios.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-6 py-4 pl-8 w-24">Estado</th>
                                        <th className="px-6 py-4">Tipo Identificación</th>
                                        <th className="px-6 py-4">Nro. Identificación</th>
                                        <th className="px-6 py-4">Nombres y Apellidos</th>
                                        <th className="px-6 py-4">Tipo Usuario</th>
                                        <th className="px-6 py-4">F. Nacimiento</th>
                                        <th className="px-6 py-4 text-center">Sexo</th>
                                        <th className="px-6 py-4 text-center">Incapacidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                    {usuarios.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-8 py-10 text-center text-slate-400 italic">Sin datos</td>
                                        </tr>
                                    ) : (
                                        usuarios.map((u, i) => (
                                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 pl-8">
                                                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${u.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} title={u.errors.join(", ") || "Válido"} />
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-500">{u.tipoDocumentoIdentificacion}</td>
                                                <td className="px-6 py-4 font-bold text-slate-800">{u.numDocumentoIdentificacion}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700 uppercase tracking-tight">{u.primerNombre} {u.segundoNombre} {u.primerApellido} {u.segundoApellido}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500">{u.tipoUsuario}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500 font-mono">{u.fechaNacimiento}</td>
                                                <td className="px-6 py-4 text-center font-bold text-slate-600">{u.codSexo}</td>
                                                <td className="px-6 py-4 text-center font-semibold text-slate-500 font-mono">{u.incapacidad}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50/80 px-8 py-3 border-t border-slate-100 flex gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <span>Validado correctamente: <strong className="text-emerald-600 font-black">{usuarios.filter(u => u.errors.length === 0).length}</strong></span>
                            <span>Validado con observaciones: <strong className="text-rose-600 font-black">{usuarios.filter(u => u.errors.length > 0).length}</strong></span>
                        </div>
                    </div>

                    {/* Consultas */}
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Servicios: Consultas</h3>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Total: {consultas.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-6 py-4 pl-8 w-24">Estado</th>
                                        <th className="px-6 py-4">Doc. Paciente</th>
                                        <th className="px-6 py-4">Factura</th>
                                        <th className="px-6 py-4">Cód. Prestador REPS</th>
                                        <th className="px-6 py-4">Fecha Consulta</th>
                                        <th className="px-6 py-4">Código CUPS</th>
                                        <th className="px-6 py-4">Dx Principal (CIE-10)</th>
                                        <th className="px-6 py-4 text-right pr-8">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                    {consultas.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-8 py-10 text-center text-slate-400 italic">Sin datos</td>
                                        </tr>
                                    ) : (
                                        consultas.map((c, i) => (
                                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 pl-8">
                                                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${c.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} title={c.errors.join(", ") || "Válido"} />
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-800">{c.docPaciente}</td>
                                                <td className="px-6 py-4 font-bold text-slate-500">{c.invoiceId}</td>
                                                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{c.codPrestador}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500 font-mono">{c.fechaInicio}</td>
                                                <td className="px-6 py-4 font-black text-blue-600 font-mono">{c.codConsulta}</td>
                                                <td className="px-6 py-4 font-black text-emerald-600 font-mono">{c.dxPrincipal}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 font-mono pr-8">{fmt(c.valorServicio)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Procedimientos */}
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Servicios: Procedimientos</h3>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Total: {procedimientos.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-6 py-4 pl-8 w-24">Estado</th>
                                        <th className="px-6 py-4">Doc. Paciente</th>
                                        <th className="px-6 py-4">Factura</th>
                                        <th className="px-6 py-4">Cód. Prestador REPS</th>
                                        <th className="px-6 py-4">Fecha Procedimiento</th>
                                        <th className="px-6 py-4">Código CUPS</th>
                                        <th className="px-6 py-4">Dx Principal (CIE-10)</th>
                                        <th className="px-6 py-4 text-right pr-8">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                    {procedimientos.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-8 py-10 text-center text-slate-400 italic">Sin datos</td>
                                        </tr>
                                    ) : (
                                        procedimientos.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 pl-8">
                                                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${p.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} title={p.errors.join(", ") || "Válido"} />
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-800">{p.docPaciente}</td>
                                                <td className="px-6 py-4 font-bold text-slate-500">{p.invoiceId}</td>
                                                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{p.codPrestador}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-500 font-mono">{p.fechaProcedimiento}</td>
                                                <td className="px-6 py-4 font-black text-blue-600 font-mono">{p.codProcedimiento}</td>
                                                <td className="px-6 py-4 font-black text-emerald-600 font-mono">{p.dxPrincipal}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 font-mono pr-8">{fmt(p.valorServicio)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
