import React, { useState, useEffect, useMemo } from 'react';
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { formatNitForRips } from '../../utils/ripsValidators';
import {
    generateRipsV003,
    validateRipsV003,
    getCupsClassification,
} from './v003';
import {
    adaptClinicalDataToRipsV003
} from './v003/adapters/ripsV003ClinicalAdapter';
import { normalizeRipsBillingSource } from './v003/adapters/ripsBillingSourceAdapter';
import {
    resolveProviderProfile,
    resolveRipsProviderContext,
    validateRipsWithoutFevEligibility,
    RIPS_MODES,
    BILLING_OBLIGATIONS,
    PROVIDER_TYPES,
    RIPS_RESPONSIBILITY,
    PROVIDER_CODE_MODES
} from './v003/services/ripsProviderProfileService';
import { 
    FiActivity, FiCalendar, FiChevronRight, FiDownload, FiSearch, 
    FiFileText, FiAlertTriangle, FiCheckCircle, FiSettings, FiLayers,
    FiSend, FiRefreshCw, FiCopy, FiCheck, FiXCircle, FiInfo, FiClock
} from 'react-icons/fi';
import {
    transmitFevRips,
    transmitRipsWithoutFev,
    formatMuvError,
    loadMuvValidationsMap,
    MUV_UI_STATES,
    MUV_ERROR_CATALOG
} from '../../services/muvService';
import { downloadFactusAttachedDocumentXml } from '../../services/factusProxyService';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";

/**
 * Validador de cruce obligatorio JSON ↔ XML AttachedDocument
 * Verifica que el XML provisto pertenezca a la misma factura electrónica (numFactura).
 * Si hay inconsistencia, previene la inclusión y previene corrupción de paquetes.
 */
export function xmlMatchesInvoice(xmlString, invoiceId) {
    if (!xmlString || typeof xmlString !== 'string') return false;
    const cleanId = String(invoiceId || '').trim();
    if (!cleanId) return false;

    // Buscar en ParentDocumentID (UBL AttachedDocument)
    const parentDocMatch = xmlString.match(/<[^:>]*:?ParentDocumentID[^>]*>([^<]+)<\/[^:>]*:?ParentDocumentID>/i);
    if (parentDocMatch && parentDocMatch[1].trim() === cleanId) {
        return true;
    }

    // Buscar en ID directo del documento
    const idMatches = xmlString.matchAll(/<[^:>]*:?ID[^>]*>([^<]+)<\/[^:>]*:?ID>/gi);
    for (const match of idMatches) {
        if (match[1].trim() === cleanId) {
            return true;
        }
    }

    return false;
}

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

    // Acordeones y filtros de las 5 tablas
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

    // Selección de documentos DIAN para Enviar / Exportar
    const [selectedDianDocIds, setSelectedDianDocIds] = useState(new Set());
    const [exportingPackage, setExportingPackage] = useState(false);

    // Listas de Previsualización y Validación
    const [dianDocs, setDianDocs] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [consultas, setConsultas] = useState([]);
    const [procedimientos, setProcedimientos] = useState([]);
    const [otrosServicios, setOtrosServicios] = useState([]);
    const [searched, setSearched] = useState(false);

    // Paginación por sección (10 por página)
    const [pageDian, setPageDian] = useState(1);
    const [pageUsuarios, setPageUsuarios] = useState(1);
    const [pageConsultas, setPageConsultas] = useState(1);
    const [pageProcedimientos, setPageProcedimientos] = useState(1);
    const [pageOtros, setPageOtros] = useState(1);
    const PAGE_SIZE = 10;

    // Datos del tenant
    const [tenantConfig, setTenantConfig] = useState({
        nit: "",
        codigoPrestador: "",
        razonSocial: "",
        esIps: false
    });
    const [configWarning, setConfigWarning] = useState("");

    // Contexto resuelto del prestador responsable RIPS (Fase RIPS-PROVIDER-CONTEXT)
    const currentProviderContext = useMemo(() => {
        const rawTenant = tenantConfig?.rawTenant || {};
        const rawCfg = tenantConfig?.rawConfig || {};
        const branchObj = selectedSucursal ? sucursales.find(s => s.id === selectedSucursal || s.nombre === selectedSucursal) : null;
        return resolveRipsProviderContext({
            tenant: rawTenant,
            branch: branchObj || selectedSucursal || null,
            configData: rawCfg,
            sisproConfig: rawCfg.sispro_config || {},
        });
    }, [tenantConfig, selectedSucursal, sucursales]);

    // Estado Preflight RIPS v003
    const [preflightStatus, setPreflightStatus] = useState(null); // null | 'VALIDATING' | 'READY' | 'HAS_ERRORS'
    const [preflightSummary, setPreflightSummary] = useState({ total: 0, valid: 0, error: 0, totalErrors: 0 });
    const [preflightValidationMap, setPreflightValidationMap] = useState(new Map());

    // Estado MUV e Idempotencia (P0-A2B2)
    const [transmittingMuv, setTransmittingMuv] = useState(false);
    const [muvValidationsMap, setMuvValidationsMap] = useState(new Map());
    const [copiedCuv, setCopiedCuv] = useState(null);
    const [detailModalData, setDetailModalData] = useState(null);

    const filteredTerceros = useMemo(() => {
        if (!searchTerceroQuery.trim()) return epsList;
        const q = searchTerceroQuery.toLowerCase().trim();
        return epsList.filter(t => 
            (t.label || '').toLowerCase().includes(q) || 
            (t.value || '').toLowerCase().includes(q) || 
            (t.doc && t.doc.toLowerCase().includes(q))
        );
    }, [epsList, searchTerceroQuery]);

    // Filtrado y paginación para Documentos DIAN
    const filteredDian = useMemo(() => {
        if (!filterTextDian.trim()) return dianDocs;
        const q = filterTextDian.toLowerCase().trim();
        return dianDocs.filter(d => 
            (d.id || '').toLowerCase().includes(q) ||
            (d.paciente || '').toLowerCase().includes(q) ||
            (d.cufe || '').toLowerCase().includes(q) ||
            (d.tipoNota || '').toLowerCase().includes(q)
        );
    }, [dianDocs, filterTextDian]);

    const paginatedDian = useMemo(() => {
        const start = (pageDian - 1) * PAGE_SIZE;
        return filteredDian.slice(start, start + PAGE_SIZE);
    }, [filteredDian, pageDian]);

    // Filtrado y paginación para Usuarios
    const filteredUsuarios = useMemo(() => {
        if (!filterTextUsuarios.trim()) return usuarios;
        const q = filterTextUsuarios.toLowerCase().trim();
        return usuarios.filter(u => 
            (u.numDocumentoIdentificacion || '').toLowerCase().includes(q) ||
            (u.tipoDocumentoIdentificacion || '').toLowerCase().includes(q) ||
            (u.nombreCompleto || '').toLowerCase().includes(q) ||
            (u.codMunicipioResidencia || '').toLowerCase().includes(q)
        );
    }, [usuarios, filterTextUsuarios]);

    const paginatedUsuarios = useMemo(() => {
        const start = (pageUsuarios - 1) * PAGE_SIZE;
        return filteredUsuarios.slice(start, start + PAGE_SIZE);
    }, [filteredUsuarios, pageUsuarios]);

    // Filtrado y paginación para Consultas
    const filteredConsultas = useMemo(() => {
        if (!filterTextConsultas.trim()) return consultas;
        const q = filterTextConsultas.toLowerCase().trim();
        return consultas.filter(c => 
            (c.docPaciente || '').toLowerCase().includes(q) ||
            (c.invoiceId || '').toLowerCase().includes(q) ||
            (c.codConsulta || '').toLowerCase().includes(q) ||
            (c.dxPrincipal || '').toLowerCase().includes(q)
        );
    }, [consultas, filterTextConsultas]);

    const paginatedConsultas = useMemo(() => {
        const start = (pageConsultas - 1) * PAGE_SIZE;
        return filteredConsultas.slice(start, start + PAGE_SIZE);
    }, [filteredConsultas, pageConsultas]);

    // Filtrado y paginación para Procedimientos
    const filteredProcedimientos = useMemo(() => {
        if (!filterTextProcedimientos.trim()) return procedimientos;
        const q = filterTextProcedimientos.toLowerCase().trim();
        return procedimientos.filter(p => 
            (p.docPaciente || '').toLowerCase().includes(q) ||
            (p.invoiceId || '').toLowerCase().includes(q) ||
            (p.codProcedimiento || '').toLowerCase().includes(q) ||
            (p.dxPrincipal || '').toLowerCase().includes(q)
        );
    }, [procedimientos, filterTextProcedimientos]);

    const paginatedProcedimientos = useMemo(() => {
        const start = (pageProcedimientos - 1) * PAGE_SIZE;
        return filteredProcedimientos.slice(start, start + PAGE_SIZE);
    }, [filteredProcedimientos, pageProcedimientos]);

    // Filtrado y paginación para Otros Servicios
    const filteredOtrosServicios = useMemo(() => {
        if (!filterTextOtros.trim()) return otrosServicios;
        const q = filterTextOtros.toLowerCase().trim();
        return otrosServicios.filter(o => 
            (o.docPaciente || '').toLowerCase().includes(q) ||
            (o.invoiceId || '').toLowerCase().includes(q) ||
            (o.codTecnologiaSalud || '').toLowerCase().includes(q) ||
            (o.nomTecnologiaSalud || '').toLowerCase().includes(q)
        );
    }, [otrosServicios, filterTextOtros]);

    const paginatedOtrosServicios = useMemo(() => {
        const start = (pageOtros - 1) * PAGE_SIZE;
        return filteredOtrosServicios.slice(start, start + PAGE_SIZE);
    }, [filteredOtrosServicios, pageOtros]);

    const toggleSelectAllDian = () => {
        if (selectedDianDocIds.size === filteredDian.length && filteredDian.length > 0) {
            setSelectedDianDocIds(new Set());
        } else {
            const next = new Set();
            filteredDian.forEach(d => next.add(d.id));
            setSelectedDianDocIds(next);
        }
    };

    const toggleSelectDian = (id) => {
        const next = new Set(selectedDianDocIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedDianDocIds(next);
    };

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
                const prof = resolveProviderProfile(tenantData, cfg);

                setTenantConfig({
                    nit: nitClean,
                    codigoPrestador: codPrestador,
                    razonSocial: rSocial,
                    esIps: prof.providerType === PROVIDER_TYPES.IPS,
                    providerProfile: prof,
                    rawTenant: tenantData,
                    rawConfig: cfg,
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

            const nitObligado = currentProviderContext?.obligatedDocument || tenantConfig.nit || "900000000";
            const codPrestador = currentProviderContext?.providerCode || tenantConfig.codigoPrestador || "000000000001";

            // 3. Procesar cada factura contra las fuentes clínicas reales
            for (const f of facturas) {
                const candidatePacId = f.paciente_id || f.pacienteId || f.patientId || f.paciente?.id || null;
                const patientPlanesForDoc = candidatePacId ? (planesByPatient.get(candidatePacId) || []) : [];
                const normalizedDoc = normalizeRipsBillingSource(f, f._coleccion, { 
                    patientPlanes: patientPlanesForDoc,
                    providerProfile: tenantConfig?.providerProfile,
                    providerContext: currentProviderContext,
                });

                const pacId = normalizedDoc.pacienteId;
                const pacNombre = normalizedDoc.pacienteNombre || (pacId && pacientesById.get(pacId)?.nombreCompleto) || "DESCONOCIDO";
                const pacCedula = normalizedDoc.pacienteDocumento || null;

                const pacienteData = (pacId && pacientesById.get(pacId))
                    || (pacCedula && pacientesByDoc.get(String(pacCedula).trim()))
                    || (pacNombre && pacNombre !== "DESCONOCIDO" ? pacientesByName.get(pacNombre.toLowerCase()) : null)
                    || null;

                const patientDoc = pacienteData?.nroDocumento || pacienteData?.cedula || pacienteData?.documento || pacienteData?.numDoc || pacCedula || (pacId ? null : "0");
                const invoiceId = normalizedDoc.documentNumber;
                const fechaDoc = normalizeFecha(normalizedDoc.fecha) || new Date().toISOString().substring(0, 10);

                const invoiceErrors = [];
                if (!pacienteData) invoiceErrors.push("Paciente no encontrado en base de datos oficial");
                if (!tenantConfig.nit) invoiceErrors.push("Falta NIT de empresa emisora");
                if (!codPrestador || codPrestador.length < 10) invoiceErrors.push("Código REPS inválido o ausente");
                if (normalizedDoc.metadataError) invoiceErrors.push(normalizedDoc.metadataError);

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
                    numDocumentoIdentificacion: patientDoc || pacienteData?.nroDocumento || pacienteData?.cedula || "0",
                    tipoDocumentoIdentificacion: String(pacienteData?.tipoDoc || pacienteData?.tipoDocumento || "CC").toUpperCase(),
                    tipoUsuario: rawTipoUsuario,
                    fechaNacimiento: normalizeFecha(pacienteData?.fechaNacimiento || pacienteData?.fecha_nacimiento) || "",
                    codSexo,
                    codPaisResidencia: "170",
                    codMunicipioResidencia: rawMunicipio,
                    codZonaTerritorialResidencia: rawZona,
                    incapacidad: rawIncapacidad === "01" || pacienteData?.incapacidad ? "Si" : "No",
                    codPaisOrigen: "170",
                    registroSiras: "",
                    nombreCompleto: pacienteData ? (pacienteData.nombreCompleto || `${pacienteData.nombres || ""} ${pacienteData.apellidos || ""}`.trim()) : pacNombre,
                    errors: patientErrors
                };

                if (!userList.some(u => u.numDocumentoIdentificacion === usuarioWithValidation.numDocumentoIdentificacion)) {
                    userList.push(usuarioWithValidation);
                }

                // Resolver atenciones clínicas reales para cada ítem facturado/cobrado
                const invoiceItems = normalizedDoc.items;
                const adaptedAtencionesForInvoice = [];
                const effectivePacId = pacienteData?.id || pacId;
                const patientConsultas = effectivePacId ? (docClinicosByPatient.get(effectivePacId) || []) : [];
                const patientEvoluciones = effectivePacId ? (evolucionesByPatient.get(effectivePacId) || []) : [];
                const patientPlanes = effectivePacId ? (planesByPatient.get(effectivePacId) || []) : [];

                for (let i = 0; i < invoiceItems.length; i++) {
                    const item = invoiceItems[i];
                    const descText = String(item.descripcion || item.concepto || item.desc || item.nombre || "").trim();
                    const upperDesc = descText.toUpperCase();
                    const rawCupsCandidate = String(item.cups || item.codigo_cups || item.codigo || item.code || "").trim().toUpperCase();

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

                const isWithoutFevMode = normalizedDoc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV || normalizedDoc.sourceMode === RIPS_MODES.LOCAL_PREVIEW;

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
                                numFactura: isWithoutFevMode ? null : invoiceId,
                                isWithoutFev: isWithoutFevMode,
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
                                options: { 
                                    skipFlagCheck: true, 
                                    skipRepsCheck: true,
                                    billingMode: normalizedDoc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV 
                                        ? "OFFICIAL_RIPS_WITHOUT_FEV" 
                                        : (normalizedDoc.sourceMode === RIPS_MODES.LOCAL_PREVIEW ? "OFFICIAL_RIPS_WITHOUT_FEV" : "OFFICIAL_FEV"),
                                }
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
                        paciente: pacNombre,
                        sourceMode: normalizedDoc.sourceMode,
                    });
                } else {
                    totalErrorFacturas++;
                    cumulativeErrorsCount += invoiceErrors.length;
                    validationMap.set(invoiceId, {
                        valid: false,
                        errors: invoiceErrors,
                        invoiceId,
                        paciente: pacNombre,
                        sourceMode: normalizedDoc.sourceMode,
                    });
                }

                dianList.push({
                    id: invoiceId,
                    paciente: pacNombre,
                    cufe: f.cufe || f.cufeFactura || "SIN_CUFE",
                    errors: invoiceErrors,
                    status: isValidInvoice 
                        ? (normalizedDoc.sourceMode === RIPS_MODES.LOCAL_PREVIEW 
                            ? "LOCAL_PREVIEW" 
                            : (normalizedDoc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV ? "RIPS_SIN_FEV" : "LISTO")) 
                        : "CON_ERRORES",
                    tipoNota: f.tipoNota || null,
                    rawDoc: f,
                    sourceMode: normalizedDoc.sourceMode,
                    isOfficialInvoice: normalizedDoc.isOfficialInvoice,
                    isOfficialRips: normalizedDoc.isOfficialRips,
                    numFactura: normalizedDoc.numFactura,
                });
            }

            setDianDocs(dianList);
            setUsuarios(userList);
            setConsultas(conList);
            setProcedimientos(procList);
            setOtrosServicios(otrosList);

            setSelectedDianDocIds(new Set());
            setPageDian(1);
            setPageUsuarios(1);
            setPageConsultas(1);
            setPageProcedimientos(1);
            setPageOtros(1);

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
                const hasOnlyLocalPreview = dianList.every(d => d.sourceMode === RIPS_MODES.LOCAL_PREVIEW);
                const hasOnlyRipsWithoutFev = dianList.every(d => d.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV);

                if (hasOnlyLocalPreview) {
                    setPreflightStatus("LOCAL_PREVIEW");
                    setLogs(prev => [...prev, `ℹ️ Preflight Previsualización Local: ${totalValidFacturas} documento(s) validados localmente (Recibos no FEV).`]);
                } else if (hasOnlyRipsWithoutFev) {
                    setPreflightStatus("OFFICIAL_RIPS_WITHOUT_FEV");
                    setLogs(prev => [...prev, `✅ Preflight RIPS sin Factura Exitoso: ${totalValidFacturas} documento(s) validados según DT1 vigente.`]);
                    toast.success(`Preflight listo: ${totalValidFacturas} documentos validados para RIPS sin Factura.`);
                } else {
                    setPreflightStatus("READY");
                    setLogs(prev => [...prev, `✅ Preflight 100% Exitoso: ${totalValidFacturas} facturas validadas con fuentes clínicas reales y 0 errores.`]);
                    toast.success(`Preflight listo: ${totalValidFacturas} facturas validadas correctamente.`);
                }
            } else {
                setPreflightStatus("HAS_ERRORS");
                setLogs(prev => [...prev, `⚠️ Preflight con observaciones: ${totalErrorFacturas} documento(s) tienen inconsistencias (${cumulativeErrorsCount} errores detectados).`]);
                toast.warning(`Preflight completado: ${totalErrorFacturas} documento(s) con errores.`);
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

    const handleSendRipsWithoutFevToMuv = async (docId) => {
        if (transmittingMuv) return;
        const targetDoc = dianDocs.find(d => d.id === docId);
        if (!targetDoc || targetDoc.sourceMode !== RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV) {
            toast.error("Este documento no está configurado bajo la modalidad oficial de RIPS sin Factura.");
            return;
        }

        const preflightData = preflightValidationMap.get(docId);
        if (!preflightData || !preflightData.valid || !preflightData.ripsJson) {
            toast.error("Corrige los datos clínicos antes de enviar.");
            return;
        }

        setTransmittingMuv(true);
        const toastId = toast.loading(`Transmitiendo RIPS sin Factura ${docId} al MUV...`);

        try {
            const res = await transmitRipsWithoutFev({
                ripsJson: preflightData.ripsJson,
            });

            toast.dismiss(toastId);
            if (res.success && res.cuv) {
                toast.success(`¡Validado formalmente por MinSalud! CUV: ${res.cuv}`);
                setMuvValidationsMap(prev => {
                    const next = new Map(prev);
                    next.set(docId, {
                        id: res.validationId || docId,
                        estadoDb: "VALIDADO",
                        uiState: MUV_UI_STATES.ACCEPTED,
                        cuv: res.cuv,
                        errores: [],
                        advertencias: res.advertencias || [],
                        fechaRadicacion: res.fechaRadicacion,
                    });
                    return next;
                });
            } else if (res.estado === "REJECTED") {
                toast.error(`Rechazado por MUV: ${res.errores?.[0]?.friendlyDescription || res.message}`);
            } else {
                toast.error(`Aviso MUV: ${res.message || "Error en validación"}`);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(`Fallo de transmisión: ${err.message}`);
        } finally {
            setTransmittingMuv(false);
        }
    };

    const handleSendSingleToMuv = async (invoiceId) => {
        if (transmittingMuv) return; // Protección anti doble-clic

        const targetDianDoc = dianDocs.find(d => d.id === invoiceId);
        if (targetDianDoc?.sourceMode === RIPS_MODES.LOCAL_PREVIEW) {
            toast.error("OFFICIAL_FEV_REQUIRED: No se puede enviar a MUV desde un recibo de previsualización local. Se requiere una Factura Electrónica en Salud (FEV) oficial emitida ante la DIAN, o configurar el perfil de Profesional Independiente no obligado a facturar.");
            return;
        }
        if (targetDianDoc?.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV) {
            return handleSendRipsWithoutFevToMuv(invoiceId);
        }

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

    const getDateSuffix = () => {
        const startClean = (dateRange.start || '').replace(/-/g, '');
        const endClean = (dateRange.end || '').replace(/-/g, '');
        return `${startClean}-${endClean}`;
    };

    const buildExcelWithSummary = (rows, headers, summaryCounts, sheetName, fileName) => {
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        if (summaryCounts) {
            const startRow = (rows.length > 0 ? rows.length : 1) + 2;
            XLSX.utils.sheet_add_aoa(ws, [
                [`Validado correctamente: ${summaryCounts.valid}`],
                [`Validado con errores: ${summaryCounts.error}`],
                [`Sin validar: ${summaryCounts.unvalidated}`]
            ], { origin: `B${startRow}` });
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
    };

    const exportDianExcel = () => {
        const suffix = getDateSuffix();
        const rows = (dianDocs.length > 0 ? dianDocs : []).map(d => {
            const muvInfo = muvValidationsMap.get(d.id);
            const isValid = d.errors.length === 0;
            return {
                "Estado": (muvInfo?.cuv || isValid) ? "Validado" : "Con errores",
                "Número de la factura": d.id || "",
                "Tipo de nota": d.tipoNota || "",
                "CUV": muvInfo?.cuv || "",
                "Acciones": ""
            };
        });
        const summary = {
            valid: dianDocs.filter(d => d.errors.length === 0).length,
            error: dianDocs.filter(d => d.errors.length > 0).length,
            unvalidated: preflightStatus === null ? dianDocs.length : 0
        };
        buildExcelWithSummary(
            rows, 
            ["Estado", "Número de la factura", "Tipo de nota", "CUV", "Acciones"], 
            summary, 
            "Documentos DIAN", 
            `Documentos DIAN${suffix}.xlsx`
        );
        toast.success("Documentos DIAN exportados a Excel");
    };

    const exportUsuariosExcel = () => {
        const suffix = getDateSuffix();
        const rows = (usuarios.length > 0 ? usuarios : []).map(u => ({
            "Tipo de documento Identificación": u.tipoDocumentoIdentificacion || "CC",
            "Nro. documento de Identificación": u.numDocumentoIdentificacion || "",
            "Tipo de Usuario": u.tipoUsuario || "01",
            "Fecha de nacimiento": u.fechaNacimiento || "",
            "cod. Sexo": u.codSexo || "",
            "Cód. pais de residencia": u.codPaisResidencia || "170",
            "Cód. Municipo residencia": u.codMunicipioResidencia || "",
            "Cód Zona de Residencia": u.codZonaTerritorialResidencia || "02",
            "Incapacidad": u.incapacidad === "01" || u.incapacidad === "SI" || u.incapacidad === "Si" ? "Si" : "No",
            "Cod. pais de origen": u.codPaisOrigen || "170",
            "Registro SIRAS": "",
            "Acciones": ""
        }));
        buildExcelWithSummary(
            rows, 
            [
                "Tipo de documento Identificación",
                "Nro. documento de Identificación",
                "Tipo de Usuario",
                "Fecha de nacimiento",
                "cod. Sexo",
                "Cód. pais de residencia",
                "Cód. Municipo residencia",
                "Cód Zona de Residencia",
                "Incapacidad",
                "Cod. pais de origen",
                "Registro SIRAS",
                "Acciones"
            ], 
            null, 
            "Usuarios", 
            `Usuarios${suffix}.xlsx`
        );
        toast.success("Usuarios exportados a Excel");
    };

    const exportConsultasExcel = () => {
        const suffix = getDateSuffix();
        const rows = (consultas.length > 0 ? consultas : []).map(c => ({
            "Estado": c.errors.length === 0 ? "Validado" : "Con errores",
            "Identificación del paciente": c.docPaciente || "",
            "Número de la factura": c.invoiceId || "",
            "Código del Prestador": c.codPrestador || "",
            "Fecha de Consulta": c.fechaInicio || "",
            "Nro de Autorización": c.numAutorizacion || "",
            "Código de la consulta": c.codConsulta || "",
            "Modalidad": c.modalidadGrupoServicioTecSal || "01",
            "Grupo servicio": c.grupoServicios || "01",
            "Cod. servicio": c.codServicio || 334,
            "Finalidad de la consulta": c.finalidadTecnologiaSalud || "10",
            "Causa/motivo atención": c.causaMotivoAtencion || "38",
            "Cód dx Principal": c.dxPrincipal || "",
            "Cód dx Rel 1": c.codDiagnosticoRelacionado1 || "",
            "Cód dx Rel 2": "",
            "Cód dx Rel 3": "",
            "Tipo de Diagnóstico": c.tipoDiagnosticoPrincipal || "01",
            "Tipo de Identificación del Profesional": c.tipoDocumentoIdentificacion || "CC",
            "Identificación del Profesional": c.numDocumentoIdentificacion || "",
            "Valor de la consulta": c.valorServicio || 0,
            "Concepto recaudo": c.conceptoRecaudo || "05",
            "Valor pago moderador": c.valorPagoModerador || 0,
            "Número de factura pago moderador": c.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const summary = {
            valid: consultas.filter(c => c.errors.length === 0).length,
            error: consultas.filter(c => c.errors.length > 0).length,
            unvalidated: preflightStatus === null ? consultas.length : 0
        };
        buildExcelWithSummary(
            rows, 
            [
                "Estado", "Identificación del paciente", "Número de la factura", "Código del Prestador",
                "Fecha de Consulta", "Nro de Autorización", "Código de la consulta", "Modalidad",
                "Grupo servicio", "Cod. servicio", "Finalidad de la consulta", "Causa/motivo atención",
                "Cód dx Principal", "Cód dx Rel 1", "Cód dx Rel 2", "Cód dx Rel 3", "Tipo de Diagnóstico",
                "Tipo de Identificación del Profesional", "Identificación del Profesional", "Valor de la consulta",
                "Concepto recaudo", "Valor pago moderador", "Número de factura pago moderador", "CUV", "Acciones"
            ], 
            summary, 
            "Consultas", 
            `Consultas${suffix}.xlsx`
        );
        toast.success("Consultas exportadas a Excel");
    };

    const exportProcedimientosExcel = () => {
        const suffix = getDateSuffix();
        const rows = (procedimientos.length > 0 ? procedimientos : []).map(p => ({
            "Estado": p.errors.length === 0 ? "Validado" : "Con errores",
            "Nro. Identificación del paciente": p.docPaciente || "",
            "Número de la factura": p.invoiceId || "",
            "Código del Prestador": p.codPrestador || "",
            "Fecha de Procedimiento": p.fechaProcedimiento || "",
            "Nro. de Autorización": p.numAutorizacion || "",
            "Código del Procedimiento": p.codProcedimiento || "",
            "Modalidad": p.modalidadGrupoServicioTecSal || "01",
            "Grupo de servicios": p.grupoServicios || "02",
            "Cod. servicio": p.codServicio || 334,
            "Tipo Identificación del Profesional": p.tipoDocumentoIdentificacion || "CC",
            "Nro.Identificación del Profesional": p.numDocumentoIdentificacion || "",
            "Cód dx Principal": p.dxPrincipal || "",
            "Cód dx Relacionado": p.codDiagnosticoRelacionado || "",
            "Finalidad del procedimiento": p.finalidadTecnologiaSalud || "02",
            "Complicación": p.codComplicacion || "",
            "Valor del servicio": p.valorServicio || 0,
            "Concepto recaudo": p.conceptoRecaudo || "05",
            "Valor pago moderador": p.valorPagoModerador || 0,
            "Número de factura pago moderador": p.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const summary = {
            valid: procedimientos.filter(p => p.errors.length === 0).length,
            error: procedimientos.filter(p => p.errors.length > 0).length,
            unvalidated: preflightStatus === null ? procedimientos.length : 0
        };
        buildExcelWithSummary(
            rows, 
            [
                "Estado", "Nro. Identificación del paciente", "Número de la factura", "Código del Prestador",
                "Fecha de Procedimiento", "Nro. de Autorización", "Código del Procedimiento", "Modalidad",
                "Grupo de servicios", "Cod. servicio", "Tipo Identificación del Profesional",
                "Nro.Identificación del Profesional", "Cód dx Principal", "Cód dx Relacionado",
                "Finalidad del procedimiento", "Complicación", "Valor del servicio", "Concepto recaudo",
                "Valor pago moderador", "Número de factura pago moderador", "CUV", "Acciones"
            ], 
            summary, 
            "Procedimientos", 
            `Procedimientos${suffix}.xlsx`
        );
        toast.success("Procedimientos exportados a Excel");
    };

    const exportOtrosServiciosExcel = () => {
        const suffix = getDateSuffix();
        const rows = (otrosServicios.length > 0 ? otrosServicios : []).map(o => ({
            "Estado": (!o.errors || o.errors.length === 0) ? "Validado" : "Con errores",
            "Nro. Identificación del paciente": o.docPaciente || "",
            "Número de la factura": o.invoiceId || "",
            "Código del Prestador": o.codPrestador || "",
            "Fecha de Otro Servicio": o.fechaSuministroTecnologia || "",
            "Nro. de Autorización": o.numAutorizacion || "",
            "Código del Otro Servicio": o.codTecnologiaSalud || "",
            "Tipo de Otro Servicio": o.tipoOS || "01",
            "Tipo Identificación del Profesional": o.tipoDocumentoIdentificacion || "CC",
            "Nro.Identificación del Profesional": o.numDocumentoIdentificacion || "",
            "Valor unitario del servicio": o.vrUnitOS || 0,
            "Cantidad del servicio": o.cantidadOS || 0,
            "Valor del servicio": o.vrServicio || 0,
            "Concepto recaudo": o.conceptoRecaudo || "05",
            "Valor pago moderador": o.valorPagoModerador || 0,
            "Número de factura pago moderador": o.numFEVPagoModerador || "",
            "CUV": "",
            "Acciones": ""
        }));
        const summary = {
            valid: otrosServicios.filter(o => !o.errors || o.errors.length === 0).length,
            error: otrosServicios.filter(o => o.errors && o.errors.length > 0).length,
            unvalidated: preflightStatus === null ? otrosServicios.length : 0
        };
        buildExcelWithSummary(
            rows, 
            [
                "Estado", "Nro. Identificación del paciente", "Número de la factura", "Código del Prestador",
                "Fecha de Otro Servicio", "Nro. de Autorización", "Código del Otro Servicio", "Tipo de Otro Servicio",
                "Tipo Identificación del Profesional", "Nro.Identificación del Profesional", "Valor unitario del servicio",
                "Cantidad del servicio", "Valor del servicio", "Concepto recaudo", "Valor pago moderador",
                "Número de factura pago moderador", "CUV", "Acciones"
            ], 
            summary, 
            "Otros Servicios", 
            `OtrosServicios${suffix}.xlsx`
        );
        toast.success("Otros Servicios exportados a Excel");
    };

    // ─────────────────────────────────────────────────────────────
    // EXPORTACIÓN SUPERIOR: PAQUETE RIPS COMPRIMIDO (ZIP)
    // Estructura: RIPS{START}-{END}/{FACTURA}/{FACTURA}.json y {FACTURA}.xml
    // Cruce obligatorio JSON ↔ XML. Sin XML falso.
    // ─────────────────────────────────────────────────────────────
    const handleBulkExportPackage = async () => {
        if (!searched) {
            toast.info("Debe presionar BUSCAR primero para cargar las facturas.");
            return;
        }

        let targetDocs = [];
        if (selectedDianDocIds.size > 0) {
            targetDocs = dianDocs.filter(d => selectedDianDocIds.has(d.id));
        } else {
            targetDocs = dianDocs;
        }

        if (targetDocs.length === 0) {
            toast.error("No hay facturas para exportar.");
            return;
        }

        setExportingPackage(true);
        const toastId = toast.loading("Generando paquete RIPS comprimido...");
        try {
            const suffix = getDateSuffix();
            const zipRootName = `RIPS${suffix}`;
            const zip = new JSZip();
            const rootFolder = zip.folder(zipRootName);

            let missingXmlCount = 0;
            let exportedCount = 0;

            for (const doc of targetDocs) {
                const invoiceId = doc.id;
                const validationEntry = preflightValidationMap.get(invoiceId);
                const ripsJson = validationEntry?.ripsJson || null;

                const invoiceFolder = rootFolder.folder(invoiceId);

                // 1. Incluir JSON normativo
                if (ripsJson) {
                    if (doc.sourceMode === RIPS_MODES.LOCAL_PREVIEW) {
                        invoiceFolder.file(`${invoiceId}_preliminar.json`, JSON.stringify(ripsJson, null, 2));
                    } else if (doc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV) {
                        invoiceFolder.file(`${invoiceId}_rips_sin_fev.json`, JSON.stringify(ripsJson, null, 2));
                    } else {
                        invoiceFolder.file(`${invoiceId}.json`, JSON.stringify(ripsJson, null, 2));
                    }
                }

                // 2. Obtener AttachedDocument XML real (solo para OFFICIAL_FEV, sin inventar XML)
                if (doc.sourceMode === RIPS_MODES.OFFICIAL_FEV) {
                    let xmlContent = doc.rawDoc?.attached_document_xml || doc.rawDoc?.xml_content || doc.rawDoc?.xml || null;

                    if (!xmlContent && doc.rawDoc?.factus_id) {
                        try {
                            const xmlRes = await downloadFactusAttachedDocumentXml(invoiceId);
                            if (xmlRes?.xml || xmlRes?.attachedDocument) {
                                xmlContent = xmlRes.xml || xmlRes.attachedDocument;
                            }
                        } catch (xmlErr) {
                            console.warn(`No se pudo descargar AttachedDocument para ${invoiceId}:`, xmlErr);
                        }
                    }

                    if (xmlContent) {
                        // Cruce obligatorio JSON ↔ XML
                        const isCoherent = xmlMatchesInvoice(xmlContent, invoiceId);
                        if (!isCoherent) {
                            console.error(`RIPS_EXPORT_INVOICE_MISMATCH: XML AttachedDocument no coincide con factura ${invoiceId}`);
                            toast.error(`RIPS_EXPORT_INVOICE_MISMATCH: Factura ${invoiceId} tiene XML no coincidente. Se excluye XML.`);
                        } else {
                            invoiceFolder.file(`${invoiceId}.xml`, xmlContent);
                        }
                    } else {
                        missingXmlCount++;
                    }
                }

                exportedCount++;
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${zipRootName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.dismiss(toastId);
            if (missingXmlCount > 0) {
                toast.warning(`El RIPS está disponible, pero el documento electrónico de ${missingXmlCount} factura(s) aún no ha sido generado o validado. Paquete oficial marcado como INCOMPLETO.`, { duration: 6000 });
            } else {
                toast.success(`Paquete RIPS comprimido exportado con éxito (${exportedCount} facturas con JSON y XML).`);
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(`Error al exportar paquete RIPS: ${err.message}`);
        } finally {
            setExportingPackage(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // ACCIÓN SUPERIOR: ENVIAR RIPS A MUV
    // Solo transmite facturas seleccionadas o válidas con AttachedDocument
    // ─────────────────────────────────────────────────────────────
    const handleBulkSendToMuv = async () => {
        if (transmittingMuv) return;
        if (!searched) {
            toast.info("Debe presionar BUSCAR primero para cargar las facturas.");
            return;
        }

        let targetDocs = [];
        if (selectedDianDocIds.size > 0) {
            targetDocs = dianDocs.filter(d => selectedDianDocIds.has(d.id));
        } else {
            targetDocs = dianDocs.filter(d => d.errors.length === 0);
        }

        if (targetDocs.length === 0) {
            toast.error("Seleccione al menos una factura válida para enviar al MUV.");
            return;
        }

        const localPreviews = targetDocs.filter(d => d.sourceMode === 'LOCAL_PREVIEW' || !d.isOfficialInvoice);
        if (localPreviews.length > 0) {
            toast.error("OFFICIAL_FEV_REQUIRED: Se seleccionaron documentos de previsualización local (recibos/pagos). Se requiere Factura Electrónica en Salud (FEV) oficial para enviar a MinSalud.");
            return;
        }

        // Validación de AttachedDocument
        const unattached = targetDocs.filter(d => {
            const hasXml = Boolean(d.rawDoc?.attached_document_xml || d.rawDoc?.xml_content || d.rawDoc?.xml);
            const hasCufe = Boolean(d.cufe && d.cufe !== "SIN_CUFE");
            const hasFactus = Boolean(d.rawDoc?.factus_id);
            return !hasXml && !hasCufe && !hasFactus;
        });

        if (unattached.length > 0) {
            toast.error(`MUV bloqueado: ${unattached.length} factura(s) no cuentan con AttachedDocument DIAN validado.`);
            return;
        }

        const withErrors = targetDocs.filter(d => d.errors.length > 0);
        if (withErrors.length > 0) {
            toast.error("Corrige los datos clínicos antes de enviar.");
            return;
        }

        setTransmittingMuv(true);
        setLogs(prev => [...prev, `🚀 [MUV] Transmitiendo ${targetDocs.length} factura(s) al MUV...`]);
        for (const doc of targetDocs) {
            await handleSendSingleToMuv(doc.id);
        }
        setTransmittingMuv(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animation-fade-in-up font-sans text-slate-800 space-y-5 pb-12">
            
            {/* Header & Breadcrumb con Acciones Superiores */}
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
                
                {/* Acciones Superiores: ENVIAR y EXPORTAR */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        id="btn-superior-enviar-rips"
                        onClick={handleBulkSendToMuv}
                        disabled={transmittingMuv || !searched}
                        className="h-8 px-4 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Validar y transmitir facturas seleccionadas al MUV"
                    >
                        <FiSend size={13} />
                        <span>ENVIAR</span>
                    </button>
                    <button
                        type="button"
                        id="btn-superior-exportar-paquete"
                        onClick={handleBulkExportPackage}
                        disabled={exportingPackage || !searched}
                        className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Descargar paquete RIPS comprimido (carpeta por factura con .json y .xml)"
                    >
                        <FiDownload size={13} />
                        <span>EXPORTAR</span>
                    </button>
                </div>
            </div>

            {/* Contexto Normativo del Prestador Responsable (Fase RIPS-PROVIDER-CONTEXT) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                        <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                            Contexto Normativo del Prestador Responsable RIPS
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(buildDashboardPath("config"))}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        <FiSettings size={12} /> Configurar Prestador / Sede
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3">
                    {/* 1. Prestador Responsable */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Prestador Responsable
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                            {currentProviderContext.ripsResponsibility === RIPS_RESPONSIBILITY.INSTITUTION
                                ? "IPS (Institucional)"
                                : currentProviderContext.ripsResponsibility === RIPS_RESPONSIBILITY.PROFESSIONAL
                                ? "Profesional Independiente"
                                : currentProviderContext.providerType === PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE
                                ? "Profesional Independiente"
                                : "Sin confirmar"}
                        </span>
                    </div>

                    {/* 2. Código Prestador */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Código Prestador
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-800">
                            {currentProviderContext.providerCode || (
                                currentProviderContext.providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH
                                    ? "Por sede (sin asignar)"
                                    : "No configurado"
                            )}
                        </span>
                    </div>

                    {/* 3. Modalidad RIPS */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Modalidad RIPS
                        </span>
                        <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                currentProviderContext.ripsMode === RIPS_MODES.OFFICIAL_FEV
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : currentProviderContext.ripsMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV
                                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                    : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                                {currentProviderContext.ripsMode === RIPS_MODES.OFFICIAL_FEV
                                    ? "FEV + RIPS"
                                    : currentProviderContext.ripsMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV
                                    ? "RIPS sin FEV"
                                    : "Previsualización local"}
                            </span>
                        </div>
                    </div>

                    {/* 4. Facturación Electrónica */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Facturación Electrónica
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                            {currentProviderContext.billingObligation === BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED
                                ? "Obligado"
                                : currentProviderContext.billingObligation === BILLING_OBLIGATIONS.NOT_REQUIRED
                                ? "No obligado"
                                : "Sin confirmar"}
                        </span>
                    </div>

                    {/* 5. SISPRO */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            SISPRO
                        </span>
                        <div className="flex items-center gap-1.5">
                            {currentProviderContext.sisproConfigured ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                    <FiCheckCircle className="text-emerald-500" size={13} /> Configurado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                                    <FiXCircle className="text-slate-400" size={13} /> No configurado
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-alerta contextual si hay bloqueo de sede */}
                {currentProviderContext.error === "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH" && (
                    <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                        <FiAlertTriangle className="text-rose-600 shrink-0" size={14} />
                        <span>
                            <strong>RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH:</strong> La sede actual no tiene configurado su código de habilitación de prestador (REPS). Configure la sede antes de transmitir paquetes oficiales.
                        </span>
                    </div>
                )}
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
                                : preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV'
                                ? 'bg-sky-50/95 border-sky-300 text-sky-900'
                                : preflightStatus === 'LOCAL_PREVIEW'
                                ? 'bg-amber-50/95 border-amber-300 text-amber-900'
                                : 'bg-rose-50/95 border-rose-300 text-rose-900'
                        }`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                        preflightStatus === 'READY' ? 'bg-emerald-200 text-emerald-800' :
                                        preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV' ? 'bg-sky-200 text-sky-800' :
                                        preflightStatus === 'LOCAL_PREVIEW' ? 'bg-amber-200 text-amber-800' :
                                        'bg-rose-200 text-rose-800'
                                    }`}>
                                        {preflightStatus === 'READY' || preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV' 
                                            ? <FiCheckCircle size={20} /> 
                                            : preflightStatus === 'LOCAL_PREVIEW' 
                                            ? <FiInfo size={20} />
                                            : <FiAlertTriangle size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase ${
                                                preflightStatus === 'READY' ? 'bg-emerald-600 text-white' :
                                                preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV' ? 'bg-sky-600 text-white' :
                                                preflightStatus === 'LOCAL_PREVIEW' ? 'bg-amber-600 text-white' :
                                                'bg-rose-600 text-white'
                                            }`}>
                                                {preflightStatus === 'READY' ? 'LISTO FEV-RIPS' :
                                                 preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV' ? 'RIPS SIN FACTURA (OFICIAL)' :
                                                 preflightStatus === 'LOCAL_PREVIEW' ? 'PREVISUALIZACIÓN LOCAL' :
                                                 'ERRORES DE DATOS CLÍNICOS'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800">
                                                {preflightStatus === 'READY' 
                                                    ? 'Validación FEV-RIPS v003 100% Superada (Fuentes Clínicas Reales)' 
                                                    : preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV'
                                                    ? 'Validación RIPS sin Factura 100% Superada (DT1 v003 - Profesional Independiente)'
                                                    : preflightStatus === 'LOCAL_PREVIEW'
                                                    ? 'Previsualización Local de RIPS (Documento no FEV / Recibo Interno)'
                                                    : `Bloqueo Preflight: ${preflightSummary?.totalErrors || 0} inconsistencia(s) detectada(s)`}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1.5 text-slate-600 leading-relaxed">
                                            {preflightStatus === 'READY'
                                                ? `Se validaron exitosamente ${preflightSummary?.valid || 0} factura(s). Todas las atenciones provienen de evoluciones o documentos clínicos reales completados, con CUPS oficial y diagnósticos CIE-10 normativos.`
                                                : preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV'
                                                ? `Se validaron ${preflightSummary?.valid || 0} documento(s) bajo la modalidad oficial de RIPS sin Factura (numFactura: null, sin contenedor XML). Apto para transmisión formal al MUV.`
                                                : preflightStatus === 'LOCAL_PREVIEW'
                                                ? `Los datos RIPS son válidos localmente, pero este documento todavía no tiene una modalidad oficial de transmisión definida. Para transmitir formalmente a MinSalud se requiere una Factura Electrónica en Salud (FEV) o un perfil confirmado de Profesional Independiente no obligado a facturar.`
                                                : `Se detectaron inconsistencias clínicas en ${preflightSummary?.error || 0} de ${preflightSummary?.total || 0} documento(s). La generación de JSON normativo se detiene para evitar rechazos en el validador MUV/MinSalud.`}
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
                                    ) : preflightStatus === 'OFFICIAL_RIPS_WITHOUT_FEV' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadOfficialRips(true)}
                                                className="h-9 px-3.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                                                title="Descargar paquete RIPS sin Factura en formato JSON"
                                            >
                                                <FiDownload size={14} />
                                                <span>Descargar RIPS Sin FEV ({preflightSummary?.valid})</span>
                                            </button>

                                            <button
                                                type="button"
                                                id="btn-enviar-muv-global"
                                                disabled={transmittingMuv}
                                                onClick={handleSendBatchToMuv}
                                                className="h-9 px-4 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                                                title="Transmitir RIPS sin Factura a MUV MinSalud"
                                            >
                                                {transmittingMuv ? (
                                                    <>
                                                        <FiRefreshCw size={14} className="animate-spin" />
                                                        <span>Transmitiendo a MinSalud...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiSend size={14} />
                                                        <span>Transmitir Sin FEV a MUV ({preflightSummary?.valid})</span>
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    ) : preflightStatus === 'LOCAL_PREVIEW' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadOfficialRips(true)}
                                                className="h-9 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                                                title="Descargar JSON de previsualización local (no oficial)"
                                            >
                                                <FiDownload size={14} />
                                                <span>Descargar RIPS Preliminar ({preflightSummary?.valid})</span>
                                            </button>
                                            <span 
                                                className="text-[11px] text-amber-800 font-semibold bg-amber-100/90 px-2.5 py-1.5 rounded-lg border border-amber-300"
                                                title="OFFICIAL_FEV_REQUIRED: Los recibos de caja son solo de previsualización y no pueden enviarse a MUV salvo FEV oficial o RIPS sin Factura autorizado"
                                            >
                                                MUV Bloqueado (Previsualización Local)
                                            </span>
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
                                {selectedDianDocIds.size > 0 && (
                                    <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold border border-sky-200">
                                        {selectedDianDocIds.size} seleccionada(s)
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button title="Exportar a Excel" onClick={exportDianExcel} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"><FiFileText size={13} /></button>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar..."
                                        value={filterTextDian}
                                        onChange={e => {
                                            setFilterTextDian(e.target.value);
                                            setPageDian(1);
                                        }}
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
                                                <th className="py-2 px-3 text-center w-12">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={filteredDian.length > 0 && selectedDianDocIds.size === filteredDian.length}
                                                        onChange={toggleSelectAllDian}
                                                        className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300 cursor-pointer" 
                                                    />
                                                </th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Número documento / Soporte</th>
                                                <th className="py-2 px-3">Tipo de nota</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {paginatedDian.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                paginatedDian.map((doc, idx) => {
                                                    const invoiceId = doc.id;
                                                    const muvInfo = muvValidationsMap.get(invoiceId);
                                                    const isChecked = selectedDianDocIds.has(invoiceId);

                                                    let badgeLabel = "SIN VALIDAR";
                                                    let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";

                                                    if (doc.sourceMode === RIPS_MODES.LOCAL_PREVIEW) {
                                                        badgeLabel = "PREVISUALIZACIÓN LOCAL";
                                                        badgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold";
                                                    } else if (doc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV) {
                                                        badgeLabel = "RIPS SIN FEV";
                                                        badgeClass = "bg-sky-100 text-sky-800 border-sky-300 font-bold";
                                                    } else if (muvInfo?.cuv || muvInfo?.uiState === MUV_UI_STATES.ACCEPTED) {
                                                        badgeLabel = "VALIDADO";
                                                        badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
                                                    } else if (doc.errors.length === 0) {
                                                        badgeLabel = "VALIDADO";
                                                        badgeClass = "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
                                                    } else {
                                                        badgeLabel = "CON ERRORES";
                                                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                                                    }

                                                    return (
                                                         <tr key={idx} className={`hover:bg-slate-50/60 ${isChecked ? 'bg-sky-50/30' : ''}`}>
                                                             <td className="py-2 px-3 text-center">
                                                                 <input 
                                                                     type="checkbox" 
                                                                     checked={isChecked}
                                                                     onChange={() => toggleSelectDian(invoiceId)}
                                                                     className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300 cursor-pointer" 
                                                                 />
                                                             </td>
                                                             <td className="py-2 px-3">
                                                                 <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${badgeClass}`}>
                                                                     {badgeLabel}
                                                                 </span>
                                                             </td>
                                                             <td className="py-2 px-3">
                                                                 {doc.sourceMode === RIPS_MODES.LOCAL_PREVIEW ? (
                                                                     <div className="flex flex-col">
                                                                         <span className="font-bold text-slate-800">Recibo: {doc.id}</span>
                                                                         <span className="text-[10px] text-amber-700 font-medium">Factura: No aplica (Previsualización Local)</span>
                                                                     </div>
                                                                 ) : doc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV ? (
                                                                     <div className="flex flex-col">
                                                                         <span className="font-bold text-slate-800">Documento: {doc.id}</span>
                                                                         <span className="text-[10px] text-sky-700 font-medium">RIPS sin Factura Oficial (numFactura: null)</span>
                                                                     </div>
                                                                 ) : (
                                                                     <div className="flex flex-col">
                                                                         <span className="font-bold text-slate-800">FEV: {doc.id}</span>
                                                                         <span className="text-[10px] text-slate-500 font-medium">Factura Electrónica en Salud</span>
                                                                     </div>
                                                                 )}
                                                             </td>
                                                             <td className="py-2 px-3 text-slate-500 font-medium">{doc.tipoNota || "-"}</td>
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
                                                             <td className="py-2 px-3 text-center">
                                                                 {doc.sourceMode === RIPS_MODES.LOCAL_PREVIEW ? (
                                                                     <span 
                                                                         className="inline-block px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50 rounded border border-amber-200 uppercase tracking-tight"
                                                                         title="Previsualización local — No apto para MUV (OFFICIAL_FEV_REQUIRED)"
                                                                     >
                                                                         PREVISUALIZACIÓN LOCAL — NO APTO PARA MUV
                                                                     </span>
                                                                 ) : doc.sourceMode === RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV ? (
                                                                     muvInfo?.cuv ? (
                                                                         <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold">
                                                                             <FiCheckCircle size={13} />
                                                                             <span>Validado Sin FEV</span>
                                                                         </div>
                                                                     ) : (
                                                                         <button
                                                                             type="button"
                                                                             onClick={() => handleSendRipsWithoutFevToMuv(doc.id)}
                                                                             disabled={transmittingMuv}
                                                                             className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                                                                             title="Enviar RIPS sin Factura al MUV"
                                                                        >
                                                                            <FiSend size={11} />
                                                                            <span>Enviar RIPS Sin Factura</span>
                                                                        </button>
                                                                     )
                                                                 ) : muvInfo?.cuv ? (
                                                                     <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold">
                                                                         <FiCheckCircle size={13} />
                                                                         <span>Validado</span>
                                                                     </div>
                                                                 ) : (
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => handleSendSingleToMuv(invoiceId)}
                                                                         disabled={transmittingMuv || doc.errors.length > 0}
                                                                         className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                                                                         title="Validar y enviar esta factura al MUV"
                                                                     >
                                                                         <FiSend size={11} />
                                                                         <span>Enviar RIPS</span>
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
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>Validado correctamente: <strong className="text-emerald-700 font-bold">{dianDocs.filter(d => d.errors.length === 0).length}</strong></span>
                                        <span>Validado con errores: <strong className="text-rose-700 font-bold">{dianDocs.filter(d => d.errors.length > 0).length}</strong></span>
                                        <span>Sin validar: <strong className="text-slate-700 font-bold">{preflightStatus === null ? dianDocs.length : 0}</strong></span>
                                    </div>
                                    {filteredDian.length > PAGE_SIZE && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Pág {pageDian} de {Math.max(1, Math.ceil(filteredDian.length / PAGE_SIZE))}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPageDian(p => Math.max(1, p - 1))}
                                                disabled={pageDian === 1}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPageDian(p => Math.min(Math.ceil(filteredDian.length / PAGE_SIZE), p + 1))}
                                                disabled={pageDian >= Math.ceil(filteredDian.length / PAGE_SIZE)}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
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
                                        onChange={e => {
                                            setFilterTextUsuarios(e.target.value);
                                            setPageUsuarios(1);
                                        }}
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
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></th>
                                                <th className="py-2 px-3">Tipo de documento Identificación</th>
                                                <th className="py-2 px-3">Nro. documento de Identificación</th>
                                                <th className="py-2 px-3">Tipo de Usuario</th>
                                                <th className="py-2 px-3">Fecha de nacimiento</th>
                                                <th className="py-2 px-3">cod. Sexo</th>
                                                <th className="py-2 px-3">Cód. pais de residencia</th>
                                                <th className="py-2 px-3">Cód. Municipo residencia</th>
                                                <th className="py-2 px-3">Cód Zona de Residencia</th>
                                                <th className="py-2 px-3">Incapacidad</th>
                                                <th className="py-2 px-3">Cod. pais de origen</th>
                                                <th className="py-2 px-3">Registro SIRAS</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {paginatedUsuarios.length === 0 ? (
                                                <tr>
                                                    <td colSpan="13" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                paginatedUsuarios.map((u, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></td>
                                                        <td className="py-2 px-3">{u.tipoDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 font-bold">{u.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3">{u.tipoUsuario}</td>
                                                        <td className="py-2 px-3 font-mono">{u.fechaNacimiento}</td>
                                                        <td className="py-2 px-3 text-center font-bold">{u.codSexo}</td>
                                                        <td className="py-2 px-3 font-mono">{u.codPaisResidencia || "170"}</td>
                                                        <td className="py-2 px-3 font-mono">{u.codMunicipioResidencia}</td>
                                                        <td className="py-2 px-3 font-mono">{u.codZonaTerritorialResidencia || "02"}</td>
                                                        <td className="py-2 px-3">{u.incapacidad || "No"}</td>
                                                        <td className="py-2 px-3 font-mono">{u.codPaisOrigen || "170"}</td>
                                                        <td className="py-2 px-3 text-slate-400 font-mono">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-400">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>Validado correctamente: <strong className="text-emerald-700 font-bold">{usuarios.filter(u => u.errors.length === 0).length}</strong></span>
                                        <span>Validado con errores: <strong className="text-rose-700 font-bold">{usuarios.filter(u => u.errors.length > 0).length}</strong></span>
                                        <span>Sin validar: <strong className="text-slate-700 font-bold">{preflightStatus === null ? usuarios.length : 0}</strong></span>
                                    </div>
                                    {filteredUsuarios.length > PAGE_SIZE && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Pág {pageUsuarios} de {Math.max(1, Math.ceil(filteredUsuarios.length / PAGE_SIZE))}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPageUsuarios(p => Math.max(1, p - 1))}
                                                disabled={pageUsuarios === 1}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPageUsuarios(p => Math.min(Math.ceil(filteredUsuarios.length / PAGE_SIZE), p + 1))}
                                                disabled={pageUsuarios >= Math.ceil(filteredUsuarios.length / PAGE_SIZE)}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
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
                                        onChange={e => {
                                            setFilterTextConsultas(e.target.value);
                                            setPageConsultas(1);
                                        }}
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
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Consulta</th>
                                                <th className="py-2 px-3">Nro de Autorización</th>
                                                <th className="py-2 px-3">Código de la consulta</th>
                                                <th className="py-2 px-3">Modalidad</th>
                                                <th className="py-2 px-3">Grupo servicio</th>
                                                <th className="py-2 px-3">Cod. servicio</th>
                                                <th className="py-2 px-3">Finalidad de la consulta</th>
                                                <th className="py-2 px-3">Causa/motivo atención</th>
                                                <th className="py-2 px-3">Cód dx Principal</th>
                                                <th className="py-2 px-3">Cód dx Rel 1</th>
                                                <th className="py-2 px-3">Cód dx Rel 2</th>
                                                <th className="py-2 px-3">Cód dx Rel 3</th>
                                                <th className="py-2 px-3">Tipo de Diagnóstico</th>
                                                <th className="py-2 px-3">Tipo de Identificación del Profesional</th>
                                                <th className="py-2 px-3">Identificación del Profesional</th>
                                                <th className="py-2 px-3 text-right">Valor de la consulta</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {paginatedConsultas.length === 0 ? (
                                                <tr>
                                                    <td colSpan="26" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                paginatedConsultas.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                c.errors.length === 0 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            }`}>
                                                                {c.errors.length === 0 ? 'VALIDADO' : 'CON ERRORES'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{c.docPaciente}</td>
                                                        <td className="py-2 px-3">{c.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{c.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{c.fechaInicio}</td>
                                                        <td className="py-2 px-3 text-slate-400">{c.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{c.codConsulta}</td>
                                                        <td className="py-2 px-3 font-mono">{c.modalidadGrupoServicioTecSal || '01'}</td>
                                                        <td className="py-2 px-3 font-mono">{c.grupoServicios || '01'}</td>
                                                        <td className="py-2 px-3 font-mono">{c.codServicio || 334}</td>
                                                        <td className="py-2 px-3 font-mono">{c.finalidadTecnologiaSalud || '10'}</td>
                                                        <td className="py-2 px-3 font-mono">{c.causaMotivoAtencion || '38'}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-emerald-600">{c.dxPrincipal}</td>
                                                        <td className="py-2 px-3 font-mono">{c.codDiagnosticoRelacionado1 || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 font-mono">{c.tipoDiagnosticoPrincipal || "01"}</td>
                                                        <td className="py-2 px-3 font-mono">{c.tipoDocumentoIdentificacion || "CC"}</td>
                                                        <td className="py-2 px-3 font-mono">{c.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(c.valorServicio)}</td>
                                                        <td className="py-2 px-3 font-mono">{c.conceptoRecaudo || "05"}</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(c.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3 font-mono">{c.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-400">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>Validado correctamente: <strong className="text-emerald-700 font-bold">{consultas.filter(c => c.errors.length === 0).length}</strong></span>
                                        <span>Validado con errores: <strong className="text-rose-700 font-bold">{consultas.filter(c => c.errors.length > 0).length}</strong></span>
                                        <span>Sin validar: <strong className="text-slate-700 font-bold">{preflightStatus === null ? consultas.length : 0}</strong></span>
                                    </div>
                                    {filteredConsultas.length > PAGE_SIZE && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Pág {pageConsultas} de {Math.max(1, Math.ceil(filteredConsultas.length / PAGE_SIZE))}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPageConsultas(p => Math.max(1, p - 1))}
                                                disabled={pageConsultas === 1}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPageConsultas(p => Math.min(Math.ceil(filteredConsultas.length / PAGE_SIZE), p + 1))}
                                                disabled={pageConsultas >= Math.ceil(filteredConsultas.length / PAGE_SIZE)}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
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
                                        onChange={e => {
                                            setFilterTextProcedimientos(e.target.value);
                                            setPageProcedimientos(1);
                                        }}
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
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Nro. Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Procedimiento</th>
                                                <th className="py-2 px-3">Nro. de Autorización</th>
                                                <th className="py-2 px-3">Código del Procedimiento</th>
                                                <th className="py-2 px-3">Modalidad</th>
                                                <th className="py-2 px-3">Grupo de servicios</th>
                                                <th className="py-2 px-3">Cod. servicio</th>
                                                <th className="py-2 px-3">Tipo Identificación del Profesional</th>
                                                <th className="py-2 px-3">Nro.Identificación del Profesional</th>
                                                <th className="py-2 px-3">Cód dx Principal</th>
                                                <th className="py-2 px-3">Cód dx Relacionado</th>
                                                <th className="py-2 px-3">Finalidad del procedimiento</th>
                                                <th className="py-2 px-3">Complicación</th>
                                                <th className="py-2 px-3 text-right">Valor del servicio</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {paginatedProcedimientos.length === 0 ? (
                                                <tr>
                                                    <td colSpan="23" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                paginatedProcedimientos.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                p.errors.length === 0 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            }`}>
                                                                {p.errors.length === 0 ? 'VALIDADO' : 'CON ERRORES'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{p.docPaciente}</td>
                                                        <td className="py-2 px-3">{p.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{p.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{p.fechaProcedimiento}</td>
                                                        <td className="py-2 px-3 text-slate-400">{p.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{p.codProcedimiento}</td>
                                                        <td className="py-2 px-3 font-mono">{p.modalidadGrupoServicioTecSal || '01'}</td>
                                                        <td className="py-2 px-3 font-mono">{p.grupoServicios || '02'}</td>
                                                        <td className="py-2 px-3 font-mono">{p.codServicio || 334}</td>
                                                        <td className="py-2 px-3 font-mono">{p.tipoDocumentoIdentificacion || "CC"}</td>
                                                        <td className="py-2 px-3 font-mono">{p.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-emerald-600">{p.dxPrincipal}</td>
                                                        <td className="py-2 px-3 font-mono">{p.codDiagnosticoRelacionado || '-'}</td>
                                                        <td className="py-2 px-3 font-mono">{p.finalidadTecnologiaSalud || '02'}</td>
                                                        <td className="py-2 px-3 font-mono">{p.codComplicacion || '-'}</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(p.valorServicio)}</td>
                                                        <td className="py-2 px-3 font-mono">{p.conceptoRecaudo || '05'}</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(p.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3 font-mono">{p.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-400">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>Validado correctamente: <strong className="text-emerald-700 font-bold">{procedimientos.filter(p => p.errors.length === 0).length}</strong></span>
                                        <span>Validado con errores: <strong className="text-rose-700 font-bold">{procedimientos.filter(p => p.errors.length > 0).length}</strong></span>
                                        <span>Sin validar: <strong className="text-slate-700 font-bold">{preflightStatus === null ? procedimientos.length : 0}</strong></span>
                                    </div>
                                    {filteredProcedimientos.length > PAGE_SIZE && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Pág {pageProcedimientos} de {Math.max(1, Math.ceil(filteredProcedimientos.length / PAGE_SIZE))}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPageProcedimientos(p => Math.max(1, p - 1))}
                                                disabled={pageProcedimientos === 1}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPageProcedimientos(p => Math.min(Math.ceil(filteredProcedimientos.length / PAGE_SIZE), p + 1))}
                                                disabled={pageProcedimientos >= Math.ceil(filteredProcedimientos.length / PAGE_SIZE)}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
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
                                        onChange={e => {
                                            setFilterTextOtros(e.target.value);
                                            setPageOtros(1);
                                        }}
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
                                                <th className="py-2 px-3 text-center w-12"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></th>
                                                <th className="py-2 px-3">Estado</th>
                                                <th className="py-2 px-3">Nro. Identificación del paciente</th>
                                                <th className="py-2 px-3">Número de la factura</th>
                                                <th className="py-2 px-3">Código del Prestador</th>
                                                <th className="py-2 px-3">Fecha de Otro Servicio</th>
                                                <th className="py-2 px-3">Nro. de Autorización</th>
                                                <th className="py-2 px-3">Código del Otro Servicio</th>
                                                <th className="py-2 px-3">Tipo de Otro Servicio</th>
                                                <th className="py-2 px-3">Tipo Identificación del Profesional</th>
                                                <th className="py-2 px-3">Nro.Identificación del Profesional</th>
                                                <th className="py-2 px-3 text-right">Valor unitario del servicio</th>
                                                <th className="py-2 px-3 text-center">Cantidad del servicio</th>
                                                <th className="py-2 px-3 text-right">Valor del servicio</th>
                                                <th className="py-2 px-3">Concepto recaudo</th>
                                                <th className="py-2 px-3 text-right">Valor pago moderador</th>
                                                <th className="py-2 px-3">Número de factura pago moderador</th>
                                                <th className="py-2 px-3">CUV</th>
                                                <th className="py-2 px-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap text-xs">
                                            {paginatedOtrosServicios.length === 0 ? (
                                                <tr>
                                                    <td colSpan="19" className="py-8 text-center text-slate-400 italic">Sin datos</td>
                                                </tr>
                                            ) : (
                                                paginatedOtrosServicios.map((o, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded text-sky-600 border-slate-300" /></td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                (!o.errors || o.errors.length === 0) 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            }`}>
                                                                {(!o.errors || o.errors.length === 0) ? 'VALIDADO' : 'CON ERRORES'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-bold">{o.docPaciente}</td>
                                                        <td className="py-2 px-3">{o.invoiceId}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-500">{o.codPrestador}</td>
                                                        <td className="py-2 px-3 font-mono">{o.fechaSuministroTecnologia}</td>
                                                        <td className="py-2 px-3 text-slate-400">{o.numAutorizacion || '-'}</td>
                                                        <td className="py-2 px-3 font-bold text-sky-600 font-mono">{o.codTecnologiaSalud}</td>
                                                        <td className="py-2 px-3 font-mono">{o.tipoOS || "01"}</td>
                                                        <td className="py-2 px-3 font-mono">{o.tipoDocumentoIdentificacion || 'CC'}</td>
                                                        <td className="py-2 px-3 font-mono">{o.numDocumentoIdentificacion}</td>
                                                        <td className="py-2 px-3 text-right">{fmt(o.vrUnitOS)}</td>
                                                        <td className="py-2 px-3 text-center">{o.cantidadOS}</td>
                                                        <td className="py-2 px-3 text-right font-bold">{fmt(o.vrServicio)}</td>
                                                        <td className="py-2 px-3 font-mono">{o.conceptoRecaudo || '05'}</td>
                                                        <td className="py-2 px-3 text-right font-mono">{fmt(o.valorPagoModerador || 0)}</td>
                                                        <td className="py-2 px-3 font-mono">{o.numFEVPagoModerador || '-'}</td>
                                                        <td className="py-2 px-3 font-mono text-slate-400">-</td>
                                                        <td className="py-2 px-3 text-center text-slate-400">-</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>Validado correctamente: <strong className="text-emerald-700 font-bold">{otrosServicios.filter(o => !o.errors || o.errors.length === 0).length}</strong></span>
                                        <span>Validado con errores: <strong className="text-rose-700 font-bold">{otrosServicios.filter(o => o.errors && o.errors.length > 0).length}</strong></span>
                                        <span>Sin validar: <strong className="text-slate-700 font-bold">{preflightStatus === null ? otrosServicios.length : 0}</strong></span>
                                    </div>
                                    {filteredOtrosServicios.length > PAGE_SIZE && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Pág {pageOtros} de {Math.max(1, Math.ceil(filteredOtrosServicios.length / PAGE_SIZE))}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPageOtros(p => Math.max(1, p - 1))}
                                                disabled={pageOtros === 1}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPageOtros(p => Math.min(Math.ceil(filteredOtrosServicios.length / PAGE_SIZE), p + 1))}
                                                disabled={pageOtros >= Math.ceil(filteredOtrosServicios.length / PAGE_SIZE)}
                                                className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
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
