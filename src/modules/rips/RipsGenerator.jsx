import React, { useState, useEffect } from 'react';
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";
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

    const handleGenerate = async () => {
        setSearched(true);
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
                if (!dateRange.start || !dateRange.end) return true;
                const raw = filterType === 'facturacion'
                    ? (docData.fecha || docData.fechaFactura || docData.fechaCreacion || docData.createdAt)
                    : (docData.fechaRealizado || docData.fechaServicio || docData.fecha || docData.createdAt);
                const fechaDoc = normalizeFecha(raw);
                if (!fechaDoc) return false;
                return fechaDoc >= dateRange.start && fechaDoc <= dateRange.end;
            };

            let facturas = [];

            // Si el usuario pasó facturas a "Seleccionados", procesar esas exactamente
            if (selectedInvoices.length > 0) {
                facturas = [...selectedInvoices];
                setLogs(prev => [...prev, `📋 Procesando ${facturas.length} facturas seleccionadas en la lista`]);
            } else {
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

            // 2. Cargar Pacientes y mapear por ID, Documento y Nombre
            const { data: patData } = await supabase.from("pacientes").select("*").eq("tenant_id", inquilino);
            const pacientesById = {};
            const pacientesByDoc = {};
            const pacientesByName = {};

            (patData || []).forEach(p => {
                pacientesById[p.id] = p;
                const docNum = String(p.documento || p.nroDocumento || p.cedula || p.numDoc || "").trim();
                if (docNum) pacientesByDoc[docNum] = p;
                const full = (`${p.nombres || p.nombre || ""} ${p.apellidos || ""}`).trim().toLowerCase() || (p.nombreCompleto || "").toLowerCase();
                if (full) pacientesByName[full] = p;
            });

            // 2.5 Filtros opcionales (Sucursal y Tercero / Paciente)
            if (selectedSucursal) {
                const sucursalObj = sucursales.find(s => s.id === selectedSucursal || s.nombre === selectedSucursal);
                const sucursalName = sucursalObj?.nombre || selectedSucursal;
                setLogs(prev => [...prev, `🏢 Filtrando por sucursal: ${sucursalName}`]);
                facturas = facturas.filter(f => {
                    const patient = pacientesById[f.pacienteId || f.paciente_id] || 
                                    pacientesByDoc[f.pacienteDocumento || f.documento || f.numDoc] || 
                                    pacientesByName[(f.pacienteNombre || f.paciente || f.cliente || "").toLowerCase()];
                    if (!patient) return false;
                    return patient.sucursal === sucursalName || patient.sucursalId === selectedSucursal || patient.sede === sucursalName;
                });
            }

            if (selectedEps) {
                setLogs(prev => [...prev, `🛡️ Filtrando por Tercero/Paciente: ${selectedEps}`]);
                const selUpper = selectedEps.trim().toUpperCase();
                facturas = facturas.filter(f => {
                    const patient = pacientesById[f.pacienteId || f.paciente_id] || 
                                    pacientesByDoc[f.pacienteDocumento || f.documento || f.numDoc] || 
                                    pacientesByName[(f.pacienteNombre || f.paciente || f.cliente || "").toLowerCase()];
                    
                    const patName = (`${patient?.nombres || patient?.nombre || ""} ${patient?.apellidos || ""}`).trim().toUpperCase() || (patient?.nombreCompleto || "").trim().toUpperCase();
                    const patEps = (patient?.nombreEps || patient?.eps || "").trim().toUpperCase();
                    const patDoc = String(patient?.documento || patient?.nroDocumento || patient?.cedula || "").trim();
                    const fCliente = (f.cliente || f.nombreTercero || f.tercero || f.pacienteNombre || f.paciente || "").trim().toUpperCase();
                    const fDoc = String(f.pacienteDocumento || f.nit || f.nroDocumento || f.documento || "").trim();

                    return (patName && (patName.includes(selUpper) || selUpper.includes(patName))) || 
                           (patEps && patEps.includes(selUpper)) || 
                           (fCliente && fCliente.includes(selUpper)) || 
                           (patDoc && (selUpper.includes(patDoc) || patDoc === selUpper)) ||
                           (fDoc && (selUpper.includes(fDoc) || fDoc === selUpper));
                });
            }

            if (facturas.length === 0) {
                setDianDocs([]);
                setUsuarios([]);
                setConsultas([]);
                setProcedimientos([]);
                setLogs(prev => [...prev, `ℹ️ Sin registros de facturación encontrados para los filtros seleccionados.`]);
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
                    await supabase.from("rips_generados").insert([{
                        ...fileObj,
                        tenant_id: inquilino,
                        inquilino,
                        created_at: new Date().toISOString()
                    }]);
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
            toast.success(`${newFiles.length} archivos RIPS JSON generados y descargados correctamente.`);

            newFiles.forEach((file, index) => {
                setTimeout(() => {
                    handleDownload(file);
                }, index * 250);
            });

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
        const rows = [
            {
                "Estado": "",
                "Nro. Identificación del paciente": "",
                "Número de la factura": "",
                "Código del Prestador": "",
                "Fecha de Otro Servicio": "",
                "Nro. de Autorización": "",
                "Código del Otro Servicio": "",
                "Tipo de Otro Servicio": "",
                "Tipo Identificación del Profesional": "",
                "Nro. Identificación del Profesional": "",
                "Valor unitario del servicio": 0,
                "Cantidad del servicio": 0,
                "Valor del servicio": 0,
                "Concepto recaudo": "",
                "Valor pago moderador": 0,
                "Número de Factura pago moderador": "",
                "CUV": "",
                "Acciones": ""
            }
        ];
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
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Tipo de nota</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {dianDocs.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                dianDocs.map((doc, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3 h-3 rounded" /></td>
                                                        <td className="py-2 px-3">
                                                            <span className={`w-2 h-2 rounded-full inline-block ${doc.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{doc.id}</td>
                                                        <td className="py-2 px-3 text-slate-500">Factura Electrónica</td>
                                                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{doc.cufe}</td>
                                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">{dianDocs.filter(d => d.errors.length === 0).length}</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">{dianDocs.filter(d => d.errors.length > 0).length}</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
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
                                                            <span className={`w-2 h-2 rounded-full inline-block ${c.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
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
                                                            <span className={`w-2 h-2 rounded-full inline-block ${p.errors.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
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
                                            <tr>
                                                <td colSpan="19" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex gap-6 text-[11px] text-slate-500 font-medium">
                                    <span>Validado correctamente: <strong className="text-slate-700">0</strong></span>
                                    <span>Validado con errores: <strong className="text-slate-700">0</strong></span>
                                    <span>Sin validar: <strong className="text-slate-700">0</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

        </div>
    );
}
