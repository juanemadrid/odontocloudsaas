import React, { useState, useEffect } from 'react';
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import { formatNitForRips } from '../../utils/ripsValidators';
import {
    generateRipsV003,
    validateRipsV003,
    getCupsClassification,
} from './v003';
import {
    adaptClinicalDataToRipsV003
} from './v003/adapters/ripsV003ClinicalAdapter';
import { 
    FiActivity, FiCalendar, FiChevronRight, FiDownload, FiSearch, 
    FiFileText, FiAlertTriangle, FiCheckCircle, FiSettings, FiLayers,
    FiSend, FiRefreshCw, FiCopy, FiCheck, FiXCircle, FiInfo, FiClock
} from 'react-icons/fi';
import {
    transmitFevRips,
    formatMuvError,
    loadMuvValidationsMap,
    MUV_UI_STATES,
    MUV_ERROR_CATALOG
} from '../../services/muvService';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";

export default function RipsGenerator() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const inquilino = userProfile?.inquilino || "";

    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return {
            start: `${y}-${m}-01`,
            end: `${y}-${m}-${d}`
        };
    });
    const [loading, setLoading] = useState(false);
    const [generatedFiles, setGeneratedFiles] = useState([]);
    const [logs, setLogs] = useState([]);

    // Filtros dinámicos
    const [sucursales, setSucursales] = useState([]);
    const [epsList, setEpsList] = useState([]);
    const [selectedSucursal, setSelectedSucursal] = useState('');
    const [selectedEps, setSelectedEps] = useState('');
    const [searchTerceroQuery, setSearchTerceroQuery] = useState('');
    const [showTerceroDropdown, setShowTerceroDropdown] = useState(false);
    const [filterType, setFilterType] = useState('facturacion');

    // Dual Listbox: Facturas Disponibles vs Seleccionados 1:1 OralDrive
    const [availableInvoices, setAvailableInvoices] = useState([]);
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [checkedAvailable, setCheckedAvailable] = useState(new Set());
    const [checkedSelected, setCheckedSelected] = useState(new Set());

    // Acordeones y filtros de las 5 tablas 1:1 OralDrive
    const [openDian, setOpenDian] = useState(true);
    const [openUsuarios, setOpenUsuarios] = useState(true);
    const [openConsultas, setOpenConsultas] = useState(true);
    const [openProcedimientos, setOpenProcedimientos] = useState(true);
    const [openOtrosServicios, setOpenOtrosServicios] = useState(true);

    const [filterTextDian, setFilterTextDian] = useState('');
    const [filterTextUsuarios, setFilterTextUsuarios] = useState('');
    const [filterTextConsultas, setFilterTextConsultas] = useState('');
    const [filterTextProcedimientos, setFilterTextProcedimientos] = useState('');
    const [filterTextOtros, setFilterTextOtros] = useState('');

    const filteredTerceros = React.useMemo(() => {
        if (!searchTerceroQuery.trim()) return epsList;
        const q = searchTerceroQuery.toLowerCase().trim();
        return epsList.filter(t => 
            (t.label || '').toLowerCase().includes(q) || 
            (t.value || '').toLowerCase().includes(q) || 
            (t.doc && t.doc.toLowerCase().includes(q))
        );
    }, [epsList, searchTerceroQuery]);

    // Transfer list handlers
    const handleTransferAllRight = () => {
        setSelectedInvoices(prev => [...prev, ...availableInvoices]);
        setAvailableInvoices([]);
        setCheckedAvailable(new Set());
    };

    const handleTransferSelectedRight = () => {
        const toMove = availableInvoices.filter(i => checkedAvailable.has(`${i._coleccion}::${i.id}`));
        const remaining = availableInvoices.filter(i => !checkedAvailable.has(`${i._coleccion}::${i.id}`));
        setSelectedInvoices(prev => [...prev, ...toMove]);
        setAvailableInvoices(remaining);
        setCheckedAvailable(new Set());
    };

    const handleTransferSelectedLeft = () => {
        const toMove = selectedInvoices.filter(i => checkedSelected.has(`${i._coleccion}::${i.id}`));
        const remaining = selectedInvoices.filter(i => !checkedSelected.has(`${i._coleccion}::${i.id}`));
        setAvailableInvoices(prev => [...prev, ...toMove]);
        setSelectedInvoices(remaining);
        setCheckedSelected(new Set());
    };

    const handleTransferAllLeft = () => {
        setAvailableInvoices(prev => [...prev, ...selectedInvoices]);
        setSelectedInvoices([]);
        setCheckedSelected(new Set());
    };

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
    const [otrosServicios, setOtrosServicios] = useState([]);
    const [searched, setSearched] = useState(false);

    // Estado Preflight RIPS v003
    const [preflightStatus, setPreflightStatus] = useState(null); // null | 'VALIDATING' | 'READY' | 'HAS_ERRORS'
    const [preflightSummary, setPreflightSummary] = useState({ total: 0, valid: 0, error: 0, totalErrors: 0 });
    const [preflightValidationMap, setPreflightValidationMap] = useState(new Map());

    // Estado MUV e Idempotencia (P0-A2B2)
    const [transmittingMuv, setTransmittingMuv] = useState(false);
    const [muvValidationsMap, setMuvValidationsMap] = useState(new Map());
    const [copiedCuv, setCopiedCuv] = useState(null);
    const [detailModalData, setDetailModalData] = useState(null);

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
                const [tenantRes, cfgRes] = await Promise.all([
                    supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
                    supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle()
                ]);

                const tenantData = tenantRes.data || {};
                const cfg = cfgRes.data?.config || {};
                const extraEmpresa = cfg.empresa_datos || cfg.empresa || {};
                const privateSispro = cfg.sispro_config || {};

                const rawNit = tenantData.nit || extraEmpresa.nit || privateSispro.sisproUsuario || "64576359";
                const nitClean = formatNitForRips(rawNit);
                
                const codPrestador = String(
                    tenantData.codigoPrestador || 
                    privateSispro.codigoPrestador || 
                    extraEmpresa.codigoPrestador || 
                    cfg.codigoPrestador || 
                    "7000101657"
                ).trim();

                const rSocial = tenantData.razonSocial || tenantData.nombre || tenantData.name || extraEmpresa.razonSocial || extraEmpresa.nombreComercial || "ATM CENTRO DEL DOLOR OROFACIAL";

                setTenantConfig({
                    nit: nitClean,
                    codigoPrestador: codPrestador,
                    razonSocial: rSocial,
                    esIps: tenantData.esIps ?? extraEmpresa.esIps ?? true
                });

                let warningMsg = "";
                if (!nitClean) warningMsg += "Falta configurar el NIT de la empresa. ";
                if (!codPrestador || codPrestador.length < 10) warningMsg += "Falta o es inválido el Código de Habilitación de Prestador (REPS). ";

                setConfigWarning(warningMsg);
            } catch (e) {
                console.error("Error al cargar configuración de la empresa:", e);
            }
        };

        const loadHistory = async () => {
            try {
                let files = [];
                try {
                    const { data } = await supabase
                        .from("rips_generados")
                        .select("*")
                        .eq("tenant_id", inquilino)
                        .order("created_at", { ascending: false });
                    if (data && data.length > 0) files = data;
                } catch (e) {}

                if (files.length === 0) {
                    const { data: cfgRow } = await supabase
                        .from("website_config")
                        .select("config")
                        .eq("tenant_id", inquilino)
                        .maybeSingle();
                    files = cfgRow?.config?.rips_generados || [];
                }

                setGeneratedFiles(files);
            } catch (e) {
                console.error("Error al cargar historial RIPS:", e);
            }
        };
        
        const loadMetadata = async () => {
            try {
                const [snapS, snapTerceros, snapCfg, snapPacientes, snapE, snapProfiles] = await Promise.all([
                    supabase.from("sucursales").select("*").eq("tenant_id", inquilino),
                    supabase.from("terceros").select("*").eq("tenant_id", inquilino),
                    supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle(),
                    supabase.from("pacientes").select("*").eq("tenant_id", inquilino),
                    supabase.from("eps_catalogo").select("nombre").eq("tenant_id", inquilino),
                    supabase.from("profiles").select("*").eq("tenant_id", inquilino)
                ]);

                setSucursales(snapS.data || []);

                const uniqueTercerosMap = new Map();

                // 1. Pacientes de la clínica (prioridad alta: Nombre Completo - Documento)
                (snapPacientes.data || []).forEach(p => {
                    const name = (`${p.nombres || p.nombre || ""} ${p.apellidos || ""}`).trim() || p.nombreCompleto || "";
                    const doc = String(p.documento || p.nroDocumento || p.numero_documento || p.cedula || "").trim();
                    if (name) {
                        const formattedDoc = doc ? ` - ${doc}` : "";
                        const fullLabel = `${name}${formattedDoc}`;
                        uniqueTercerosMap.set(`PACIENTE_${p.id || doc || name.toUpperCase()}`, { 
                            label: fullLabel, 
                            value: name, 
                            nombre: name,
                            doc: doc,
                            tipo: "Paciente"
                        });
                    }
                });

                // 2. Terceros creados en la tabla terceros
                (snapTerceros.data || []).forEach(t => {
                    const name = t.razonSocial || `${t.nombre || ""} ${t.apellidos || ""}`.trim() || t.nombre;
                    if (name) {
                        const doc = t.nroDocumento ? ` - ${t.nroDocumento}` : "";
                        uniqueTercerosMap.set(`TERCERO_${name.trim().toUpperCase()}`, { 
                            label: `${name.trim()}${doc}`, 
                            value: name.trim(), 
                            doc: t.nroDocumento || "",
                            tipo: "Tercero"
                        });
                    }
                });

                // 3. Terceros en website_config
                const cfgTerceros = snapCfg.data?.config?.terceros || [];
                cfgTerceros.forEach(t => {
                    const name = t.razonSocial || `${t.nombre || ""} ${t.apellidos || ""}`.trim() || t.nombre;
                    if (name && !uniqueTercerosMap.has(`TERCERO_${name.trim().toUpperCase()}`)) {
                        const doc = t.nroDocumento ? ` - ${t.nroDocumento}` : "";
                        uniqueTercerosMap.set(`TERCERO_${name.trim().toUpperCase()}`, { 
                            label: `${name.trim()}${doc}`, 
                            value: name.trim(), 
                            doc: t.nroDocumento || "",
                            tipo: "Tercero"
                        });
                    }
                });

                // 4. Catálogo EPS
                (snapE.data || []).forEach(doc => {
                    const name = doc.nombre?.trim();
                    if (name && !uniqueTercerosMap.has(`EPS_${name.toUpperCase()}`)) {
                        uniqueTercerosMap.set(`EPS_${name.toUpperCase()}`, { 
                            label: name, 
                            value: name, 
                            doc: "",
                            tipo: "EPS"
                        });
                    }
                });

                // 5. Usuarios / Personal
                (snapProfiles.data || []).forEach(u => {
                    const name = (u.nombreCompleto || u.nombre || u.full_name || u.email || "").trim();
                    if (name && !uniqueTercerosMap.has(`USER_${name.toUpperCase()}`)) {
                        uniqueTercerosMap.set(`USER_${name.toUpperCase()}`, {
                            label: name,
                            value: name,
                            doc: "",
                            tipo: "Usuario"
                        });
                    }
                });

                const sortedTerceros = Array.from(uniqueTercerosMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                setEpsList(sortedTerceros);
            } catch (e) {
                console.error("Error al cargar metadatos RIPS:", e);
            }
        };

        loadTenantConfig();
        loadHistory();
        loadMetadata();
    }, [inquilino]);

    // Auto-cargar facturas disponibles según filtros para el Dual Listbox
    useEffect(() => {
        const fetchAvailable = async () => {
            if (!inquilino || !dateRange.start || !dateRange.end) {
                setAvailableInvoices([]);
                setSelectedInvoices([]);
                return;
            }

            try {
                const inRange = (docData) => {
                    const raw = filterType === 'facturacion'
                        ? (docData.fecha || docData.fechaFactura || docData.fechaCreacion || docData.createdAt)
                        : (docData.fechaRealizado || docData.fechaServicio || docData.fecha || docData.createdAt);
                    const fechaDoc = normalizeFecha(raw);
                    if (!fechaDoc) return false;
                    return fechaDoc >= dateRange.start && fechaDoc <= dateRange.end;
                };

                const colecciones = [
                    { nombre: "recibos_caja", tipoDoc: "Recibo de Caja" },
                    { nombre: "facturas", tipoDoc: "Factura" },
                    { nombre: "facturas_electronicas", tipoDoc: "Factura Electrónica" },
                    { nombre: "facturas_venta", tipoDoc: "Factura de Venta" },
                    { nombre: "pagos", tipoDoc: "Pago" },
                ];

                const snapshots = await Promise.all(
                    colecciones.map(({ nombre }) =>
                        supabase.from(nombre).select("*").eq("tenant_id", inquilino)
                            .then(res => res.data || [])
                            .catch(() => [])
                    )
                );

                let docs = [];
                snapshots.forEach((colDocs, i) => {
                    const mapped = colDocs
                        .map(d => ({ _coleccion: colecciones[i].nombre, _tipoDoc: colecciones[i].tipoDoc, ...d }))
                        .filter(inRange);
                    docs.push(...mapped);
                });

                // Deduplicar
                const seen = new Set();
                let allDocs = docs.filter(f => {
                    const key = `${f._coleccion}::${f.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                // Filtro por Tercero / Paciente
                if (selectedEps) {
                    const selUpper = selectedEps.trim().toUpperCase();
                    allDocs = allDocs.filter(f => {
                        const fCliente = (f.cliente || f.nombreTercero || f.tercero || f.pacienteNombre || f.paciente || "").trim().toUpperCase();
                        const fDoc = String(f.pacienteDocumento || f.nit || f.nroDocumento || f.documento || "").trim();
                        return (fCliente && (fCliente.includes(selUpper) || selUpper.includes(fCliente))) ||
                               (fDoc && (selUpper.includes(fDoc) || fDoc === selUpper));
                    });
                }

                setAvailableInvoices(allDocs);
                setSelectedInvoices([]);
                setCheckedAvailable(new Set());
                setCheckedSelected(new Set());
            } catch (e) {
                console.error("Error al cargar facturas disponibles:", e);
            }
        };

        fetchAvailable();
    }, [inquilino, dateRange.start, dateRange.end, selectedEps, selectedSucursal, filterType]);

    // Normaliza cualquier campo de fecha (Timestamp, Date, string YYYY-MM-DD) a string "YYYY-MM-DD"
    const normalizeFecha = (val) => {
        if (!val) return null;
        // Timestamp normalizado
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

    // ─────────────────────────────────────────────────────────────
    // HELPERS DE NORMALIZACIÓN CLÍNICA NORMATIVA RIPS v003
    // ─────────────────────────────────────────────────────────────

    const mapModalidadRips = (mod) => {
        if (!mod) return "01";
        const s = String(mod).toLowerCase().trim();
        if (s.includes("extra") || s.includes("domicil")) return "03";
        if (s.includes("movil") || s.includes("móvil")) return "02";
        if (s.includes("tele") || s.includes("virtual")) return "04";
        return "01";
    };

    const mapFinalidadRips = (fin, isConsulta = false) => {
        if (!fin) return isConsulta ? "10" : "02";
        const s = String(fin).toLowerCase().trim();
        if (s.includes("diag") || s === "10" || s === "01") return isConsulta ? "10" : "01";
        if (s.includes("terap") || s === "11" || s === "02") return isConsulta ? "11" : "02";
        if (s.includes("protec") || s === "16" || s === "03") return isConsulta ? "16" : "03";
        if (s.includes("detec") || s === "04") return isConsulta ? "10" : "04";
        return isConsulta ? "10" : "02";
    };

    const formatDateTimeRips = (val) => {
        if (!val) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            return `${y}-${m}-${d} 08:00`;
        }
        if (typeof val === 'string') {
            const s = val.trim();
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s;
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
                return s.replace('T', ' ').substring(0, 16);
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                return `${s} 08:00`;
            }
        }
        try {
            const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const h = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                return `${y}-${m}-${day} ${h}:${min}`;
            }
        } catch (_) {}
        return `${new Date().toISOString().substring(0, 10)} 08:00`;
    };

    const resolveDoctorInfo = (docIdOrName, profilesList = [], tenantCfg = {}) => {
        const defaultDocType = "CC";
        const defaultDocNum = String(tenantCfg?.nit || "64576359").replace(/\D/g, "");
        if (!docIdOrName) {
            return {
                tipoDocumentoIdentificacion: defaultDocType,
                numDocumentoIdentificacion: defaultDocNum,
            };
        }
        const target = String(docIdOrName).trim().toLowerCase();
        const profMatch = profilesList.find(p => 
            String(p.id).toLowerCase() === target ||
            String(p.full_name || p.nombreCompleto || '').toLowerCase().includes(target) ||
            target.includes(String(p.full_name || p.nombreCompleto || '').toLowerCase())
        );
        if (profMatch) {
            const docNum = String(profMatch.documento || profMatch.cedula || profMatch.nroDocumento || profMatch.identificacion || profMatch.registro_medico || defaultDocNum).replace(/\D/g, "");
            const docType = String(profMatch.tipoDocumento || profMatch.tipoDoc || defaultDocType).toUpperCase().trim();
            const validTypes = ["CC", "CE", "CD", "PA", "SC", "PE", "DE", "PT"];
            return {
                tipoDocumentoIdentificacion: validTypes.includes(docType) ? docType : defaultDocType,
                numDocumentoIdentificacion: docNum || defaultDocNum,
            };
        }
        return {
            tipoDocumentoIdentificacion: defaultDocType,
            numDocumentoIdentificacion: defaultDocNum,
        };
    };

    // ─────────────────────────────────────────────────────────────
    // MOTOR PREFLIGHT V003 CON FUENTES CLÍNICAS REALES
    // ─────────────────────────────────────────────────────────────

    const handleGenerate = async () => {
        setSearched(true);
        setLoading(true);
        setLogs([]);
        setPreflightStatus("VALIDATING");

        const dianList = [];
        const userList = [];
        const conList = [];
        const procList = [];
        const otrosList = [];

        const validationMap = new Map();
        let totalValidFacturas = 0;
        let totalErrorFacturas = 0;
        let cumulativeErrorsCount = 0;

        try {
            setLogs(prev => [...prev, `🔍 Iniciando validación preflight con fuentes clínicas reales...`]);

            // 1. Filtrar facturas a procesar
            let facturas = [];
            if (selectedInvoices.length > 0) {
                facturas = [...selectedInvoices];
                setLogs(prev => [...prev, `📋 Procesando ${facturas.length} facturas seleccionadas en la lista`]);
            } else {
                const inRange = (docData) => {
                    if (!dateRange.start || !dateRange.end) return true;
                    const raw = filterType === 'facturacion'
                        ? (docData.fecha || docData.fechaFactura || docData.fechaCreacion || docData.createdAt)
                        : (docData.fechaRealizado || docData.fechaServicio || docData.fecha || docData.createdAt);
                    const fechaDoc = normalizeFecha(raw);
                    if (!fechaDoc) return false;
                    return fechaDoc >= dateRange.start && fechaDoc <= dateRange.end;
                };

                const colecciones = [
                    { nombre: "recibos_caja",         tipoDoc: "Recibo de Caja" },
                    { nombre: "facturas",              tipoDoc: "Factura" },
                    { nombre: "facturas_electronicas", tipoDoc: "Factura Electrónica" },
                    { nombre: "facturas_venta",        tipoDoc: "Factura de Venta" },
                    { nombre: "pagos",                 tipoDoc: "Pago" },
                ];

                const snapshots = await Promise.all(
                    colecciones.map(({ nombre }) =>
                        supabase.from(nombre).select("*").eq("tenant_id", inquilino)
                            .then(res => res.data || [])
                            .catch(() => [])
                    )
                );

                snapshots.forEach((docs, i) => {
                    const mapped = docs
                        .map(d => ({ _coleccion: colecciones[i].nombre, _tipoDoc: colecciones[i].tipoDoc, ...d }))
                        .filter(inRange);
                    facturas.push(...mapped);
                });

                // Deduplicar por id
                const seen = new Set();
                facturas = facturas.filter(f => {
                    const key = `${f._coleccion}::${f.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }

            if (facturas.length === 0) {
                setDianDocs([]);
                setUsuarios([]);
                setConsultas([]);
                setProcedimientos([]);
                setOtrosServicios([]);
                setPreflightStatus(null);
                setLogs(prev => [...prev, `ℹ️ Sin facturas encontradas para los filtros seleccionados.`]);
                setLoading(false);
                return;
            }

            // 2. Cargar contexto clínico en lote (Pacientes, Listas de Precios, Documentos Clínicos, Evoluciones, Planes, Perfiles)
            setLogs(prev => [...prev, `📂 Cargando registros clínicos reales (evoluciones, doc. clínicos, planes, tarifario)...`]);
            
            const [
                snapPacientes,
                snapListas,
                snapDocClinicos,
                snapEvoluciones,
                snapPlanes,
                snapProfiles
            ] = await Promise.all([
                supabase.from("pacientes").select("*").eq("tenant_id", inquilino),
                supabase.from("listas_precios").select("*").eq("tenant_id", inquilino),
                supabase.from("documentos_clinicos").select("*").eq("tenant_id", inquilino),
                supabase.from("evoluciones").select("*").eq("tenant_id", inquilino),
                supabase.from("treatment_plans").select("*").eq("tenant_id", inquilino),
                supabase.from("profiles").select("*").eq("tenant_id", inquilino)
            ]);

            const pacientesList = snapPacientes.data || [];
            const listasPrecios = snapListas.data || [];
            const docClinicosList = snapDocClinicos.data || [];
            const evolucionesList = snapEvoluciones.data || [];
            const planesList = snapPlanes.data || [];
            const profilesList = snapProfiles.data || [];

            // Mapas de búsqueda rápida
            const pacientesById = new Map();
            const pacientesByDoc = new Map();
            const pacientesByName = new Map();

            pacientesList.forEach(p => {
                pacientesById.set(p.id, p);
                const doc = String(p.documento || p.nroDocumento || p.cedula || p.numDoc || "").trim();
                if (doc) pacientesByDoc.set(doc, p);
                const name = (`${p.nombres || p.nombre || ""} ${p.apellidos || ""}`).trim().toLowerCase() || (p.nombreCompleto || "").toLowerCase();
                if (name) pacientesByName.set(name, p);
            });

            // Catálogo unificado de listas de precios (nombre / código -> ítem de tarifario)
            const catalogMap = new Map();
            listasPrecios.forEach(lp => {
                let pItems = [];
                try {
                    pItems = typeof lp.descripcion === "string" ? JSON.parse(lp.descripcion) : (lp.descripcion || []);
                } catch (_) {}
                if (Array.isArray(pItems)) {
                    pItems.forEach(it => {
                        if (it.codigo) catalogMap.set(String(it.codigo).trim().toUpperCase(), it);
                        if (it.nombre) catalogMap.set(String(it.nombre).trim().toUpperCase(), it);
                    });
                }
            });

            // Agrupar documentos clínicos por paciente
            const docClinicosByPatient = new Map();
            docClinicosList.forEach(dc => {
                const pId = dc.paciente_id || dc.pacienteId;
                if (!pId) return;
                if (!docClinicosByPatient.has(pId)) docClinicosByPatient.set(pId, []);
                docClinicosByPatient.get(pId).push(dc);
            });

            // Agrupar evoluciones por paciente (parseando tratamiento)
            const evolucionesByPatient = new Map();
            evolucionesList.forEach(evo => {
                const pId = evo.paciente_id;
                if (!pId) return;
                let tData = {};
                try {
                    tData = typeof evo.tratamiento === "string" ? JSON.parse(evo.tratamiento) : (evo.tratamiento || {});
                } catch (_) {}
                const parsedEvo = { ...evo, _tData: tData };
                if (!evolucionesByPatient.has(pId)) evolucionesByPatient.set(pId, []);
                evolucionesByPatient.get(pId).push(parsedEvo);
            });

            // Agrupar planes de tratamiento por paciente
            const planesByPatient = new Map();
            planesList.forEach(pl => {
                const pId = pl.paciente_id;
                if (!pId) return;
                let itemsArr = [];
                if (Array.isArray(pl.items)) itemsArr = pl.items;
                else if (Array.isArray(pl.detalles?.items)) itemsArr = pl.detalles.items;
                if (!planesByPatient.has(pId)) planesByPatient.set(pId, []);
                planesByPatient.get(pId).push({ ...pl, _items: itemsArr });
            });

            const nitObligado = tenantConfig.nit || "900000000";
            const codPrestador = tenantConfig.codigoPrestador || "000000000001";

            // 3. Procesar cada factura contra las fuentes clínicas reales
            for (const f of facturas) {
                const pacId = f.pacienteId || f.patientId || f.paciente?.id || null;
                const pacNombre = f.pacienteNombre || f.patientName || f.paciente?.nombre || "DESCONOCIDO";
                const pacCedula = f.pacienteDocumento || f.paciente?.cedula || f.pacienteCedula || null;

                const pacienteData = (pacId && pacientesById.get(pacId))
                    || (pacCedula && pacientesByDoc.get(String(pacCedula).trim()))
                    || pacientesByName.get(pacNombre.toLowerCase())
                    || null;

                const patientDoc = pacienteData?.nroDocumento || pacienteData?.cedula || pacienteData?.numDoc || pacCedula || "0";
                const invoiceId = f.nroConsecutivo || f.numeroFactura || f.cufe?.substring(0, 12) || f.id.substring(0, 10);
                const fechaDoc = normalizeFecha(f.fecha || f.fechaFactura || f.fechaCreacion || f.createdAt) || new Date().toISOString().substring(0, 10);

                const invoiceErrors = [];
                if (!pacienteData) invoiceErrors.push("Paciente no encontrado en base de datos oficial");
                if (!tenantConfig.nit) invoiceErrors.push("Falta NIT de empresa emisora");
                if (!codPrestador || codPrestador.length < 10) invoiceErrors.push("Código REPS inválido o ausente");

                // Datos demográficos canónicos del paciente
                const rawSexo = String(pacienteData?.sexo || pacienteData?.genero || pacienteData?.codSexo || "").trim().toUpperCase();
                let codSexo = "";
                if (rawSexo === "M" || rawSexo === "MASCULINO" || rawSexo === "HOMBRE" || rawSexo === "H") codSexo = "M";
                else if (rawSexo === "F" || rawSexo === "FEMENINO" || rawSexo === "MUJER") codSexo = "F";
                else if (rawSexo === "I" || rawSexo === "INDETERMINADO") codSexo = "I";

                const rawTipoUsuario = String(pacienteData?.tipoUsuario || pacienteData?.tipo_usuario || "12").trim().padStart(2, "0");
                const rawMunicipio = String(pacienteData?.codMunicipioResidencia || pacienteData?.codigoMunicipio || "70001").trim();
                const rawZona = String(pacienteData?.codZonaTerritorialResidencia || (pacienteData?.zona === "Rural" ? "02" : "01")).trim().padStart(2, "0");
                const rawIncapacidad = pacienteData?.incapacidad !== undefined ? (pacienteData.incapacidad ? "01" : "02") : "02";

                const patientErrors = [];
                if (!pacienteData?.fechaNacimiento && !pacienteData?.fecha_nacimiento) patientErrors.push("Falta fecha de nacimiento del paciente");
                if (!codSexo) patientErrors.push("Falta o es inválido el sexo/género del paciente (permitidos: M, F, I)");
                if (!/^\d{5}$/.test(rawMunicipio)) patientErrors.push("Código DIVIPOLA de municipio inválido (debe tener 5 dígitos)");

                const usuarioWithValidation = {
                    numDocumentoIdentificacion: patientDoc,
                    tipoDocumentoIdentificacion: String(pacienteData?.tipoDoc || pacienteData?.tipoDocumento || "CC").toUpperCase(),
                    tipoUsuario: rawTipoUsuario,
                    fechaNacimiento: normalizeFecha(pacienteData?.fechaNacimiento || pacienteData?.fecha_nacimiento) || "",
                    codSexo,
                    codPaisResidencia: "170",
                    codMunicipioResidencia: rawMunicipio,
                    codZonaTerritorialResidencia: rawZona,
                    incapacidad: rawIncapacidad,
                    nombreCompleto: pacienteData ? (pacienteData.nombreCompleto || `${pacienteData.nombres || ""} ${pacienteData.apellidos || ""}`.trim()) : pacNombre,
                    errors: patientErrors
                };

                if (!userList.some(u => u.numDocumentoIdentificacion === usuarioWithValidation.numDocumentoIdentificacion)) {
                    userList.push(usuarioWithValidation);
                }

                // Resolver atenciones clínicas reales para cada ítem facturado
                const rawItems = f.items || f.conceptos || f.servicios || [];
                const invoiceItems = rawItems.length > 0
                    ? rawItems
                    : [{ concepto: f.concepto || f.descripcion || "Consulta Odontológica", total: f.total || f.valorTotal || f.valor || 0 }];

                const adaptedAtencionesForInvoice = [];
                const effectivePacId = pacienteData?.id || pacId;
                const patientConsultas = effectivePacId ? (docClinicosByPatient.get(effectivePacId) || []) : [];
                const patientEvoluciones = effectivePacId ? (evolucionesByPatient.get(effectivePacId) || []) : [];
                const patientPlanes = effectivePacId ? (planesByPatient.get(effectivePacId) || []) : [];

                for (let i = 0; i < invoiceItems.length; i++) {
                    const item = invoiceItems[i];
                    const descText = String(item.descripcion || item.concepto || item.desc || item.nombre || "").trim();
                    const upperDesc = descText.toUpperCase();
                    const rawCupsCandidate = String(item.codigo || item.code || item.codigo_cups || "").trim().toUpperCase();

                    // Buscar en catálogo
                    const catalogItem = catalogMap.get(rawCupsCandidate) || catalogMap.get(upperDesc) || null;
                    if (catalogItem && catalogItem.genera_rips === false) {
                        continue;
                    }

                    const explicitCups = rawCupsCandidate || catalogItem?.codigo || "";
                    const isOtroServicio = Boolean(
                        item.es_otro_servicio ||
                        catalogItem?.es_otro_servicio ||
                        catalogItem?.tipo_servicio === "otrosServicios" ||
                        item.tipoOS
                    );
                    const isConsulta = !isOtroServicio && Boolean(
                        item.es_consulta ||
                        catalogItem?.es_consulta ||
                        item.asocConsultaId ||
                        (explicitCups && explicitCups.startsWith("890"))
                    );

                    const valorServ = Number(item.total || item.valor || item.precio || item.precioUnitario || 0);
                    const itemErrors = [];

                    if (isOtroServicio) {
                        // ── FLUJO OTROS SERVICIOS (Fuente: insumos / contrataciones DT1 v003) ──
                        const profObj = resolveDoctorInfo(null, profilesList, tenantConfig);
                        const fechaAtencion = formatDateTimeRips(item.fecha || fechaDoc);
                        const tipoOS = String(item.tipoOS || catalogItem?.tipoOS || "01").padStart(2, "0");
                        const cantidadOS = Number(item.cantidad || 1);
                        const codTec = explicitCups || item.codigo || item.codigo_cups || "INS001";
                        const nomTec = descText.substring(0, 200) || "Insumo o Tecnologia en Salud";

                        if (!["01", "02", "03", "04", "05"].includes(tipoOS)) {
                            itemErrors.push(`INVALID_TIPO_OS: tipoOS '${tipoOS}' no es válido según DT1 v003`);
                        }
                        if (cantidadOS <= 0) {
                            itemErrors.push("INVALID_NUMERIC_DATA: cantidadOS debe ser un entero mayor a 0");
                        }

                        const osRow = {
                            docPaciente: patientDoc,
                            invoiceId,
                            codPrestador,
                            fechaSuministroTecnologia: fechaAtencion,
                            numAutorizacion: f.nroAutorizacion || f.autorizacion || null,
                            idMIPRES: null,
                            fechaDispensacionAdmon: null,
                            codTecnologiaSalud: codTec,
                            nomTecnologiaSalud: nomTec,
                            tipoOS,
                            cantidadOS,
                            tipoDocumentoIdentificacion: profObj.tipoDocumentoIdentificacion,
                            numDocumentoIdentificacion: profObj.numDocumentoIdentificacion,
                            vrUnitOS: valorServ,
                            vrDispensacion: 0,
                            vrServicio: valorServ * cantidadOS,
                            conceptoRecaudo: "05",
                            valorPagoModerador: 0,
                            numFEVPagoModerador: null,
                            errors: itemErrors
                        };
                        otrosList.push(osRow);

                        if (itemErrors.length === 0) {
                            adaptedAtencionesForInvoice.push({
                                tipoAtencion: "otrosServicios",
                                tipoOS,
                                codTecnologiaSalud: codTec,
                                nomTecnologiaSalud: nomTec,
                                cantidadOS,
                                fechaSuministroTecnologia: fechaAtencion,
                                vrUnitOS: valorServ,
                                vrDispensacion: 0,
                                vrServicio: valorServ * cantidadOS,
                                conceptoRecaudo: "05",
                                valorPagoModerador: 0,
                                profesional: profObj
                            });
                        }

                    } else if (isConsulta) {
                        // ── FLUJO CONSULTAS (Fuente: documentos_clinicos) ──
                        let matchedDoc = null;
                        if (item.asocConsultaId) {
                            matchedDoc = patientConsultas.find(d => d.id === item.asocConsultaId || d.legacy_id === item.asocConsultaId);
                        }
                        if (!matchedDoc && explicitCups) {
                            matchedDoc = patientConsultas.find(d => 
                                (d.tipo === "Consulta" || d.tipoDocumento === "Consulta") &&
                                (d.metadata?.cups === explicitCups || d.metadata?.codigo_cups === explicitCups)
                            );
                        }
                        if (!matchedDoc) {
                            matchedDoc = patientConsultas.find(d => (d.tipo === "Consulta" || d.tipoDocumento === "Consulta"));
                        }

                        if (!matchedDoc) {
                            itemErrors.push(`RIPS_CLINICAL_SOURCE_NOT_FOUND: Ítem de consulta '${descText}' sin registro de consulta médica realizada en 'Doc. Clínicos'`);
                        }

                        const docMeta = matchedDoc?.metadata || {};
                        const docCups = docMeta.cups || docMeta.codigo_cups || explicitCups;
                        if (!docCups || docCups.length !== 6) {
                            itemErrors.push("INVALID_CUPS_CODE: Código CUPS de consulta ausente o inválido (debe tener 6 caracteres)");
                        }

                        // Diagnóstico CIE-10 real
                        const rawDxPrincipal = docMeta.dxPrincipalConsulta?.code || docMeta.dxPrincipalConsulta || docMeta.dxPrincipal?.code || docMeta.dxPrincipal || "";
                        const codDxPrincipal = String(rawDxPrincipal).trim().toUpperCase();
                        if (!codDxPrincipal || !/^[A-Z][0-9]{2}[0-9A-Z]?$/.test(codDxPrincipal)) {
                            itemErrors.push(`MISSING_REQUIRED_DATA: Diagnóstico principal CIE-10 ausente o inválido en la consulta de Doc. Clínicos (${codDxPrincipal || 'vacío'})`);
                        }

                        const dxRelArray = Array.isArray(docMeta.dxRelacionadosConsulta) ? docMeta.dxRelacionadosConsulta : [];
                        const codDxRel1 = dxRelArray[0]?.code || dxRelArray[0] || null;

                        const profObj = resolveDoctorInfo(matchedDoc?.profesional_id || docMeta.profesionalNombre, profilesList, tenantConfig);
                        const fechaAtencion = formatDateTimeRips(matchedDoc?.fecha || matchedDoc?.created_at || fechaDoc);

                        const consultaRow = {
                            docPaciente: patientDoc,
                            invoiceId,
                            codPrestador,
                            fechaInicio: fechaAtencion,
                            numAutorizacion: f.nroAutorizacion || f.autorizacion || null,
                            codConsulta: docCups || "SIN_CUPS",
                            modalidadGrupoServicioTecSal: docMeta.modalidad || "01",
                            grupoServicios: "01",
                            codServicio: 334,
                            finalidadTecnologiaSalud: docMeta.finalidad || "10",
                            causaMotivoAtencion: docMeta.causaMotivoAtencion || "38",
                            dxPrincipal: codDxPrincipal || "SIN_DX",
                            codDiagnosticoRelacionado1: codDxRel1,
                            tipoDiagnosticoPrincipal: docMeta.tipoDiagnosticoPrincipal || "01",
                            tipoDocumentoIdentificacion: profObj.tipoDocumentoIdentificacion,
                            numDocumentoIdentificacion: profObj.numDocumentoIdentificacion,
                            valorServicio: valorServ,
                            conceptoRecaudo: "05",
                            valorPagoModerador: 0,
                            numFEVPagoModerador: null,
                            errors: itemErrors
                        };

                        conList.push(consultaRow);

                        if (itemErrors.length === 0) {
                            adaptedAtencionesForInvoice.push({
                                tipoAtencion: "consulta",
                                cupsCode: docCups,
                                codDiagnosticoPrincipal: codDxPrincipal,
                                codDiagnosticoRelacionado1: codDxRel1,
                                fechaInicioAtencion: fechaAtencion,
                                finalidad: docMeta.finalidad || "10",
                                modalidad: docMeta.modalidad || "01",
                                grupoServicios: "01",
                                causaMotivoAtencion: docMeta.causaMotivoAtencion || "38",
                                tipoDiagnosticoPrincipal: docMeta.tipoDiagnosticoPrincipal || "01",
                                vrServicio: valorServ,
                                conceptoRecaudo: "05",
                                valorPagoModerador: 0,
                                profesional: profObj,
                            });
                        }

                    } else {
                        // ── FLUJO PROCEDIMIENTOS (Fuente: evoluciones + planes realizados) ──
                        let matchedPlanItem = null;
                        for (const pl of patientPlanes) {
                            const it = pl._items.find(pi => 
                                (item.id && pi.id === item.id) ||
                                (explicitCups && (pi.codigo === explicitCups || pi.codigo_cups === explicitCups)) ||
                                (pi.nombre && pi.nombre.trim().toUpperCase() === upperDesc)
                            );
                            if (it) {
                                matchedPlanItem = it;
                                break;
                            }
                        }

                        let matchedEvo = null;
                        if (item.evolutionId) {
                            matchedEvo = patientEvoluciones.find(e => e.id === item.evolutionId);
                        }
                        if (!matchedEvo && matchedPlanItem) {
                            matchedEvo = patientEvoluciones.find(e => e._tData?.procedimientoId === matchedPlanItem.id);
                        }
                        if (!matchedEvo) {
                            matchedEvo = patientEvoluciones.find(e => 
                                e._tData?.procedimientoTexto && e._tData.procedimientoTexto.trim().toUpperCase() === upperDesc
                            );
                        }
                        if (!matchedEvo && patientEvoluciones.length > 0) {
                            if (matchedPlanItem && (matchedPlanItem.realizado || matchedPlanItem.status === 'completed')) {
                                matchedEvo = patientEvoluciones[0];
                            }
                        }

                        const isRealizado = Boolean(
                            matchedPlanItem?.realizado === true ||
                            matchedPlanItem?.status === 'completed' ||
                            matchedEvo !== null
                        );

                        if (!isRealizado) {
                            itemErrors.push(`RIPS_CLINICAL_SOURCE_NOT_FOUND: Procedimiento '${descText}' no cuenta con evolución clínica registrada o no está marcado como realizado`);
                        }

                        const procCups = explicitCups || matchedPlanItem?.codigo || matchedPlanItem?.codigo_cups || "";
                        if (!procCups || procCups.length !== 6) {
                            itemErrors.push("INVALID_CUPS_CODE: Código CUPS de procedimiento no configurado en tarifario ni en plan (6 caracteres)");
                        }

                        // Diagnóstico CIE-10 real desde la evolución
                        const evoData = matchedEvo?._tData || {};
                        const rawDxPrincipal = evoData.dxPrincipal?.code || evoData.dxPrincipal || "";
                        const codDxPrincipal = String(rawDxPrincipal).trim().toUpperCase();
                        if (!codDxPrincipal || !/^[A-Z][0-9]{2}[0-9A-Z]?$/.test(codDxPrincipal)) {
                            itemErrors.push(`MISSING_REQUIRED_DATA: Diagnóstico principal CIE-10 no registrado en la evolución clínica (${codDxPrincipal || 'vacío'})`);
                        }

                        const codDxRel = evoData.dxRelacionado?.code || evoData.dxRelacionado || null;
                        const codComp = evoData.complicacion?.code || evoData.complicacion || null;
                        const profObj = resolveDoctorInfo(matchedEvo?.profesional_id || evoData.doctorId, profilesList, tenantConfig);
                        const fechaAtencion = formatDateTimeRips(matchedEvo?.fecha || evoData.date || matchedPlanItem?.fechaRealizado || fechaDoc);

                        const procRow = {
                            docPaciente: patientDoc,
                            invoiceId,
                            codPrestador,
                            fechaProcedimiento: fechaAtencion,
                            numAutorizacion: f.nroAutorizacion || f.autorizacion || null,
                            codProcedimiento: procCups || "SIN_CUPS",
                            viaIngresoServicioSalud: "01",
                            modalidadGrupoServicioTecSal: mapModalidadRips(evoData.modalidadAtencion),
                            grupoServicios: "02",
                            codServicio: 334,
                            finalidadTecnologiaSalud: mapFinalidadRips(evoData.finalidad || evoData.tipoServicio, false),
                            tipoPersonal: "01",
                            dxPrincipal: codDxPrincipal || "SIN_DX",
                            codDiagnosticoRelacionado: codDxRel,
                            codComplicacion: codComp,
                            formaRealizacionActoQuirurgico: "01",
                            tipoDocumentoIdentificacion: profObj.tipoDocumentoIdentificacion,
                            numDocumentoIdentificacion: profObj.numDocumentoIdentificacion,
                            valorServicio: valorServ,
                            conceptoRecaudo: "05",
                            valorPagoModerador: 0,
                            numFEVPagoModerador: null,
                            errors: itemErrors
                        };

                        procList.push(procRow);

                        if (itemErrors.length === 0) {
                            adaptedAtencionesForInvoice.push({
                                tipoAtencion: "procedimiento",
                                cupsCode: procCups,
                                codDiagnosticoPrincipal: codDxPrincipal,
                                codDiagnosticoRelacionado: codDxRel,
                                codComplicacion: codComp,
                                viaIngresoServicioSalud: "01",
                                fechaInicioAtencion: fechaAtencion,
                                modalidad: mapModalidadRips(evoData.modalidadAtencion),
                                grupoServicios: "02",
                                finalidad: mapFinalidadRips(evoData.finalidad || evoData.tipoServicio, false),
                                vrServicio: valorServ,
                                conceptoRecaudo: "05",
                                valorPagoModerador: 0,
                                profesional: profObj,
                            });
                        }
                    }

                    if (itemErrors.length > 0) {
                        invoiceErrors.push(...itemErrors);
                    }
                }

                if (patientErrors.length > 0) {
                    invoiceErrors.push(...patientErrors);
                }

                // Ejecución de Preflight Adaptador y Motor v003
                let v003ValidationResult = null;
                let v003RipsJson = null;

                if (invoiceErrors.length === 0 && adaptedAtencionesForInvoice.length > 0) {
                    try {
                        const adaptRes = await adaptClinicalDataToRipsV003({
                            tenantId: inquilino,
                            sucursalId: selectedSucursal || "00000000-0000-0000-0000-000000000001",
                            prestador: {
                                nit: nitObligado,
                                codPrestador,
                                codServicio: 334,
                            },
                            factura: {
                                numFactura: invoiceId,
                            },
                            paciente: {
                                tipoDocumentoIdentificacion: usuarioWithValidation.tipoDocumentoIdentificacion,
                                numDocumentoIdentificacion: usuarioWithValidation.numDocumentoIdentificacion,
                                tipoUsuario: usuarioWithValidation.tipoUsuario,
                                fechaNacimiento: usuarioWithValidation.fechaNacimiento,
                                codSexo: usuarioWithValidation.codSexo,
                                codPaisResidencia: usuarioWithValidation.codPaisResidencia,
                                codMunicipioResidencia: usuarioWithValidation.codMunicipioResidencia,
                                codZonaTerritorialResidencia: usuarioWithValidation.codZonaTerritorialResidencia,
                                incapacidad: usuarioWithValidation.incapacidad,
                            },
                            profesional: resolveDoctorInfo(null, profilesList, tenantConfig),
                            atenciones: adaptedAtencionesForInvoice,
                        });

                        if (!adaptRes.success) {
                            invoiceErrors.push(`ADAPTADOR_V003_ERROR: ${adaptRes.error?.message || "Error al estructurar atenciones clínicas"}`);
                        } else {
                            const genRes = await generateRipsV003({
                                ...adaptRes.adaptedData,
                                options: { skipFlagCheck: true, skipRepsCheck: true }
                            });

                            v003RipsJson = genRes.ripsJson;
                            v003ValidationResult = genRes.validation;

                            if (!genRes.success || !v003ValidationResult.isValid) {
                                const vErrors = v003ValidationResult.errors || [];
                                vErrors.forEach(err => invoiceErrors.push(`VALIDADOR_V003: ${err.message || err.error || err}`));
                            }
                        }
                    } catch (adaptErr) {
                        invoiceErrors.push(`V003_CRITICAL_ERROR: ${adaptErr.message}`);
                    }
                }

                const isValidInvoice = invoiceErrors.length === 0 && adaptedAtencionesForInvoice.length > 0;
                if (isValidInvoice) {
                    totalValidFacturas++;
                    validationMap.set(invoiceId, {
                        valid: true,
                        ripsJson: v003RipsJson,
                        validation: v003ValidationResult,
                        invoiceId,
                        paciente: pacNombre
                    });
                } else {
                    totalErrorFacturas++;
                    cumulativeErrorsCount += invoiceErrors.length;
                    validationMap.set(invoiceId, {
                        valid: false,
                        errors: invoiceErrors,
                        invoiceId,
                        paciente: pacNombre
                    });
                }

                dianList.push({
                    id: invoiceId,
                    paciente: pacNombre,
                    cufe: f.cufe || f.cufeFactura || "SIN_CUFE",
                    errors: invoiceErrors,
                    status: isValidInvoice ? "LISTO" : "CON_ERRORES"
                });
            }

            setDianDocs(dianList);
            setUsuarios(userList);
            setConsultas(conList);
            setProcedimientos(procList);
            setOtrosServicios(otrosList);

            setPreflightValidationMap(validationMap);
            setPreflightSummary({
                total: facturas.length,
                valid: totalValidFacturas,
                error: totalErrorFacturas,
                totalErrors: cumulativeErrorsCount
            });

            // Cargar historial de validaciones MUV registradas para estas facturas (P0-A2B2)
            try {
                const invoiceIds = facturas.map(f => f.nroConsecutivo || f.numeroFactura || f.cufe?.substring(0, 12) || f.id);
                const existingMuvMap = await loadMuvValidationsMap(inquilino, invoiceIds);
                setMuvValidationsMap(existingMuvMap);
            } catch (muvErr) {
                console.warn("No se pudo cargar historial MUV:", muvErr);
            }

            if (totalErrorFacturas === 0 && totalValidFacturas > 0) {
                setPreflightStatus("READY");
                setLogs(prev => [...prev, `✅ Preflight 100% Exitoso: ${totalValidFacturas} facturas validadas con fuentes clínicas reales y 0 errores.`]);
                toast.success(`Preflight listo: ${totalValidFacturas} facturas validadas correctamente.`);
            } else {
                setPreflightStatus("HAS_ERRORS");
                setLogs(prev => [...prev, `⚠️ Preflight con observaciones: ${totalErrorFacturas} facturas tienen inconsistencias clínicas (${cumulativeErrorsCount} errores detectados).`]);
                toast.warning(`Preflight completado: ${totalErrorFacturas} facturas con errores clínicos.`);
            }

        } catch (error) {
            console.error("Error en validación preflight:", error);
            setPreflightStatus("HAS_ERRORS");
            setLogs(prev => [...prev, `❌ Error en preflight: ${error.message}`]);
            toast.error("Error al ejecutar validación preflight.");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // GESTIÓN Y TRANSMISIÓN MUV (P0-A2B2)
    // ─────────────────────────────────────────────────────────────

    const handleCopyCuv = (cuv) => {
        if (!cuv) return;
        navigator.clipboard.writeText(cuv);
        setCopiedCuv(cuv);
        toast.success("CUV copiado al portapapeles");
        setTimeout(() => setCopiedCuv(null), 3000);
    };

    const handleSendSingleToMuv = async (invoiceId) => {
        if (transmittingMuv) return; // Protección anti doble-clic

        const preflightData = preflightValidationMap.get(invoiceId);
        if (!preflightData || !preflightData.valid || !preflightData.ripsJson) {
            toast.error("Corrige los datos clínicos antes de enviar.");
            return;
        }

        // Si ya está validada formalmente con CUV
        const existingMuv = muvValidationsMap.get(invoiceId);
        if (existingMuv?.cuv && (existingMuv?.estadoDb === 'VALIDADO' || existingMuv?.estadoDb === 'valido')) {
            toast.info("Esta factura ya fue validada formalmente por MinSalud con CUV emitido.");
            return;
        }

        setTransmittingMuv(true);
        setLogs(prev => [...prev, `🚀 [MUV] Transmitiendo FEV-RIPS para factura ${invoiceId}...`]);
        const toastId = toast.loading("Validando FEV-RIPS con MinSalud...");

        try {
            const res = await transmitFevRips({
                facturaId: invoiceId,
                ripsJson: preflightData.ripsJson,
            });

            toast.dismiss(toastId);

            if (res.estado === 'ALREADY_VALIDATED_WITH_CUV' || (res.success && res.cuv)) {
                toast.success(`✓ RIPS aceptado por MinSalud. CUV: ${res.cuv}`);
                setLogs(prev => [...prev, `✅ [MUV] Factura ${invoiceId} ACEPTADA por MinSalud con CUV: ${res.cuv}`]);
                setMuvValidationsMap(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, {
                        estadoDb: "VALIDADO",
                        uiState: MUV_UI_STATES.ACCEPTED,
                        cuv: res.cuv,
                        fechaRadicacion: res.fechaRadicacion || new Date().toISOString(),
                        errores: [],
                        advertencias: res.advertencias || [],
                        updatedAt: new Date().toISOString(),
                    });
                    return next;
                });
            } else if (res.estado === 'VALIDATION_ALREADY_IN_PROGRESS') {
                toast.warning("Este RIPS ya está siendo validado. Espera el resultado.");
                setLogs(prev => [...prev, `⏳ [MUV] Factura ${invoiceId} ya tiene una validación en progreso.`]);
                setMuvValidationsMap(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, {
                        ...(prev.get(invoiceId) || {}),
                        estadoDb: "PENDIENTE",
                        uiState: MUV_UI_STATES.VALIDATING,
                    });
                    return next;
                });
            } else if (res.estado === 'REJECTED') {
                const errCount = res.errores?.length || 0;
                toast.error(`RIPS rechazado por el MUV (${errCount} observación${errCount === 1 ? '' : 'es'}).`);
                setLogs(prev => [...prev, `❌ [MUV] Factura ${invoiceId} RECHAZADA por el MUV: ${res.errores.map(e => e.code).join(', ')}`]);
                setMuvValidationsMap(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, {
                        estadoDb: "RECHAZADO",
                        uiState: MUV_UI_STATES.REJECTED,
                        cuv: null,
                        errores: res.errores || [],
                        advertencias: res.advertencias || [],
                        updatedAt: new Date().toISOString(),
                    });
                    return next;
                });
            } else {
                // ERROR técnico
                toast.error(`Error técnico de comunicación: ${res.message || "Fallo en el servicio MUV"}`);
                setLogs(prev => [...prev, `⚠️ [MUV] Error técnico en factura ${invoiceId}: ${res.message}`]);
                setMuvValidationsMap(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, {
                        estadoDb: "ERROR",
                        uiState: MUV_UI_STATES.ERROR,
                        isTechnicalError: true,
                        message: res.message,
                        errores: res.errores || [],
                        updatedAt: new Date().toISOString(),
                    });
                    return next;
                });
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(`Error técnico al conectar con MUV: ${err.message}`);
            setMuvValidationsMap(prev => {
                const next = new Map(prev);
                next.set(invoiceId, {
                    estadoDb: "ERROR",
                    uiState: MUV_UI_STATES.ERROR,
                    isTechnicalError: true,
                    message: err.message,
                    errores: [formatMuvError(err.message)],
                    updatedAt: new Date().toISOString(),
                });
                return next;
            });
        } finally {
            setTransmittingMuv(false);
        }
    };

    const handleSendBatchToMuv = async () => {
        if (transmittingMuv) return; // Anti doble-clic
        if (preflightStatus !== 'READY') {
            toast.error("Corrige los datos clínicos antes de enviar.");
            return;
        }

        const validEntries = Array.from(preflightValidationMap.values()).filter(v => v.valid && v.ripsJson);
        if (validEntries.length === 0) {
            toast.error("No hay facturas con validación clínica aprobada para enviar al MUV.");
            return;
        }

        // Filtrar las que ya tengan CUV
        const toTransmit = validEntries.filter(entry => {
            const currentMuv = muvValidationsMap.get(entry.invoiceId);
            return !(currentMuv?.cuv && (currentMuv?.estadoDb === 'VALIDADO' || currentMuv?.estadoDb === 'valido'));
        });

        if (toTransmit.length === 0) {
            toast.info("Esta factura ya fue validada correctamente.");
            return;
        }

        setTransmittingMuv(true);
        setLogs(prev => [...prev, `🚀 [MUV] Iniciando lote de transmisión para ${toTransmit.length} factura(s)...`]);

        for (const entry of toTransmit) {
            await handleSendSingleToMuv(entry.invoiceId);
        }

        setTransmittingMuv(false);
    };

    const handleRetryInvoice = async (invoiceId) => {
        setDetailModalData(null);
        toast.info(`Regenerando RIPS desde historia clínica para factura ${invoiceId}...`);
        setLogs(prev => [...prev, `🔄 [REINTENTO] Regenerando RIPS y recalculando preflight para factura ${invoiceId}...`]);
        await handlePreflightValidation();
    };

    // ─────────────────────────────────────────────────────────────
    // DESCARGA OFICIAL RIPS V003
    // ─────────────────────────────────────────────────────────────

    const handleDownloadOfficialRips = async (onlyValid = true) => {
        if (!preflightValidationMap || preflightValidationMap.size === 0) {
            toast.error("Debe ejecutar primero la validación preflight.");
            return;
        }

        const validEntries = Array.from(preflightValidationMap.values()).filter(v => v.valid && v.ripsJson);
        if (validEntries.length === 0) {
            toast.error("No hay facturas con validación clínica 100% aprobada para generar RIPS.");
            return;
        }

        const filesToDownload = [];
        for (const entry of validEntries) {
            const fileName = `${entry.invoiceId}_RIPS_v003.json`;
            const fileContent = JSON.stringify(entry.ripsJson, null, 2);
            filesToDownload.push({
                name: fileName,
                type: 'RIPS JSON v003 (Res. 948)',
                size: fileContent.length,
                content: fileContent,
                fechaGeneracion: new Date().toISOString(),
                inquilino: inquilino,
            });

            // Guardar auditoría en rips_validaciones y rips_generados
            try {
                await supabase.from("rips_validaciones").insert([{
                    tenant_id: inquilino,
                    tipo_documento: "rips_v003_factura",
                    documento_id: entry.invoiceId,
                    esquema_version: "DT1-v003-2026",
                    estado: "valido",
                    errores: [],
                    advertencias: [],
                    payload_resumen: {
                        factura: entry.invoiceId,
                        paciente: entry.paciente,
                        generadoEn: new Date().toISOString()
                    }
                }]);
                await supabase.from("rips_generados").insert([{
                    name: fileName,
                    type: 'RIPS JSON v003 (Res. 948)',
                    size: fileContent.length,
                    content: fileContent,
                    tenant_id: inquilino,
                    inquilino: inquilino,
                    created_at: new Date().toISOString()
                }]);
            } catch (auditErr) {
                console.warn("Aviso al guardar trazabilidad:", auditErr);
            }
        }

        setGeneratedFiles(prev => {
            const combined = [...filesToDownload, ...prev];
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

        filesToDownload.forEach((file, index) => {
            setTimeout(() => {
                handleDownload(file);
            }, index * 250);
        });

        toast.success(`${filesToDownload.length} archivos RIPS JSON v003 oficiales generados y descargados.`);
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

    const exportDianExcel = () => {
        const rows = (dianDocs.length > 0 ? dianDocs : [{}]).map(d => ({
            "Estado": d.errors && d.errors.length > 0 ? "Con errores" : (d.id ? "Validado" : ""),
            "Número de la factura": d.id || "",
            "Tipo de nota": d.id ? "Factura Electrónica" : "",
            "CUV": d.cufe || "",
            "Acciones": ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Documentos_DIAN");
        XLSX.writeFile(wb, `RIPS_Documentos_DIAN_${dateRange.start || 'inicio'}_al_${dateRange.end || 'fin'}.xlsx`);
        toast.success("Documentos DIAN exportados a Excel");
    };

    const exportUsuariosExcel = () => {
        const rows = (usuarios.length > 0 ? usuarios : [{}]).map(u => ({
            "Tipo de documento Identificación": u.tipoDocumentoIdentificacion || "",
            "Nro. documento de Identificación": u.numDocumentoIdentificacion || "",
            "Tipo de Usuario": u.tipoUsuario || "",
            "Fecha de nacimiento": u.fechaNacimiento || "",
            "Cód. Sexo": u.codSexo || "",
            "Cód. país de residencia": "170",
            "Cód. Municipio residencia": u.codMunicipioResidencia || "",
            "Acciones": ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
        XLSX.writeFile(wb, `RIPS_Usuarios_${dateRange.start || 'inicio'}_al_${dateRange.end || 'fin'}.xlsx`);
        toast.success("Usuarios exportados a Excel");
    };

    const exportConsultasExcel = () => {
        const rows = (consultas.length > 0 ? consultas : [{}]).map(c => ({
            "Estado": c.errors && c.errors.length > 0 ? "Con errores" : (c.codConsulta ? "Validado" : ""),
            "Identificación del paciente": c.docPaciente || "",
            "Número de la factura": c.invoiceId || "",
            "Código del Prestador": c.codPrestador || "",
            "Fecha de Consulta": c.fechaInicio || "",
            "Nro. de Autorización": c.numAutorizacion || "",
            "Código de la consulta": c.codConsulta || "",
            "Modalidad": c.modalidadGrupoServicioTecSal || "01",
            "Grupo de Servicios": c.grupoServicios || "01",
            "Cód. Servicio": c.codServicio || "360",
            "Finalidad": c.finalidadTecnologiaSalud || "10",
            "Causa Externa": c.causaMotivoAtencion || "38",
            "Cód. Diagnóstico Principal": c.dxPrincipal || "",
            "Tipo Diagnóstico Principal": "01",
            "Tipo Identificación del Profesional": "CC",
            "Nro. Identificación del Profesional": "64576359",
            "Valor de la consulta": c.valorServicio || 0,
            "Concepto recaudo": "05",
            "Valor pago moderador": c.valorPagoModerador || 0,
            "Número de Factura pago moderador": c.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consultas");
        XLSX.writeFile(wb, `RIPS_Consultas_${dateRange.start || 'inicio'}_al_${dateRange.end || 'fin'}.xlsx`);
        toast.success("Consultas exportadas a Excel");
    };

    const exportProcedimientosExcel = () => {
        const rows = (procedimientos.length > 0 ? procedimientos : [{}]).map(p => ({
            "Estado": p.errors && p.errors.length > 0 ? "Con errores" : (p.codProcedimiento ? "Validado" : ""),
            "Nro. Identificación del paciente": p.docPaciente || "",
            "Número de la factura": p.invoiceId || "",
            "Código del Prestador": p.codPrestador || "",
            "Fecha de Procedimiento": p.fechaProcedimiento || "",
            "Nro. de Autorización": p.numAutorizacion || "",
            "Código del Procedimiento": p.codProcedimiento || "",
            "Vía de ingreso": p.viaIngresoServicioSalud || "01",
            "Modalidad": p.modalidadGrupoServicioTecSal || "01",
            "Grupo de Servicios": p.grupoServicios || "02",
            "Cód. Servicio": p.codServicio || "360",
            "Finalidad": p.finalidadTecnologiaSalud || "10",
            "Personal que atiende": p.tipoPersonal || "01",
            "Cód. Diagnóstico Principal": p.dxPrincipal || "",
            "Cód. Diagnóstico Relacionado": p.codDiagnosticoRelacionado || "",
            "Cód. Complicación": p.codComplicacion || "",
            "Forma realización acto quirúrgico": p.formaRealizacionActoQuirurgico || "01",
            "Tipo Identificación del Profesional": "CC",
            "Nro. Identificación del Profesional": "64576359",
            "Valor del procedimiento": p.valorServicio || 0,
            "Concepto recaudo": "05",
            "Valor pago moderador": p.valorPagoModerador || 0,
            "Número de Factura pago moderador": p.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Procedimientos");
        XLSX.writeFile(wb, `RIPS_Procedimientos_${dateRange.start || 'inicio'}_al_${dateRange.end || 'fin'}.xlsx`);
        toast.success("Procedimientos exportados a Excel");
    };

    const exportOtrosServiciosExcel = () => {
        const rows = (otrosServicios.length > 0 ? otrosServicios : [{}]).map(o => ({
            "Estado": o.errors && o.errors.length > 0 ? "Con errores" : (o.codTecnologiaSalud ? "Validado" : ""),
            "Nro. Identificación del paciente": o.docPaciente || "",
            "Número de la factura": o.invoiceId || "",
            "Código del Prestador": o.codPrestador || "",
            "Fecha de Otro Servicio": o.fechaSuministroTecnologia || "",
            "Nro. de Autorización": o.numAutorizacion || "",
            "Código del Otro Servicio": o.codTecnologiaSalud || "",
            "Tipo de Otro Servicio": o.tipoOS || "",
            "Tipo Identificación del Profesional": o.tipoDocumentoIdentificacion || "CC",
            "Nro. Identificación del Profesional": o.numDocumentoIdentificacion || "",
            "Valor unitario del servicio": o.vrUnitOS || 0,
            "Cantidad del servicio": o.cantidadOS || 0,
            "Valor del servicio": o.vrServicio || 0,
            "Concepto recaudo": o.conceptoRecaudo || "05",
            "Valor pago moderador": o.valorPagoModerador || 0,
            "Número de Factura pago moderador": o.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Otros_Servicios");
        XLSX.writeFile(wb, `RIPS_Otros_Servicios_${dateRange.start || 'inicio'}_al_${dateRange.end || 'fin'}.xlsx`);
        toast.success("Otros Servicios exportados a Excel");
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animation-fade-in-up font-sans text-slate-800 space-y-5 pb-12">
            
            {/* Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <FiActivity className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <span>Administración</span>
                            <FiChevronRight size={12} />
                            <span className="text-sky-600 font-bold">RIPS JSON (Res. 2275)</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-800 tracking-tight">Generador de RIPS JSON</h1>
                    </div>
                </div>
                <p className="text-xs text-slate-500 font-medium hidden md:block">
                    Cumplimiento Resolución 2275 de 2023
                </p>
            </div>

            {/* Warning Banner if Tenant Config is incomplete */}
            {configWarning && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                        <FiAlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <h4 className="text-xs font-bold text-amber-900">Configuración Incompleta para RIPS</h4>
                            <p className="text-xs text-amber-700">{configWarning}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(buildDashboardPath("config"))}
                        className="h-8 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                        <FiSettings size={13} /> Configurar Empresa
                    </button>
                </div>
            )}

            {/* Main configuration Form Card 1:1 OralDrive */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 max-w-4xl mx-auto">
                <div className="space-y-4">
                    
                    {/* Row 1: Fecha inicial y Fecha final */}
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex items-center gap-3 w-full sm:w-1/2">
                            <label className="text-xs text-slate-500 w-28 text-right shrink-0">
                                Fecha inicial
                            </label>
                            <div className="relative flex-1">
                                <input 
                                    type="date" 
                                    value={dateRange.start} 
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                                    max="9999-12-31" min="1900-01-01" 
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-1/2">
                            <label className="text-xs text-slate-500 w-24 text-right shrink-0">
                                Fecha final
                            </label>
                            <div className="relative flex-1">
                                <input 
                                    type="date" 
                                    value={dateRange.end} 
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                                    max="9999-12-31" min="1900-01-01" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Sucursales + Botón Buscar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 w-full">
                            <label className="text-xs text-slate-500 w-28 text-right shrink-0">
                                Sucursales
                            </label>
                            <select 
                                value={selectedSucursal} 
                                onChange={(e) => setSelectedSucursal(e.target.value)}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all cursor-pointer"
                            >
                                <option value="">Seleccione...</option>
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre || 'Sede Principal'}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            type="button"
                            onClick={handleGenerate} 
                            disabled={loading || !dateRange.start || !dateRange.end}
                            className={`h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs shrink-0
                                ${loading || !dateRange.start || !dateRange.end ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? "Buscando..." : "Buscar"}
                        </button>
                    </div>

                    {/* Row 3: Generar con (Radios) */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <label className="text-xs text-slate-500 w-28 text-right shrink-0">
                            Generar con
                        </label>
                        <div className="flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                                <input 
                                    type="radio" 
                                    name="filterType"
                                    value="facturacion"
                                    checked={filterType === 'facturacion'}
                                    onChange={() => setFilterType('facturacion')}
                                    className="w-3.5 h-3.5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                                />
                                <span>Filtro por fecha de facturación</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                                <input 
                                    type="radio" 
                                    name="filterType"
                                    value="realizado"
                                    checked={filterType === 'realizado'}
                                    onChange={() => setFilterType('realizado')}
                                    className="w-3.5 h-3.5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                                />
                                <span>Filtro por fecha de realizado</span>
                            </label>
                        </div>
                    </div>

                    {/* Row 4: Tercero (Select2 Dropdown 1:1 OralDrive) */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <label className="text-xs text-slate-500 w-28 text-right shrink-0 pt-1 sm:pt-0">
                            Tercero
                        </label>
                        <div className="relative flex-1 w-full max-w-lg">
                            
                            {/* Caja del selector Select2 */}
                            <div 
                                onClick={() => setShowTerceroDropdown(!showTerceroDropdown)}
                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 flex items-center justify-between cursor-pointer hover:border-sky-400 transition-colors"
                            >
                                <span className={selectedEps ? "text-slate-800 font-medium truncate" : "text-slate-400"}>
                                    {selectedEps ? (epsList.find(t => t.value === selectedEps)?.label || selectedEps) : "Seleccione..."}
                                </span>
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    {selectedEps && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEps("");
                                                setSearchTerceroQuery("");
                                                setShowTerceroDropdown(false);
                                            }}
                                            className="hover:text-rose-500 cursor-pointer font-bold text-xs"
                                            title="Limpiar"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <span className="text-[10px] transform rotate-90">›</span>
                                </div>
                            </div>

                            {/* Dropdown flotante con buscador interno (Select2) */}
                            {showTerceroDropdown && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 overflow-hidden">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder=""
                                            value={searchTerceroQuery}
                                            onChange={(e) => setSearchTerceroQuery(e.target.value)}
                                            className="w-full h-7 px-2.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                                        {!searchTerceroQuery.trim() ? (
                                            <div className="p-3 text-[11px] text-slate-400 italic">
                                                Please enter 1 or more characters
                                            </div>
                                        ) : filteredTerceros.length === 0 ? (
                                            <div className="p-3 text-xs text-slate-400 text-center italic">
                                                No results found
                                            </div>
                                        ) : (
                                            filteredTerceros.map((t, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedEps(t.value);
                                                        setShowTerceroDropdown(false);
                                                    }}
                                                    className="px-3 py-2 text-xs hover:bg-sky-50 hover:text-sky-700 cursor-pointer transition-colors text-slate-700 font-medium"
                                                >
                                                    {t.label}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 5: Dual Listbox / Transfer List 1:1 OralDrive (Solo visible cuando se selecciona un Tercero / Paciente) */}
                    {selectedEps && (
                        <div className="pt-4 border-t border-slate-100 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                                
                                {/* Columna Izquierda: Facturas disponibles */}
                                <div className="md:col-span-5">
                                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">
                                        Facturas disponibles
                                    </label>
                                    <div className="w-full h-44 bg-white border border-slate-200 rounded p-1.5 overflow-y-auto divide-y divide-slate-100 text-xs">
                                        {availableInvoices.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                                                Sin facturas disponibles
                                            </div>
                                        ) : (
                                            availableInvoices.map((inv, idx) => {
                                                const idKey = `${inv._coleccion}::${inv.id}`;
                                                const isChecked = checkedAvailable.has(idKey);
                                                return (
                                                    <label 
                                                        key={idx} 
                                                        className={`py-1.5 px-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded transition-colors ${isChecked ? 'bg-sky-50' : ''}`}
                                                    >
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const next = new Set(checkedAvailable);
                                                                if (next.has(idKey)) next.delete(idKey);
                                                                else next.add(idKey);
                                                                setCheckedAvailable(next);
                                                            }}
                                                            className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 cursor-pointer"
                                                        />
                                                        <div className="truncate text-slate-700">
                                                            <span className="font-bold text-slate-800">{inv.numeroFactura || inv.consecutivo || inv.id}</span>
                                                            <span className="text-slate-400 ml-1.5">({normalizeFecha(inv.fecha || inv.fechaFactura || inv.createdAt)})</span>
                                                            <span className="text-slate-600 font-semibold ml-1.5">{fmt(inv.total || inv.monto || inv.valor || 0)}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Columna Central: Opciones (Botones de traspaso) */}
                                <div className="md:col-span-1 flex flex-col items-center justify-center gap-1.5 py-2">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 hidden md:block">
                                        Opciones
                                    </label>
                                    <button
                                        type="button"
                                        title="Pasar todos a seleccionados"
                                        onClick={handleTransferAllRight}
                                        disabled={availableInvoices.length === 0}
                                        className="w-8 h-7 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-40 rounded flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer shadow-2xs transition-all"
                                    >
                                        »
                                    </button>
                                    <button
                                        type="button"
                                        title="Pasar seleccionados a la derecha"
                                        onClick={handleTransferSelectedRight}
                                        disabled={checkedAvailable.size === 0}
                                        className="w-8 h-7 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-40 rounded flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer shadow-2xs transition-all"
                                    >
                                        ›
                                    </button>
                                    <button
                                        type="button"
                                        title="Quitar seleccionados a la izquierda"
                                        onClick={handleTransferSelectedLeft}
                                        disabled={checkedSelected.size === 0}
                                        className="w-8 h-7 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-40 rounded flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer shadow-2xs transition-all"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        title="Quitar todos a disponibles"
                                        onClick={handleTransferAllLeft}
                                        disabled={selectedInvoices.length === 0}
                                        className="w-8 h-7 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-40 rounded flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer shadow-2xs transition-all"
                                    >
                                        «
                                    </button>
                                </div>

                                {/* Columna Derecha: Seleccionados */}
                                <div className="md:col-span-5">
                                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">
                                        Seleccionados
                                    </label>
                                    <div className="w-full h-44 bg-white border border-slate-200 rounded p-1.5 overflow-y-auto divide-y divide-slate-100 text-xs">
                                        {selectedInvoices.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                                                Sin facturas seleccionadas
                                            </div>
                                        ) : (
                                            selectedInvoices.map((inv, idx) => {
                                                const idKey = `${inv._coleccion}::${inv.id}`;
                                                const isChecked = checkedSelected.has(idKey);
                                                return (
                                                    <label 
                                                        key={idx} 
                                                        className={`py-1.5 px-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded transition-colors ${isChecked ? 'bg-sky-50' : ''}`}
                                                    >
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const next = new Set(checkedSelected);
                                                                if (next.has(idKey)) next.delete(idKey);
                                                                else next.add(idKey);
                                                                setCheckedSelected(next);
                                                            }}
                                                            className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 cursor-pointer"
                                                        />
                                                        <div className="truncate text-slate-700">
                                                            <span className="font-bold text-slate-800">{inv.numeroFactura || inv.consecutivo || inv.id}</span>
                                                            <span className="text-slate-400 ml-1.5">({normalizeFecha(inv.fecha || inv.fechaFactura || inv.createdAt)})</span>
                                                            <span className="text-slate-600 font-semibold ml-1.5">{fmt(inv.total || inv.monto || inv.valor || 0)}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* 5 Tablas Colapsables 1:1 OralDrive (Solo visibles después de darle Buscar) */}
            {searched && (
                <div className="space-y-4 w-full mt-6 animate-in fade-in duration-300">

                    {/* Banner de Estado Preflight Normativo v003 */}
                    {preflightStatus && (
                        <div className={`p-4 rounded-xl border shadow-2xs transition-all ${
                            preflightStatus === 'READY'
                                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
                                : 'bg-rose-50/95 border-rose-300 text-rose-900'
                        }`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                        preflightStatus === 'READY' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                                    }`}>
                                        {preflightStatus === 'READY' ? <FiCheckCircle size={20} /> : <FiAlertTriangle size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase ${
                                                preflightStatus === 'READY' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                            }`}>
                                                {preflightStatus === 'READY' ? 'LISTO' : 'ERRORES DE DATOS CLÍNICOS'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800">
                                                {preflightStatus === 'READY' 
                                                    ? 'Validación RIPS v003 100% Superada (Fuentes Clínicas Reales)' 
                                                    : `Bloqueo Preflight: ${preflightSummary?.totalErrors || 0} inconsistencia(s) detectada(s)`}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1.5 text-slate-600 leading-relaxed">
                                            {preflightStatus === 'READY'
                                                ? `Se validaron exitosamente ${preflightSummary?.valid || 0} factura(s). Todas las atenciones provienen de evoluciones o documentos clínicos reales completados, con CUPS oficial y diagnósticos CIE-10 normativos.`
                                                : `Se detectaron inconsistencias clínicas en ${preflightSummary?.error || 0} de ${preflightSummary?.total || 0} factura(s). La generación de JSON normativo se detiene para evitar rechazos en el validador MUV/MinSalud.`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row items-end md:items-center gap-2 shrink-0 self-end md:self-center">
                                    {preflightStatus === 'READY' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadOfficialRips(true)}
                                                className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                                                title="Descargar paquete RIPS v003 en formato JSON"
                                            >
                                                <FiDownload size={14} />
                                                <span>Descargar RIPS JSON ({preflightSummary?.valid})</span>
                                            </button>

                                            <button
                                                type="button"
                                                id="btn-enviar-muv-global"
                                                disabled={transmittingMuv}
                                                onClick={handleSendBatchToMuv}
                                                className="h-9 px-4 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                                                title="Validar y enviar FEV-RIPS al validador MUV de MinSalud"
                                            >
                                                {transmittingMuv ? (
                                                    <>
                                                        <FiRefreshCw size={14} className="animate-spin" />
                                                        <span>Validando FEV-RIPS con MinSalud...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiSend size={14} />
                                                        <span>Validar y enviar al MUV ({preflightSummary?.valid})</span>
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col md:flex-row items-end md:items-center gap-2">
                                            <span className="text-[11px] text-rose-700 font-semibold bg-rose-100/80 px-2.5 py-1 rounded border border-rose-200">
                                                Corrige los datos clínicos antes de enviar.
                                            </span>
                                            <button
                                                type="button"
                                                id="btn-enviar-muv-global"
                                                disabled
                                                title="Corrige los datos clínicos antes de enviar."
                                                className="h-9 px-4 bg-slate-200 text-slate-400 font-bold text-xs rounded-lg cursor-not-allowed flex items-center gap-2"
                                            >
                                                <FiSend size={14} />
                                                <span>Validar y enviar al MUV</span>
                                            </button>
                                            {preflightSummary?.valid > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadOfficialRips(true)}
                                                    className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                                                    title="Descargar solo facturas válidas"
                                                >
                                                    <FiDownload size={13} />
                                                    <span>Descargar válidas ({preflightSummary?.valid})</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* 1. Documentos DIAN */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div 
                            onClick={() => setOpenDian(!openDian)}
                            className="px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                                <span>Documentos DIAN</span>
                                <span className="text-[10px] text-slate-400 font-bold">{openDian ? '▲' : '▼'}</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportDianExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextDian}
                                        onChange={e => setFilterTextDian(e.target.value)}
                                        className="h-6 w-28 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                        {openDian && (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3 h-3 rounded" /></th>
                                                <th className="py-2 px-3">Estado MUV</th>
                                                <th className="py-2 px-3">Número Factura</th>
                                                <th className="py-2 px-3">Paciente</th>
                                                <th className="py-2 px-3">CUV MinSalud</th>
                                                <th className="py-2 px-3">Último Intento</th>
                                                <th className="py-2 px-3">Observaciones</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {dianDocs.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                dianDocs.map((doc, idx) => {
                                                    const invoiceId = doc.id;
                                                    const muvInfo = muvValidationsMap.get(invoiceId);

                                                    let badgeLabel = MUV_UI_STATES.DRAFT;
                                                    let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";

                                                    if (muvInfo?.uiState === MUV_UI_STATES.ACCEPTED || muvInfo?.cuv) {
                                                        badgeLabel = MUV_UI_STATES.ACCEPTED;
                                                        badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
                                                    } else if (transmittingMuv || muvInfo?.uiState === MUV_UI_STATES.VALIDATING) {
                                                        badgeLabel = MUV_UI_STATES.VALIDATING;
                                                        badgeClass = "bg-purple-100 text-purple-800 border-purple-200 animate-pulse font-bold";
                                                    } else if (muvInfo?.uiState === MUV_UI_STATES.REJECTED) {
                                                        badgeLabel = MUV_UI_STATES.REJECTED;
                                                        badgeClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
                                                    } else if (muvInfo?.uiState === MUV_UI_STATES.ERROR) {
                                                        badgeLabel = "ERROR COMUNICACIÓN";
                                                        badgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold";
                                                    } else if (doc.errors.length === 0) {
                                                        badgeLabel = MUV_UI_STATES.READY;
                                                        badgeClass = "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
                                                    } else {
                                                        badgeLabel = "CON ERRORES CLÍNICOS";
                                                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                                                    }

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/60">
                                                            <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${badgeClass}`}>
                                                                    {badgeLabel}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 font-bold text-slate-800">{doc.id}</td>
                                                            <td className="py-2 px-3 text-slate-600 font-medium truncate max-w-xs">{doc.paciente}</td>
                                                            <td className="py-2 px-3 font-mono text-[11px]">
                                                                {muvInfo?.cuv ? (
                                                                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                                                                        <span className="truncate max-w-[140px]" title={muvInfo.cuv}>{muvInfo.cuv}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopyCuv(muvInfo.cuv)}
                                                                            title="Copiar CUV"
                                                                            className="text-emerald-700 hover:text-emerald-900 transition-colors p-0.5 cursor-pointer"
                                                                        >
                                                                            {copiedCuv === muvInfo.cuv ? <FiCheck size={12} className="text-emerald-600" /> : <FiCopy size={12} />}
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 font-mono text-[10px]">{doc.cufe && doc.cufe !== "SIN_CUFE" ? `${doc.cufe.substring(0, 12)}...` : '-'}</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3 text-[11px] text-slate-500 font-mono">
                                                                {muvInfo?.updatedAt ? new Date(muvInfo.updatedAt).toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {badgeLabel === MUV_UI_STATES.ACCEPTED ? (
                                                                    <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                                                                        <FiCheckCircle size={12} /> Aprobado por MinSalud
                                                                    </span>
                                                                ) : badgeLabel === MUV_UI_STATES.REJECTED ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailModalData({ type: 'REJECTED', invoiceId: doc.id, info: muvInfo })}
                                                                        className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] underline flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <FiAlertTriangle size={12} /> {muvInfo?.errores?.length || 1} error(es) normativo(s)
                                                                    </button>
                                                                ) : badgeLabel === 'ERROR COMUNICACIÓN' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDetailModalData({ type: 'ERROR', invoiceId: doc.id, info: muvInfo })}
                                                                        className="text-amber-700 hover:text-amber-900 font-semibold text-[11px] underline flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <FiInfo size={12} /> Fallo técnico de red/gateway
                                                                    </button>
                                                                ) : doc.errors.length > 0 ? (
                                                                    <div className="text-[10px] text-rose-600 font-medium max-w-xs truncate" title={doc.errors.join(' | ')}>
                                                                        {doc.errors[0]}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 text-[11px]">Listo para validar</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                {badgeLabel === MUV_UI_STATES.ACCEPTED ? (
                                                                    <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold">
                                                                        <FiCheckCircle size={13} />
                                                                        <span>Validación completada</span>
                                                                    </div>
                                                                ) : badgeLabel === MUV_UI_STATES.VALIDATING ? (
                                                                    <div className="flex items-center justify-center gap-1.5 text-purple-700 text-xs font-semibold">
                                                                        <FiRefreshCw size={12} className="animate-spin" />
                                                                        <span>Validando...</span>
                                                                    </div>
                                                                ) : badgeLabel === MUV_UI_STATES.REJECTED ? (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRetryInvoice(doc.id)}
                                                                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                                                            title="Regenerar RIPS desde historia clínica y reintentar"
                                                                        >
                                                                            <FiRefreshCw size={11} />
                                                                            <span>Corregir y reintentar</span>
                                                                        </button>
                                                                    </div>
                                                                ) : badgeLabel === 'ERROR COMUNICACIÓN' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSendSingleToMuv(doc.id)}
                                                                        disabled={transmittingMuv}
                                                                        className="px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                                                        title="Reintentar transmisión"
                                                                    >
                                                                        <FiRefreshCw size={11} />
                                                                        <span>Reintentar</span>
                                                                    </button>
                                                                ) : badgeLabel === MUV_UI_STATES.READY ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSendSingleToMuv(doc.id)}
                                                                        disabled={transmittingMuv}
                                                                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed rounded shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                                                                    >
                                                                        <FiSend size={11} />
                                                                        <span>Validar MUV</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        disabled
                                                                        title="Corrige los datos clínicos antes de enviar."
                                                                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed"
                                                                    >
                                                                        Bloqueado
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Total facturas: <strong className="text-slate-700">{dianDocs.length}</strong></span>
                                    <span>Aceptadas con CUV: <strong className="text-emerald-700">{Array.from(muvValidationsMap.values()).filter(v => v.cuv).length}</strong></span>
                                    <span>Rechazadas MUV: <strong className="text-rose-700">{Array.from(muvValidationsMap.values()).filter(v => v.uiState === MUV_UI_STATES.REJECTED).length}</strong></span>
                                    <span>Errores de datos clínicos: <strong className="text-slate-700">{dianDocs.filter(d => d.errors.length > 0).length}</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Usuarios */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div 
                            onClick={() => setOpenUsuarios(!openUsuarios)}
                            className="px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                                <span>Usuarios</span>
                                <span className="text-[10px] text-slate-400 font-bold">{openUsuarios ? '▲' : '▼'}</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportUsuariosExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextUsuarios}
                                        onChange={e => setFilterTextUsuarios(e.target.value)}
                                        className="h-6 w-28 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                        {openUsuarios && (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3 h-3 rounded" /></th>
                                                <th className="py-2 px-3">Tipo de documento Identificación</th>
                                                <th className="py-2 px-3">Nro. documento de Identificación</th>
                                                <th className="py-2 px-3">Tipo de Usuario</th>
                                                <th className="py-2 px-3">Fecha de nacimiento</th>
                                                <th className="py-2 px-3">Cód. Sexo</th>
                                                <th className="py-2 px-3">Cód. país de residencia</th>
                                                <th className="py-2 px-3">Cód. Municipio residencia</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {usuarios.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                usuarios.map((u, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                        <td className="py-2 px-3">{u.tipoDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 font-bold">{u.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3">{u.tipoUsuario}</td>
                                                        <td className="py-2 px-3 font-mono">{u.fechaNacimiento}</td>
                                                        <td className="py-2 px-3 text-center font-bold">{u.codSexo}</td>
                                                        <td className="py-2 px-3">170 (Colombia)</td>
                                                        <td className="py-2 px-3 font-mono">{u.codMunicipioResidencia}</td>
                                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">{usuarios.filter(u => u.errors.length === 0).length}</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">{usuarios.filter(u => u.errors.length > 0).length}</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Consultas */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div 
                            onClick={() => setOpenConsultas(!openConsultas)}
                            className="px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                                <span>Consultas</span>
                                <span className="text-[10px] text-slate-400 font-bold">{openConsultas ? '▲' : '▼'}</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportConsultasExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextConsultas}
                                        onChange={e => setFilterTextConsultas(e.target.value)}
                                        className="h-6 w-28 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                        {openConsultas && (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3 h-3 rounded" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Consulta</th>
                                                <th className="py-2 px-3">Nro. de Autorización</th>
                                                <th className="py-2 px-3">Código de la consulta</th>
                                                <th className="py-2 px-3">Modalidad</th>
                                                <th className="py-2 px-3">Grupo de Servicios</th>
                                                <th className="py-2 px-3">Cód. Servicio</th>
                                                <th className="py-2 px-3">Finalidad</th>
                                                <th className="py-2 px-3">Causa Externa</th>
                                                <th className="py-2 px-3">Cód. Diagnóstico Principal</th>
                                                <th className="py-2 px-3">Tipo Diagnóstico Principal</th>
                                                <th className="py-2 px-3">Tipo Identificación del Profesional</th>
                                                <th className="py-2 px-3">Nro. Identificación del Profesional</th>
                                                <th className="py-2 px-3 text-right">Valor de la consulta</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de Factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {consultas.length === 0 ? (
                                                <tr>
                                                    <td colSpan="23" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                consultas.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    c.errors.length === 0 
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                }`}>
                                                                    {c.errors.length === 0 ? 'LISTO' : 'CON ERRORES'}
                                                                </span>
                                                            </div>
                                                            {c.errors.length > 0 && (
                                                                <div className="text-[10px] text-rose-600 font-medium mt-0.5 max-w-xs truncate" title={c.errors.join(' | ')}>
                                                                    {c.errors[0]}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{c.docPaciente}</td>
                                                        <td className="py-2 px-3">{c.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{c.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{c.fechaInicio}</td>
                                                        <td className="py-2 px-3 text-slate-400">{c.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{c.codConsulta}</td>
                                                        <td className="py-2 px-3">{c.modalidadGrupoServicioTecSal || '01'}</td>
                                                        <td className="py-2 px-3">{c.grupoServicios || '01'}</td>
                                                        <td className="py-2 px-3">{c.codServicio || '360'}</td>
                                                        <td className="py-2 px-3">{c.finalidadTecnologiaSalud || '10'}</td>
                                                        <td className="py-2 px-3">{c.causaMotivoAtencion || '38'}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-emerald-600">{c.dxPrincipal}</td>
                                                        <td className="py-2 px-3">01</td>
                                                        <td className="py-2 px-3">CC</td>
                                                        <td className="py-2 px-3 font-mono">64576359</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(c.valorServicio)}</td>
                                                        <td className="py-2 px-3">05</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(c.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3">{c.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">{consultas.filter(c => c.errors.length === 0).length}</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">{consultas.filter(c => c.errors.length > 0).length}</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Procedimientos */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div 
                            onClick={() => setOpenProcedimientos(!openProcedimientos)}
                            className="px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                                <span>Procedimientos</span>
                                <span className="text-[10px] text-slate-400 font-bold">{openProcedimientos ? '▲' : '▼'}</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportProcedimientosExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextProcedimientos}
                                        onChange={e => setFilterTextProcedimientos(e.target.value)}
                                        className="h-6 w-28 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                        {openProcedimientos && (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3 h-3 rounded" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Nro. Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Procedimiento</th>
                                                <th className="py-2 px-3">Nro. de Autorización</th>
                                                <th className="py-2 px-3">Código del Procedimiento</th>
                                                <th className="py-2 px-3">Vía de ingreso</th>
                                                <th className="py-2 px-3">Modalidad</th>
                                                <th className="py-2 px-3">Grupo de Servicios</th>
                                                <th className="py-2 px-3">Cód. Servicio</th>
                                                <th className="py-2 px-3">Finalidad</th>
                                                <th className="py-2 px-3">Personal que atiende</th>
                                                <th className="py-2 px-3">Cód. Diagnóstico Principal</th>
                                                <th className="py-2 px-3">Cód. Diagnóstico Relacionado</th>
                                                <th className="py-2 px-3">Cód. Complicación</th>
                                                <th className="py-2 px-3">Forma realización acto quirúrgico</th>
                                                <th className="py-2 px-3">Tipo Identificación del Profesional</th>
                                                <th className="py-2 px-3">Nro. Identificación del Profesional</th>
                                                <th className="py-2 px-3 text-right">Valor del procedimiento</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de Factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {procedimientos.length === 0 ? (
                                                <tr>
                                                    <td colSpan="26" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                procedimientos.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    p.errors.length === 0 
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                                }`}>
                                                                    {p.errors.length === 0 ? 'LISTO' : 'CON ERRORES'}
                                                                </span>
                                                            </div>
                                                            {p.errors.length > 0 && (
                                                                <div className="text-[10px] text-rose-600 font-medium mt-0.5 max-w-xs truncate" title={p.errors.join(' | ')}>
                                                                    {p.errors[0]}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{p.docPaciente}</td>
                                                        <td className="py-2 px-3">{p.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{p.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{p.fechaProcedimiento}</td>
                                                        <td className="py-2 px-3 text-slate-400">{p.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{p.codProcedimiento}</td>
                                                        <td className="py-2 px-3">{p.viaIngresoServicioSalud || '01'}</td>
                                                        <td className="py-2 px-3">{p.modalidadGrupoServicioTecSal || '01'}</td>
                                                        <td className="py-2 px-3">{p.grupoServicios || '02'}</td>
                                                        <td className="py-2 px-3">{p.codServicio || '360'}</td>
                                                        <td className="py-2 px-3">{p.finalidadTecnologiaSalud || '10'}</td>
                                                        <td className="py-2 px-3">{p.tipoPersonal || '01'}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-emerald-600">{p.dxPrincipal}</td>
                                                        <td className="py-2 px-3 font-mono">{p.codDiagnosticoRelacionado || '-'}</td>
                                                        <td className="py-2 px-3 font-mono">{p.codComplicacion || '-'}</td>
                                                        <td className="py-2 px-3">{p.formaRealizacionActoQuirurgico || '01'}</td>
                                                        <td className="py-2 px-3">CC</td>
                                                        <td className="py-2 px-3 font-mono">64576359</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(p.valorServicio)}</td>
                                                        <td className="py-2 px-3">05</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(p.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3">{p.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">{procedimientos.filter(p => p.errors.length === 0).length}</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">{procedimientos.filter(p => p.errors.length > 0).length}</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. Otros Servicios */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div 
                            onClick={() => setOpenOtrosServicios(!openOtrosServicios)}
                            className="px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                                <span>Otros Servicios</span>
                                <span className="text-[10px] text-slate-400 font-bold">{openOtrosServicios ? '▲' : '▼'}</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportOtrosServiciosExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextOtros}
                                        onChange={e => setFilterTextOtros(e.target.value)}
                                        className="h-6 w-28 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                        {openOtrosServicios && (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3 h-3 rounded" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Nro. Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Otro Servicio</th>
                                                <th className="py-2 px-3">Nro. de Autorización</th>
                                                <th className="py-2 px-3">Código del Otro Servicio</th>
                                                <th className="py-2 px-3">Tipo de Otro Servicio</th>
                                                <th className="py-2 px-3">Tipo Identificación del Profesional</th>
                                                <th className="py-2 px-3">Nro. Identificación del Profesional</th>
                                                <th className="py-2 px-3 text-right">Valor unitario del servicio</th>
                                                <th className="py-2 px-3 text-center">Cantidad del servicio</th>
                                                <th className="py-2 px-3 text-right">Valor del servicio</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de Factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {otrosServicios.length === 0 ? (
                                                <tr>
                                                    <td colSpan="19" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                otrosServicios.map((o, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                o.errors && o.errors.length === 0 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            }`}>
                                                                {o.errors && o.errors.length === 0 ? 'LISTO' : 'CON ERRORES'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{o.docPaciente}</td>
                                                        <td className="py-2 px-3">{o.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{o.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{o.fechaSuministroTecnologia}</td>
                                                        <td className="py-2 px-3 text-slate-400">{o.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{o.codTecnologiaSalud}</td>
                                                        <td className="py-2 px-3">{o.tipoOS}</td>
                                                        <td className="py-2 px-3">{o.tipoDocumentoIdentificacion || 'CC'}</td>
                                                        <td className="py-2 px-3 font-mono">{o.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 text-right">{fmt(o.vrUnitOS)}</td>
                                                        <td className="py-2 px-3 text-center">{o.cantidadOS}</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(o.vrServicio)}</td>
                                                        <td className="py-2 px-3">{o.conceptoRecaudo || '05'}</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(o.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3">{o.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">{otrosServicios.filter(o => !o.errors || o.errors.length === 0).length}</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">{otrosServicios.filter(o => o.errors && o.errors.length > 0).length}</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* Modal de Detalle MUV: Rechazos, Errores Técnicos y CUV (P0-A2B2) */}
            {detailModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className={`px-6 py-4 flex items-center justify-between border-b ${
                            detailModalData.type === 'REJECTED' ? 'bg-rose-50 border-rose-200' :
                            detailModalData.type === 'ERROR' ? 'bg-amber-50 border-amber-200' :
                            'bg-emerald-50 border-emerald-200'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    detailModalData.type === 'REJECTED' ? 'bg-rose-200 text-rose-800' :
                                    detailModalData.type === 'ERROR' ? 'bg-amber-200 text-amber-800' :
                                    'bg-emerald-200 text-emerald-800'
                                }`}>
                                    {detailModalData.type === 'REJECTED' ? <FiAlertTriangle size={18} /> :
                                     detailModalData.type === 'ERROR' ? <FiInfo size={18} /> :
                                     <FiCheckCircle size={18} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">
                                        {detailModalData.type === 'REJECTED' ? 'Observaciones de Rechazo MUV' :
                                         detailModalData.type === 'ERROR' ? 'Error Técnico de Comunicación' :
                                         '✓ RIPS Aceptado por MinSalud'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        Factura: <span className="font-bold text-slate-700">{detailModalData.invoiceId}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailModalData(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <FiXCircle size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {detailModalData.type === 'REJECTED' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        MinSalud rechazó la radicación del paquete FEV-RIPS con las siguientes observaciones oficiales:
                                    </p>
                                    <div className="space-y-2.5">
                                        {(detailModalData.info?.errores || []).length === 0 ? (
                                            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
                                                Rechazo sin descripción detallada devuelta por el servicio.
                                            </div>
                                        ) : (
                                            detailModalData.info.errores.map((err, i) => (
                                                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-100 text-rose-800 border border-rose-200">
                                                            {err?.code || 'RVC_ERROR'}
                                                        </span>
                                                        {err?.field && (
                                                            <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                Campo: {err.field}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-xs font-bold text-slate-800">
                                                        {err?.friendlyTitle || 'Observación normativa'}
                                                    </h4>
                                                    <p className="text-xs text-slate-600 leading-relaxed">
                                                        {err?.friendlyDescription || err?.message}
                                                    </p>
                                                    {err?.message && err.message !== err.friendlyDescription && (
                                                        <div className="p-2 bg-white rounded border border-slate-100 font-mono text-[10px] text-slate-500 break-all">
                                                            {err.message}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {detailModalData.type === 'ERROR' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                                        <FiInfo size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-900 leading-relaxed font-medium">
                                            Este fallo corresponde a una contingencia técnica o de conectividad. <strong>No constituye un rechazo normativo</strong> de MinSalud.
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                            Detalle de la excepción técnica:
                                        </span>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 break-all leading-relaxed">
                                            {detailModalData.info?.message || "Error al conectar con muv-gateway o servicio intermedio."}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {detailModalData.type === 'ACCEPTED' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                                        <FiCheckCircle size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                                        <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                                            El paquete FEV-RIPS fue verificado y aprobado formalmente por MinSalud.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            Código Único de Validación (CUV):
                                        </span>
                                        <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                                            <span className="font-mono text-xs font-bold text-slate-800 break-all">
                                                {detailModalData.info?.cuv}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCuv(detailModalData.info?.cuv)}
                                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                {copiedCuv === detailModalData.info?.cuv ? <FiCheck size={12} /> : <FiCopy size={12} />}
                                                <span>{copiedCuv === detailModalData.info?.cuv ? 'Copiado' : 'Copiar'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDetailModalData(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Cerrar
                            </button>
                            {detailModalData.type === 'REJECTED' && (
                                <button
                                    type="button"
                                    onClick={() => handleRetryInvoice(detailModalData.invoiceId)}
                                    className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                    <FiRefreshCw size={12} />
                                    <span>Corregir y reintentar</span>
                                </button>
                            )}
                            {detailModalData.type === 'ERROR' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const invId = detailModalData.invoiceId;
                                        setDetailModalData(null);
                                        handleSendSingleToMuv(invId);
                                    }}
                                    className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                    <FiRefreshCw size={12} />
                                    <span>Reintentar conexión</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
