import { createSupplierExpense } from '../../../services/supplierExpenseService';
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
    FiCalendar, FiPlus, FiTrash2, FiSave, FiAlertCircle, 
    FiCheckCircle, FiX, FiInfo, FiHome, FiArrowLeft, FiUserPlus, FiSearch, FiUser
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { getActiveCaja, getDoctorsList } from "../../../services/supabaseServices";
import { getConfigItems, getConfigSection, saveConfigSection } from "../../../services/configPersistenceService";
import { getConfigSectionsCached } from "../../../services/configCacheService";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { toast } from "sonner";
import { formatNumberWithDots, parseRawNumber } from "../../../utils/formatters";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: Number(n || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

export default function PagosForm({ onCancel, onSuccess }) {
    const { user, userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant_id || "";

    const [saving, setSaving] = useState(false);
    const [showInsuficienteModal, setShowInsuficienteModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form fields - Card 1: Información empresa
    const pagadorEmail = userProfile?.email || user?.email || userProfile?.tenant?.email || "atmcentrodeldolor@gmail.com";
    const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
    const [profesionalId, setProfesionalId] = useState("");
    const [bancoCaja, setBancoCaja] = useState("");

    // Form fields - Card 2: Datos tercero
    const [terceroId, setTerceroId] = useState("");
    const [medioPago, setMedioPago] = useState("Efectivo");
    const [condicionPago, setCondicionPago] = useState("Contado");
    const [pagoFacturasCompra, setPagoFacturasCompra] = useState(false);

    // Form fields - Card 3: Items / Conceptos
    const [items, setItems] = useState([]);

    // Form fields - Card 4: Observaciones
    const [observaciones, setObservaciones] = useState("");

    // Lookups & Buscador
    const [profesionales, setProfesionales] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [terceroSearchQuery, setTerceroSearchQuery] = useState("");
    const [isSearchingTercero, setIsSearchingTercero] = useState(false);
    const [selectedTerceroObj, setSelectedTerceroObj] = useState(null);
    const searchContainerRef = useRef(null);

    const [miCajaAbierta, setMiCajaAbierta] = useState(null);
    const [bancosDisponibles, setBancosDisponibles] = useState([]);
    const [mediosPagoList, setMediosPagoList] = useState([]);
    const [condicionesPagoList, setCondicionesPagoList] = useState([]);
    const [facturasCompraPendientes, setFacturasCompraPendientes] = useState([]);
    const [facturasSeleccionadas, setFacturasSeleccionadas] = useState([]);

    // Nombre de la caja o del usuario/responsable que atiende la caja
    const userCajaLabel = useMemo(() => {
        if (miCajaAbierta) {
            return (
                miCajaAbierta.usuario_nombre ||
                miCajaAbierta.responsable ||
                userProfile?.full_name ||
                userProfile?.nombre_completo ||
                [userProfile?.nombre, userProfile?.apellido].filter(Boolean).join(" ") ||
                miCajaAbierta.nombre ||
                "CAJA PRINCIPAL"
            ).toUpperCase();
        }
        const name =
            userProfile?.full_name ||
            userProfile?.nombre_completo ||
            [userProfile?.nombre, userProfile?.apellido].filter(Boolean).join(" ") ||
            user?.email?.split("@")[0] ||
            "";
        return name ? name.toUpperCase() : "CAJA PRINCIPAL";
    }, [miCajaAbierta, userProfile, user]);

    // Modal Crear Tercero
    const [showNewTerceroModal, setShowNewTerceroModal] = useState(false);
    const [savingTercero, setSavingTercero] = useState(false);
    const [newTerceroData, setNewTerceroData] = useState({
        nombre: "",
        apellidos: "",
        tipoDocumento: "CC",
        nroDocumento: "",
        razonSocial: "",
        telefono: "",
        direccion: "",
        pais: "Colombia",
        ciudad: "",
        email: ""
    });

    // Modal Nuevo Concepto
    const [showNewConceptoModal, setShowNewConceptoModal] = useState(false);
    const [newConceptoData, setNewConceptoData] = useState({
        concepto: "",
        descripcion: "",
        cantidad: 1,
        precioUnitario: "",
        impuesto: ""
    });

    // Modal Asociar Factura
    const [showAsociarFacturaModal, setShowAsociarFacturaModal] = useState(false);
    const [asociarFacturaData, setAsociarFacturaData] = useState({
        facturaId: "",
        facturaObj: null,
        cantidad: 1,
        pendientePorPagar: 0,
        valorAPagar: 0,
        impuesto: ""
    });

    // Cerrar menú de búsqueda al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setIsSearchingTercero(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Cargar datos iniciales
    useEffect(() => {
        if (!inquilino) return;
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const currentUserId = user?.id || userProfile?.uid || userProfile?.id;

                // 1. Cargar configuración de la clínica
                const cfg = await getConfigSectionsCached(inquilino, [
                    "terceros", "proveedores", "bancos", "cuentas_bancarias",
                    "condiciones_pago", "metodos_pago", "facturas_compra"
                ]);

                // 2. Cargar Terceros y Pacientes unificados
                let tercerosList = [];
                try {
                    const { data: tDb, error: tErr } = await supabase
                        .from("terceros")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    
                    let rawTerceros = (tDb && tDb.length > 0) ? tDb : [];

                    // Fallback a website_config si la tabla está vacía
                    if (rawTerceros.length === 0) {
                        try {
                            const { data: cfgRow } = await supabase
                                .from("website_config")
                                .select("config")
                                .eq("tenant_id", inquilino)
                                .maybeSingle();
                            rawTerceros = cfgRow?.config?.terceros || cfg.terceros || cfg.proveedores || [];
                        } catch (cfgErr) {}
                    }

                    if (rawTerceros.length > 0) {
                        tercerosList = rawTerceros.map(t => {
                            const fullName = [t.nombre, t.apellidos].filter(Boolean).join(" ").trim();
                            const displayName = t.razonSocial || t.razon_social || fullName || t.nombreCompleto || t.nombre_completo || t.nombre || "Tercero";
                            const doc = t.nroDocumento || t.documento || t.numero_documento || t.nit || t.identificacion || "";
                            return {
                                ...t,
                                id: t.id || doc || displayName,
                                nombre: displayName,
                                razonSocial: t.razonSocial || t.razon_social || "",
                                documento: doc,
                                nroDocumento: doc,
                                tipoDocumento: t.tipoDocumento || t.tipo_documento || "NIT",
                                telefono: t.telefono || t.celular || "",
                                tipo: "tercero"
                            };
                        });
                    }
                } catch (e) {
                    console.warn("Error cargando terceros en PagosForm:", e);
                }

                // Cargar Pacientes de la clínica (usando select("*") para compatibilidad total con cualquier esquema)
                let pacientesList = [];
                try {
                    const { data: pDb, error: pErr } = await supabase
                        .from("pacientes")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    
                    let rawPacientes = (pDb && pDb.length > 0) ? pDb : [];

                    if (rawPacientes.length === 0) {
                        try {
                            const { data: cfgRow } = await supabase
                                .from("website_config")
                                .select("config")
                                .eq("tenant_id", inquilino)
                                .maybeSingle();
                            rawPacientes = cfgRow?.config?.pacientes || [];
                        } catch (cfgErr) {}
                    }

                    if (rawPacientes.length > 0) {
                        pacientesList = rawPacientes.map(p => {
                            const full = `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.nombreCompleto || p.displayName || p.documento || "Paciente";
                            const doc = p.documento || p.nroDocumento || p.identificacion || p.numero_documento || "";
                            return {
                                ...p,
                                id: p.id,
                                nombre: full,
                                documento: doc,
                                nroDocumento: doc,
                                tipoDocumento: p.tipoDocumento || p.tipo_documento || "CC",
                                telefono: p.telefono || p.celular || p.movil || "",
                                tipo: "paciente"
                            };
                        });
                    }
                } catch (e) {
                    console.warn("Error cargando pacientes en PagosForm:", e);
                }

                // Unificar terceros y pacientes evitando duplicados
                const seenTerceros = new Set();
                const unifiedTerceros = [];
                [...tercerosList, ...pacientesList].forEach(item => {
                    const key = item.id || `${item.documento}_${item.nombre}`;
                    if (!seenTerceros.has(key)) {
                        seenTerceros.add(key);
                        unifiedTerceros.push(item);
                    }
                });
                setTerceros(unifiedTerceros);

                // 3. Cargar Profesionales / Doctores exclusivamente
                try {
                    const dList = await getDoctorsList(userProfile || { inquilino });
                    if (dList && dList.length > 0) {
                        setProfesionales(dList.map(d => ({
                            id: d.id,
                            nombre: d.nombreCompleto || d.nombre,
                            role: d.role
                        })));
                    }
                } catch (e) {
                    console.warn("getDoctorsList notice in PagosForm:", e);
                }

                // 4. Cargar la caja abierta exclusiva del usuario actual
                let userCaja = null;
                try {
                    const activeCaja = await getActiveCaja(inquilino, currentUserId);
                    if (
                        activeCaja &&
                        (activeCaja.estado || "").toLowerCase() === "abierta" &&
                        (!activeCaja.usuario_id || String(activeCaja.usuario_id || activeCaja.usuarioId) === String(currentUserId))
                    ) {
                        userCaja = activeCaja;
                    }
                } catch (e) {}
                setMiCajaAbierta(userCaja);

                // 5. Cargar Bancos creados en el sistema
                let bancosList = [];
                try {
                    const list = await getConfigItems(inquilino, "bancos", "bancos");
                    if (list && list.length > 0) bancosList = list;
                } catch (e) {}

                if (bancosList.length === 0) {
                    try {
                        const { data: bDb } = await supabase.from("bancos").select("*").eq("tenant_id", inquilino);
                        if (bDb && bDb.length > 0) bancosList = bDb;
                    } catch (e) {}
                }

                if (bancosList.length === 0) {
                    bancosList = cfg.bancos || cfg.cuentas_bancarias || [];
                }

                if (bancosList.length === 0) {
                    bancosList = [
                        { id: "bancolombia_ahorros", nombre: "Bancolombia - Cuenta de Ahorros" },
                        { id: "bancolombia_corriente", nombre: "Bancolombia - Cuenta Corriente" },
                        { id: "davivienda", nombre: "Davivienda" },
                        { id: "banco_bogota", nombre: "Banco de Bogotá" },
                        { id: "bbva", nombre: "BBVA" },
                        { id: "nequi", nombre: "Nequi" },
                        { id: "daviplata", nombre: "Daviplata" },
                        { id: "datafono", nombre: "Datáfono / Redeban" }
                    ];
                }
                setBancosDisponibles(bancosList);

                // 6. Cargar Condiciones de Pago creadas en el módulo
                let condList = [];
                try {
                    const cpData = await getConfigItems(inquilino, "condiciones_pago", "condiciones_pago");
                    if (cpData && cpData.length > 0) condList = cpData;
                } catch (e) {}

                if (condList.length === 0) {
                    condList = cfg.condiciones_pago || [];
                }

                if (condList.length === 0) {
                    condList = [
                        { id: "contado", nombre: "Contado" },
                        { id: "15_dias", nombre: "15 días" },
                        { id: "30_dias", nombre: "30 días" }
                    ];
                }
                setCondicionesPagoList(condList);

                // 7. Cargar Medios de Pago creados en el sistema
                let mpList = [];
                try {
                    const mpData = await getConfigItems(inquilino, "metodos_pago", null);
                    if (mpData && mpData.length > 0) mpList = mpData;
                } catch (e) {}

                if (mpList.length === 0) {
                    try {
                        const { data: mpDb } = await supabase.from("metodos_pago").select("*").eq("tenant_id", inquilino);
                        if (mpDb && mpDb.length > 0) mpList = mpDb;
                    } catch (e) {}
                }

                if (mpList.length === 0) {
                    mpList = cfg.metodos_pago || [];
                }

                if (mpList.length === 0) {
                    mpList = [
                        { id: "efectivo", nombre: "Efectivo" },
                        { id: "transferencia", nombre: "Transferencia Bancaria" },
                        { id: "tarjeta_debito", nombre: "Tarjeta Débito" },
                        { id: "tarjeta_credito", nombre: "Tarjeta Crédito" },
                        { id: "nequi", nombre: "Nequi" },
                        { id: "daviplata", nombre: "Daviplata" }
                    ];
                }
                setMediosPagoList(mpList);

                // 8. Cargar Facturas de Compra pendientes y pagos previos para asegurar saldo real
                try {
                    let allFc = [];

                    // Capa A: getConfigSection oficial de facturas_compra
                    try {
                        const cfgList = await getConfigSection(inquilino, "facturas_compra", []);
                        if (Array.isArray(cfgList) && cfgList.length > 0) {
                            allFc = [...cfgList];
                        }
                    } catch (e) {}

                    // Capa B: website_config directo
                    if (allFc.length === 0) {
                        try {
                            const { data: cfgRow } = await supabase
                                .from("website_config")
                                .select("config")
                                .eq("tenant_id", inquilino)
                                .maybeSingle();
                            const fromWc = cfgRow?.config?.facturas_compra || cfgRow?.config?.facturasCompra || [];
                            if (Array.isArray(fromWc) && fromWc.length > 0) {
                                allFc = [...fromWc];
                            }
                        } catch (e) {}
                    }

                    // Capa C: Fallback a cfg cargado previamente
                    if (allFc.length === 0) {
                        const fromCfg = cfg.facturas_compra || cfg.facturasCompra || [];
                        if (Array.isArray(fromCfg) && fromCfg.length > 0) {
                            allFc = [...fromCfg];
                        }
                    }

                    // Capa D: tabla facturas_compra en Supabase (si existe)
                    try {
                        const { data: fcDb, error: fcDbErr } = await supabase
                            .from("facturas_compra")
                            .select("*")
                            .eq("tenant_id", inquilino);
                        if (!fcDbErr && Array.isArray(fcDb) && fcDb.length > 0) {
                            const existingIds = new Set(allFc.map(f => String(f.id)));
                            const existingNums = new Set(allFc.map(f => String(f.factus_number || f.nroFactura || f.documentoNumero || f.numero || "")));
                            fcDb.forEach(fc => {
                                const fId = String(fc.id);
                                const fNum = String(fc.factus_number || fc.nroFactura || fc.documentoNumero || fc.numero || "");
                                if (!existingIds.has(fId) && (!fNum || !existingNums.has(fNum))) {
                                    allFc.push(fc);
                                }
                            });
                        }
                    } catch (e) {}

                    // Cargar pagos previos para calcular saldo real
                    let allPp = [];
                    try {
                        const { data: ppDb } = await supabase
                            .from("pagos_proveedor")
                            .select("items, total")
                            .eq("tenant_id", inquilino);
                        if (Array.isArray(ppDb)) allPp = ppDb;
                    } catch (e) {}
                    if (allPp.length === 0 && Array.isArray(cfg.pagos_proveedor)) {
                        allPp = cfg.pagos_proveedor;
                    }

                    // Mapear abonos previos por factura
                    const abonosPorFactura = {};
                    (allPp || []).forEach(pago => {
                        (pago.items || []).forEach(it => {
                            const fId = String(it.facturaId || "");
                            const fNum = String(it.numeroFactura || it.concepto || "");
                            const monto = Number(it.total || it.precioUnitario || 0);
                            if (fId) abonosPorFactura[fId] = (abonosPorFactura[fId] || 0) + monto;
                            if (fNum) abonosPorFactura[fNum] = (abonosPorFactura[fNum] || 0) + monto;
                        });
                    });

                    const facturasCalculadas = allFc.map(fc => {
                        const totalDoc = Number(fc.totalNeto ?? fc.total ?? fc.monto ?? 0);
                        const fcCode = fc.factus_number || fc.nroFactura || fc.documentoNumero || fc.numero || (String(fc.id).startsWith("fc_") ? `FC-${String(fc.id).slice(3, 8)}` : `FC-${fc.id}`);
                        const abonado = Math.max(
                            abonosPorFactura[String(fc.id)] || 0,
                            abonosPorFactura[String(fcCode)] || 0
                        );

                        // Cálculo preciso del saldo pendiente
                        let saldo = 0;
                        if (fc.saldo_pendiente !== undefined && fc.saldo_pendiente !== null && Number(fc.saldo_pendiente) > 0) {
                            saldo = Number(fc.saldo_pendiente);
                        } else if (fc.saldoPendiente !== undefined && fc.saldoPendiente !== null && Number(fc.saldoPendiente) > 0) {
                            saldo = Number(fc.saldoPendiente);
                        } else if (totalDoc > 0) {
                            saldo = Math.max(0, totalDoc - abonado);
                        }

                        // Si hay abonos y el total es mayor a cero, asegurar coherencia
                        if (abonado > 0 && totalDoc > 0) {
                            saldo = Math.max(0, totalDoc - abonado);
                        } else if (saldo === 0 && totalDoc > 0 && (fc.estado || "").toLowerCase() !== "pagada") {
                            // Si no hay abonos registrados y la factura no está pagada, el saldo es el total
                            saldo = totalDoc;
                        }

                        return {
                            ...fc,
                            saldo_pendiente: saldo,
                            saldoPendiente: saldo,
                            totalCalculado: totalDoc
                        };
                    });

                    setFacturasCompraPendientes(facturasCalculadas);
                } catch (e) {
                    console.warn("Aviso cargando facturas de compra:", e);
                }

                // Auto-seleccionar Banco o Caja según sesión activa
                if (userCaja) {
                    const activeName = (
                        userCaja.usuario_nombre ||
                        userCaja.responsable ||
                        userProfile?.full_name ||
                        userProfile?.nombre_completo ||
                        [userProfile?.nombre, userProfile?.apellido].filter(Boolean).join(" ") ||
                        userCaja.nombre ||
                        "CAJA PRINCIPAL"
                    ).toUpperCase();
                    setBancoCaja(activeName);
                } else if (bancosList.length > 0) {
                    const firstBank = typeof bancosList[0] === 'string' ? bancosList[0] : (bancosList[0].nombre || bancosList[0].nombreBanco || "Bancolombia");
                    setBancoCaja(firstBank);
                }

            } catch (err) {
                console.error("Error loading PagosForm data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [inquilino, user, userProfile]);

    // Manejadores de Conceptos
    const handleAddConcepto = () => {
        setNewConceptoData({
            concepto: "",
            descripcion: "",
            cantidad: 1,
            precioUnitario: "",
            impuesto: ""
        });
        setShowNewConceptoModal(true);
    };

    const handleSaveConceptoModal = (e) => {
        e.preventDefault();
        if (!newConceptoData.concepto.trim()) {
            toast.error("El nombre del concepto es obligatorio");
            return;
        }
        const pu = parseRawNumber(newConceptoData.precioUnitario);
        const cant = parseFloat(newConceptoData.cantidad) || 1;
        const total = pu * cant;

        setItems(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                concepto: newConceptoData.concepto.trim(),
                descripcion: newConceptoData.descripcion.trim(),
                precioUnitario: pu,
                cantidad: cant,
                impuesto: newConceptoData.impuesto,
                total: total
            }
        ]);

        setShowNewConceptoModal(false);
        setNewConceptoData({
            concepto: "",
            descripcion: "",
            cantidad: 1,
            precioUnitario: "",
            impuesto: ""
        });
        toast.success("Concepto agregado");
    };

    const handleRemoveConcepto = (id) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleItemChange = (id, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;

            const updated = { ...item, [field]: value };
            const pu = field === "precioUnitario" ? parseRawNumber(value) : (parseRawNumber(item.precioUnitario) || 0);
            const cant = field === "cantidad" ? parseFloat(value) || 0 : (parseFloat(item.cantidad) || 0);
            updated.total = pu * cant;
            return updated;
        }));
    };

    // Calcular Total
    const totalGeneral = useMemo(() => {
        return items.reduce((acc, item) => acc + (parseRawNumber(item.total) || 0), 0);
    }, [items]);

    // Filtrar Terceros y Pacientes en tiempo real por el buscador (solo cuando el usuario escribe)
    const filteredTerceros = useMemo(() => {
        const q = (terceroSearchQuery || "").toLowerCase().trim();
        if (!q) return [];
        return terceros.filter(t => {
            const name = String(t.nombre || "").toLowerCase();
            const doc = String(t.documento || t.nroDocumento || "").toLowerCase();
            const tel = String(t.telefono || "").toLowerCase();
            const rs = String(t.razonSocial || t.razon_social || "").toLowerCase();
            return name.includes(q) || doc.includes(q) || tel.includes(q) || rs.includes(q);
        }).slice(0, 30);
    }, [terceros, terceroSearchQuery]);

    // Guardar nuevo Tercero desde Modal
    const handleSaveNewTercero = async (e) => {
        e.preventDefault();
        const displayName = [newTerceroData.nombre, newTerceroData.apellidos].filter(Boolean).join(" ").trim() || newTerceroData.razonSocial || "Tercero";
        if (!displayName.trim()) {
            toast.error("El nombre del tercero es obligatorio");
            return;
        }

        setSavingTercero(true);
        try {
            const nuevoTerceroObj = {
                id: `tercero_${Date.now()}`,
                tenant_id: inquilino,
                nombre: displayName,
                nombreSolo: newTerceroData.nombre.trim(),
                apellidos: newTerceroData.apellidos.trim(),
                razonSocial: newTerceroData.razonSocial.trim(),
                tipoDocumento: newTerceroData.tipoDocumento || "CC",
                nroDocumento: newTerceroData.nroDocumento.trim(),
                telefono: newTerceroData.telefono.trim(),
                email: newTerceroData.email.trim(),
                direccion: newTerceroData.direccion.trim(),
                pais: newTerceroData.pais || "Colombia",
                ciudad: newTerceroData.ciudad.trim() || "Sincelejo",
                created_at: new Date().toISOString()
            };

            // Guardar en tabla terceros si existe
            try {
                await supabase.from("terceros").insert([nuevoTerceroObj]);
            } catch (e) {}

            // Sincronizar en website_config
            try {
                const currTerceros = await getConfigSection(inquilino, "terceros", []);
                await saveConfigSection(inquilino, "terceros", [
                    ...(Array.isArray(currTerceros) ? currTerceros : []),
                    nuevoTerceroObj
                ]);
            } catch (e) {}

            const formattedNew = {
                id: nuevoTerceroObj.id,
                nombre: nuevoTerceroObj.nombre,
                documento: nuevoTerceroObj.nroDocumento,
                tipoDocumento: nuevoTerceroObj.tipoDocumento,
                telefono: nuevoTerceroObj.telefono,
                tipo: "tercero"
            };

            setTerceros(prev => [formattedNew, ...prev]);
            setSelectedTerceroObj(formattedNew);
            setTerceroId(formattedNew.id);
            setTerceroSearchQuery(formattedNew.nombre);
            setIsSearchingTercero(false);
            setShowNewTerceroModal(false);
            setNewTerceroData({
                nombre: "",
                apellidos: "",
                tipoDocumento: "CC",
                nroDocumento: "",
                razonSocial: "",
                telefono: "",
                direccion: "",
                pais: "Colombia",
                ciudad: "",
                email: ""
            });
            toast.success("Tercero registrado correctamente ✅");
        } catch (err) {
            console.error("Error creating tercero:", err);
            toast.error("Error al registrar el tercero");
        } finally {
            setSavingTercero(false);
        }
    };

    // Funciones auxiliares para extracción segura de datos de terceros en facturas
    const extractProvName = (f) => {
        if (!f) return "";
        if (typeof f.proveedor === "string" && f.proveedor.trim()) return f.proveedor.trim();
        if (typeof f.tercero === "string" && f.tercero.trim()) return f.tercero.trim();
        if (typeof f.proveedorNombre === "string" && f.proveedorNombre.trim()) return f.proveedorNombre.trim();
        if (typeof f.terceroNombre === "string" && f.terceroNombre.trim()) return f.terceroNombre.trim();
        if (typeof f.nombre === "string" && f.nombre.trim()) return f.nombre.trim();
        if (typeof f.paciente === "string" && f.paciente.trim()) return f.paciente.trim();
        if (typeof f.pacienteNombre === "string" && f.pacienteNombre.trim()) return f.pacienteNombre.trim();
        if (f.tercero && typeof f.tercero === "object") {
            return f.tercero.nombre || f.tercero.razonSocial || f.tercero.razon_social || f.tercero.nombre_completo || f.tercero.nombreCompleto || "";
        }
        if (f.proveedor && typeof f.proveedor === "object") {
            return f.proveedor.nombre || f.proveedor.razonSocial || f.proveedor.razon_social || f.proveedor.nombre_completo || f.proveedor.nombreCompleto || "";
        }
        if (f.paciente && typeof f.paciente === "object") {
            return f.paciente.nombre || f.paciente.nombreCompleto || f.paciente.nombres || "";
        }
        return "";
    };

    const extractProvDoc = (f) => {
        if (!f) return "";
        if (typeof f.documentoTercero === "string" || typeof f.documentoTercero === "number") return String(f.documentoTercero);
        if (typeof f.documento === "string" || typeof f.documento === "number") return String(f.documento);
        if (typeof f.nit === "string" || typeof f.nit === "number") return String(f.nit);
        if (typeof f.nroDocumento === "string" || typeof f.nroDocumento === "number") return String(f.nroDocumento);
        if (typeof f.documentoPaciente === "string" || typeof f.documentoPaciente === "number") return String(f.documentoPaciente);
        if (f.tercero && typeof f.tercero === "object") {
            return String(f.tercero.documento || f.tercero.nroDocumento || f.tercero.nit || f.tercero.identificacion || "");
        }
        if (f.proveedor && typeof f.proveedor === "object") {
            return String(f.proveedor.documento || f.proveedor.nroDocumento || f.proveedor.nit || f.proveedor.identificacion || "");
        }
        return "";
    };

    // Todas las facturas pendientes de la clínica con saldo mayor a 0 y no pagadas/anuladas
    const todasFacturasPendientes = useMemo(() => {
        if (!facturasCompraPendientes || facturasCompraPendientes.length === 0) return [];
        return facturasCompraPendientes.filter(fc => {
            const saldo = parseFloat(fc.saldo_pendiente ?? fc.saldoPendiente ?? fc.totalNeto ?? fc.total ?? fc.monto ?? 0);
            if (saldo <= 0) return false;

            const estado = (fc.estado || fc.status || "").toLowerCase().trim();
            if (estado === "pagada" || estado === "anulada") return false;

            const fcCode = fc.factus_number || fc.nroFactura || fc.documentoNumero || fc.numero || (String(fc.id).startsWith("fc_") ? `FC-${String(fc.id).slice(3, 8)}` : `FC-${fc.id}`);
            const yaEnItems = items.some(it => it.isFactura && (String(it.facturaId) === String(fc.id) || String(it.numeroFactura) === String(fcCode)));
            if (yaEnItems) return false;

            return true;
        });
    }, [facturasCompraPendientes, items]);

    // Facturas de compra disponibles para el tercero seleccionado con saldo pendiente
    const availableFacturasCompra = useMemo(() => {
        // Si no hay ningún tercero seleccionado ni especificado, NO mostrar facturas
        if (!selectedTerceroObj && !terceroSearchQuery.trim()) return [];
        if (todasFacturasPendientes.length === 0) return [];

        const tId = String(selectedTerceroObj?.id || "").trim();
        const tDoc = String(selectedTerceroObj?.documento || selectedTerceroObj?.nroDocumento || selectedTerceroObj?.nit || "").trim();
        const tName = String(selectedTerceroObj?.nombre || selectedTerceroObj?.razonSocial || terceroSearchQuery || "").trim();

        // Normalización estricta de nombres y textos
        const normalizeText = (val) =>
            String(val || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // eliminar tildes/acentos
                .replace(/[^a-z0-9]/g, " ")      // signos de puntuación como espacios
                .replace(/\s+/g, " ")            // espacios colapsados
                .trim();

        // Eliminar sufijos societarios comunes para comparar la raíz del nombre
        const stripSocietario = (val) =>
            normalizeText(val)
                .replace(/\b(s\s*a\s*s|s\s*a|ltda|limitada|e\s*u|e\s*p\s*s|i\s*p\s*s|sociedad por acciones simplificada|cia|compania)\b/g, "")
                .replace(/\s+/g, " ")
                .trim();

        // Extractor de dígitos del documento (completo y base sin dígito de verificación)
        const getDocDetails = (val) => {
            if (!val) return { full: "", base: "" };
            const s = String(val).trim();
            const withoutHyphen = s.includes("-") ? s.split("-")[0] : s;
            return {
                full: s.replace(/\D/g, ""),
                base: withoutHyphen.replace(/\D/g, "")
            };
        };

        const tDocInfo = getDocDetails(tDoc);
        const tNormName = normalizeText(tName);
        const tCoreName = stripSocietario(tName);

        return todasFacturasPendientes.filter(fc => {
            // 1. Coincidencia directa por ID de tercero, proveedor o paciente
            const fcProvId = String(fc.terceroId || fc.tercero_id || fc.proveedorId || fc.proveedor_id || fc.tercero?.id || fc.proveedor?.id || "").trim();
            const fcPacId = String(fc.pacienteId || fc.paciente_id || fc.paciente?.id || "").trim();
            if (tId && (tId === fcProvId || tId === fcPacId)) return true;

            // 2. Coincidencia por documento (NIT o Cédula sin dígitos de verificación falsos)
            const rawFcDoc = extractProvDoc(fc);
            if (rawFcDoc) {
                const fcDocInfo = getDocDetails(rawFcDoc);
                // Si ambos tienen NIT base de al menos 4 dígitos numéricos y coinciden exactamente
                if (tDocInfo.base && fcDocInfo.base && tDocInfo.base.length >= 4 && fcDocInfo.base.length >= 4) {
                    if (tDocInfo.base === fcDocInfo.base) return true;
                }
                // O coincidencia exacta de todos los dígitos
                if (tDocInfo.full && fcDocInfo.full && tDocInfo.full.length >= 4 && fcDocInfo.full.length >= 4) {
                    if (tDocInfo.full === fcDocInfo.full) return true;
                }
            }

            // 3. Coincidencia por nombre o razón social (estricta)
            const fcProvName = extractProvName(fc);
            if (fcProvName) {
                const fcNormName = normalizeText(fcProvName);
                const fcCoreName = stripSocietario(fcProvName);

                // Igualdad exacta de nombre completo normalizado
                if (tNormName && fcNormName && tNormName === fcNormName) return true;

                // Igualdad exacta de la raíz del nombre (sin sufijo tipo SAS, EPS, etc.)
                if (tCoreName && fcCoreName && tCoreName.length >= 4 && fcCoreName.length >= 4) {
                    if (tCoreName === fcCoreName) return true;
                }
            }

            return false;
        });
    }, [todasFacturasPendientes, selectedTerceroObj, terceroSearchQuery]);

    const getFacturaCode = (fc) => {
        if (!fc) return "Factura de compra";
        return fc.factus_number || fc.nroFactura || fc.documentoNumero || fc.numero || (String(fc.id).startsWith("fc_") ? `FC-${String(fc.id).slice(3, 8)}` : `FC-${fc.id}`);
    };

    const handleAddFactura = () => {
        if (!selectedTerceroObj && !terceroSearchQuery.trim()) {
            toast.error("Por favor, seleccione o ingrese primero un tercero o paciente");
            return;
        }
        setAsociarFacturaData({
            facturaId: "",
            facturaObj: null,
            cantidad: 1,
            pendientePorPagar: 0,
            valorAPagar: 0,
            impuesto: ""
        });
        setShowAsociarFacturaModal(true);
    };

    const handleSelectFacturaChange = (fcId) => {
        if (!fcId || fcId === "no_seleccionar") {
            setAsociarFacturaData(prev => ({
                ...prev,
                facturaId: "",
                facturaObj: null,
                pendientePorPagar: 0,
                valorAPagar: 0
            }));
            return;
        }
        const fc = facturasCompraPendientes.find(f => String(f.id) === String(fcId));
        if (fc) {
            const saldo = parseFloat(fc.saldo_pendiente ?? fc.saldoPendiente ?? fc.totalNeto ?? fc.total ?? fc.monto ?? 0);
            setAsociarFacturaData(prev => ({
                ...prev,
                facturaId: fc.id,
                facturaObj: fc,
                pendientePorPagar: saldo,
                valorAPagar: saldo
            }));

            // Si el tercero en el formulario principal no ha sido seleccionado, auto-vincularlo
            if (!selectedTerceroObj && !terceroId) {
                const provName = extractProvName(fc);
                const provDoc = extractProvDoc(fc);
                if (provName) {
                    setTerceroSearchQuery(provName);
                    setTerceroId(fc.tercero_id || fc.terceroId || fc.proveedor_id || provName);
                    setSelectedTerceroObj({
                        id: fc.tercero_id || fc.terceroId || fc.proveedor_id || provName,
                        nombre: provName,
                        documento: provDoc,
                        tipo: "tercero"
                    });
                }
            }
        }
    };

    const handleSaveAsociarFacturaModal = (e) => {
        e.preventDefault();
        const valPagar = parseRawNumber(asociarFacturaData.valorAPagar);
        if (valPagar <= 0) {
            toast.error("El valor a pagar debe ser mayor a 0");
            return;
        }

        const fc = asociarFacturaData.facturaObj;
        const num = fc ? getFacturaCode(fc) : "Factura de compra";
        // Obtener el concepto real de la factura de compra sin repetir el nombre del proveedor
        const conceptoRealFc = (fc?.items && Array.isArray(fc.items) && fc.items.length > 0)
            ? fc.items.map(it => (it.concepto && it.descripcion && it.concepto !== it.descripcion) ? `${it.concepto} - ${it.descripcion}` : (it.concepto || it.descripcion)).filter(Boolean).join(", ")
            : (fc?.concepto || fc?.descripcion || "Adquisición de bienes / servicios");

        setItems(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                concepto: conceptoRealFc,
                numeroFactura: num,
                descripcion: `Factura ${num}`,
                precioUnitario: valPagar,
                cantidad: parseFloat(asociarFacturaData.cantidad) || 1,
                impuesto: asociarFacturaData.impuesto,
                total: valPagar * (parseFloat(asociarFacturaData.cantidad) || 1),
                facturaId: fc?.id || null,
                isFactura: true
            }
        ]);

        if (fc?.id) {
            setFacturasSeleccionadas(prev => [...prev, fc.id]);
        }

        setShowAsociarFacturaModal(false);
        setAsociarFacturaData({
            facturaId: "",
            facturaObj: null,
            cantidad: 1,
            pendientePorPagar: 0,
            valorAPagar: 0,
            impuesto: ""
        });
        toast.success("Factura asociada al pago");
    };

    // Guardar Pago con validación de saldo en caja
    const handleSavePago = async (forceProceed = false) => {
        if (!fecha) {
            toast.error("La fecha es requerida");
            return;
        }
        if (!bancoCaja) {
            toast.error("Seleccione un Banco o Caja para el pago");
            return;
        }
        if (!terceroId && !terceroSearchQuery.trim()) {
            toast.error("Seleccione o busque el Tercero o Paciente");
            return;
        }
        if (!condicionPago) {
            toast.error("Seleccione la condición de pago");
            return;
        }

        const validItems = items.filter(it => it.concepto || it.descripcion || it.total > 0);
        if (validItems.length === 0 && !pagoFacturasCompra) {
            toast.error("Debe agregar al menos un concepto de pago");
            return;
        }

        // Validar si el pago se realiza desde la Caja del usuario
        const isPayingFromCaja = Boolean(
            miCajaAbierta && 
            bancoCaja && 
            (bancoCaja.toUpperCase() === userCajaLabel.toUpperCase() || bancoCaja.toUpperCase().includes("CAJA"))
        );

        const saldoCajaActual = Number(miCajaAbierta?.saldo_actual ?? miCajaAbierta?.saldoActual ?? 0);

        // Si se paga desde caja y no alcanza el dinero, alertar para confirmación
        if (isPayingFromCaja && totalGeneral > saldoCajaActual && !forceProceed) {
            setShowInsuficienteModal(true);
            return;
        }

        setSaving(true);
        try {
            const selectedTercero = selectedTerceroObj || terceros.find(t => t.id === terceroId || t.nombre === terceroId) || {
                id: terceroId || `tercero_${Date.now()}`,
                nombre: terceroSearchQuery || terceroId || "Tercero",
                documento: ""
            };
            const selectedProf = (profesionales || []).find(
                p => p.id === profesionalId || p.nombre === profesionalId || p.displayName === profesionalId
            );

            let pagoRecord = {
                id: `pago_${crypto.randomUUID()}`,
                tenant_id: inquilino,
                pagadorEmail,
                fecha,
                profesionalId: selectedProf?.id || profesionalId || "",
                profesional: selectedProf?.nombre || selectedProf?.displayName || profesionalId || "",
                bancoCaja,
                medioPago: medioPago || "Efectivo",
                terceroId: selectedTercero?.id || terceroId,
                tercero: selectedTercero?.nombre || terceroId || terceroSearchQuery,
                proveedor: selectedTercero?.nombre || terceroId || terceroSearchQuery,
                documentoTercero: selectedTercero?.documento || "",
                tipoTercero: selectedTercero?.tipo || "tercero",
                condicionPago,
                pagoFacturasCompra,
                facturasSeleccionadas,
                items: validItems,
                concepto: validItems.map(i => i.concepto).filter(Boolean).join(", ") || (pagoFacturasCompra ? "Pago facturas compra" : "Pago a proveedor"),
                monto: totalGeneral,
                total: totalGeneral,
                observaciones: (() => {
                    let obsStr = String(observaciones || "").trim();
                    const facturasNums = [...new Set(
                        validItems
                            .filter(i => i.isFactura)
                            .map(i => i.numeroFactura || i.concepto)
                            .filter(Boolean)
                    )].join(", ");
                    if (facturasNums) {
                        if (!obsStr) return facturasNums;
                        if (!obsStr.includes(facturasNums)) return `${facturasNums} — ${obsStr}`;
                    }
                    return obsStr;
                })(),
                created_at: new Date().toISOString(),
                created_by: user?.id || userProfile?.uid,
                registradoPor: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador",
                registrado_por: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador",
                creadoPor: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador",
                creado_por: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador",
                usuarioCreador: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador",
                usuario_nombre: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administrador"
            };

            pagoRecord = await createSupplierExpense(inquilino, pagoRecord);

            // 3. Registrar Egreso en movimientos_caja y actualizar saldo de la caja (positivo o negativo)
            if (isPayingFromCaja && miCajaAbierta?.id) {
                const movData = {
                    tenant_id: inquilino,
                    caja_id: miCajaAbierta.id,
                    usuario_id: user?.id || userProfile?.uid || null,
                    tipo: "egreso",
                    concepto: `Pago a Proveedor: ${pagoRecord.tercero} - ${validItems[0]?.concepto || 'Gasto'}`,
                    monto: totalGeneral,
                    metodo_pago: medioPago || "Efectivo",
                    referencia: `Pago Proveedor | ${bancoCaja}${pagoRecord.documentoTercero ? ' | DOC: ' + pagoRecord.documentoTercero : ''}`,
                    created_at: new Date().toISOString()
                };

                try {
                    await supabase.from("movimientos_caja").insert([movData]);
                } catch (e) {
                    console.warn("Error insertando en movimientos_caja:", e);
                }

                const prevSaldo = Number(miCajaAbierta.saldo_actual ?? miCajaAbierta.saldoActual ?? 0);
                const prevEgresos = Number(miCajaAbierta.total_egresos ?? miCajaAbierta.totalEgresos ?? 0);
                const newSaldo = prevSaldo - totalGeneral;
                const newEgresos = prevEgresos + totalGeneral;

                try {
                    await supabase.from("cajas").update({
                        saldo_actual: newSaldo,
                        saldoActual: newSaldo,
                        total_egresos: newEgresos,
                        totalEgresos: newEgresos,
                        updated_at: new Date().toISOString()
                    }).eq("id", miCajaAbierta.id);
                } catch (e) {}

                try {
                    const currentCfgCajas = await getConfigSection(inquilino, "cajas", []);
                    if (Array.isArray(currentCfgCajas) && currentCfgCajas.length > 0) {
                        const updated = currentCfgCajas.map(c => {
                            if (c.id === miCajaAbierta.id) {
                                return {
                                    ...c,
                                    saldo_actual: newSaldo,
                                    saldoActual: newSaldo,
                                    total_egresos: newEgresos,
                                    totalEgresos: newEgresos,
                                    updated_at: new Date().toISOString()
                                };
                            }
                            return c;
                        });
                        await saveConfigSection(inquilino, "cajas", updated);
                    }
                } catch (e) {}

                setMiCajaAbierta(prev => prev ? ({
                    ...prev,
                    saldo_actual: newSaldo,
                    saldoActual: newSaldo,
                    total_egresos: newEgresos,
                    totalEgresos: newEgresos
                }) : null);
            }

            // 4. Actualizar saldo y estado en facturas_compra asociadas
            const facturasActualizadas = [];
            for (const item of validItems) {
                if (item.isFactura && item.facturaId) {
                    const fcOriginal = facturasCompraPendientes.find(f => String(f.id) === String(item.facturaId));
                    if (fcOriginal) {
                        const saldoPrev = parseFloat(fcOriginal.saldo_pendiente ?? fcOriginal.saldoPendiente ?? fcOriginal.total ?? fcOriginal.monto ?? 0);
                        const abono = parseFloat(item.total || item.precioUnitario || 0);
                        const nuevoSaldo = Math.max(0, saldoPrev - abono);
                        const nuevoEstado = nuevoSaldo === 0 ? "Pagada" : "Pendiente";

                        const fcUpdated = {
                            ...fcOriginal,
                            saldo_pendiente: nuevoSaldo,
                            saldoPendiente: nuevoSaldo,
                            estado: nuevoEstado,
                            updated_at: new Date().toISOString()
                        };
                        facturasActualizadas.push(fcUpdated);

                        try {
                            await supabase.from("facturas_compra").update({
                                saldo_pendiente: nuevoSaldo,
                                estado: nuevoEstado,
                                updated_at: new Date().toISOString()
                            }).eq("id", fcOriginal.id);
                        } catch (e) {}
                    }
                }
            }

            if (facturasActualizadas.length > 0) {
                try {
                    const currentFcList = await getConfigSection(inquilino, "facturas_compra", []);
                    if (Array.isArray(currentFcList) && currentFcList.length > 0) {
                        const mergedFcList = currentFcList.map(curr => {
                            const updatedMatch = facturasActualizadas.find(u => String(u.id) === String(curr.id));
                            return updatedMatch ? { ...curr, ...updatedMatch } : curr;
                        });
                        await saveConfigSection(inquilino, "facturas_compra", mergedFcList);
                    }
                } catch (e) {}
            }

            toast.success("Pago registrado con éxito");
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Error saving pago:", err);
            toast.error("Error al guardar el pago: " + (err.message || ""));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-700 pb-16 animate-fadeIn font-sans">
            
            {/* Header & Breadcrumbs matching OralDrive */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
                <div className="max-w-[1300px] mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Egresos</h1>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <FiHome className="text-slate-400" size={13} />
                            <span>Facturación</span>
                            <span>›</span>
                            <span>Egresos</span>
                            <span>›</span>
                            <span className="text-slate-700 font-semibold">Nuevo egreso</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all border border-slate-300"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSavePago}
                            disabled={saving}
                            className="px-7 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {saving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Form Container */}
            <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-6">

                {/* ========================================================= */}
                {/* CARD 1: INFORMACIÓN EMPRESA                              */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
                        <h2 className="text-sm font-semibold text-slate-800">Información empresa</h2>
                    </div>

                    <div className="p-6 space-y-4 max-w-4xl">
                        {/* Pagador */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Pagador
                            </label>
                            <div className="md:col-span-9">
                                <input
                                    type="text"
                                    readOnly
                                    value={pagadorEmail}
                                    className="w-full max-w-md h-9 px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 cursor-not-allowed select-none outline-none"
                                />
                            </div>
                        </div>

                        {/* Fecha */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Fecha <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9">
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Profesional */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Profesional
                            </label>
                            <div className="md:col-span-9">
                                <select
                                    value={profesionalId}
                                    onChange={(e) => setProfesionalId(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    {profesionales.map((p) => (
                                        <option key={p.id} value={p.nombre || p.id}>
                                            {p.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Banco/Caja */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Banco/Caja <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9">
                                <select
                                    value={bancoCaja}
                                    onChange={(e) => setBancoCaja(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    {/* Opción de Caja: SOLO se muestra si la caja está abierta */}
                                    {miCajaAbierta && (
                                        <option value={userCajaLabel}>
                                            {userCajaLabel}
                                        </option>
                                    )}
                                    {/* Bancos y Cuentas registradas en el sistema */}
                                    {bancosDisponibles.map((b, idx) => {
                                        const bName = typeof b === 'string' ? b : (b.nombre || b.nombreBanco || b.banco || "Banco");
                                        if (miCajaAbierta && bName.toUpperCase() === userCajaLabel.toUpperCase()) return null;
                                        return (
                                            <option key={idx} value={bName}>
                                                {bName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 2: DATOS TERCERO                                    */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
                        <h2 className="text-sm font-semibold text-slate-800">Datos tercero</h2>
                    </div>

                    <div className="p-6 space-y-4 max-w-4xl">
                        {/* Tercero / Paciente con Buscador Interactivo */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600 pt-2">
                                Tercero / Paciente <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9 flex items-start gap-2">
                                <div ref={searchContainerRef} className="relative w-full max-w-md">
                                    {/* Input de Búsqueda */}
                                    <div className="relative flex items-center">
                                        <FiSearch className="absolute left-3 text-slate-400 pointer-events-none" size={14} />
                                        <input
                                            type="text"
                                            value={terceroSearchQuery}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setTerceroSearchQuery(v);
                                                setIsSearchingTercero(Boolean(v.trim()));
                                                if (selectedTerceroObj && selectedTerceroObj.nombre !== v) {
                                                    setSelectedTerceroObj(null);
                                                    setTerceroId("");
                                                }
                                            }}
                                            onFocus={() => {
                                                if (terceroSearchQuery.trim()) {
                                                    setIsSearchingTercero(true);
                                                }
                                            }}
                                            placeholder="Escribe nombre o documento..."
                                            className={`w-full h-9 pl-9 pr-8 bg-white border ${selectedTerceroObj ? 'border-emerald-400 bg-emerald-50/20 font-medium text-slate-800' : 'border-slate-200 text-slate-700'} rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                                            required
                                        />
                                        {terceroSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTerceroSearchQuery("");
                                                    setSelectedTerceroObj(null);
                                                    setTerceroId("");
                                                    setIsSearchingTercero(false);
                                                }}
                                                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                                                title="Limpiar búsqueda"
                                            >
                                                <FiX size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Badge de Selección Activa */}
                                    {selectedTerceroObj && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                                            <span className={`font-bold uppercase text-[9px] px-1.5 py-0.2 rounded text-white ${
                                                selectedTerceroObj.tipo === 'paciente' ? 'bg-purple-600' : 'bg-emerald-600'
                                            }`}>
                                                {selectedTerceroObj.tipo === 'paciente' ? 'Paciente' : 'Tercero'}
                                            </span>
                                            <span className="truncate">{selectedTerceroObj.nombre}</span>
                                            {selectedTerceroObj.documento && (
                                                <span className="text-emerald-600 text-[10px]">({selectedTerceroObj.tipoDocumento || 'Doc'}: {selectedTerceroObj.documento})</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Menú Flotante de Resultados Filtrados */}
                                    {isSearchingTercero && Boolean(terceroSearchQuery.trim()) && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                                            {filteredTerceros.length > 0 ? (
                                                filteredTerceros.map((t) => (
                                                    <button
                                                        key={t.id + t.tipo}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedTerceroObj(t);
                                                            setTerceroId(t.id || t.nombre);
                                                            setTerceroSearchQuery(t.nombre);
                                                            setIsSearchingTercero(false);
                                                        }}
                                                        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-800">{t.nombre}</span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {t.tipoDocumento || 'Doc'}: {t.documento || 'Sin doc'} {t.telefono ? `• Tel: ${t.telefono}` : ''}
                                                            </span>
                                                        </div>
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                            t.tipo === 'paciente' 
                                                                ? 'bg-purple-100 text-purple-700' 
                                                                : 'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                            {t.tipo === 'paciente' ? 'Paciente' : 'Tercero'}
                                                        </span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-3 text-center text-xs text-slate-500">
                                                    No se encontraron terceros ni pacientes con "<strong>{terceroSearchQuery}</strong>"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(true)}
                                    className="w-8 h-8 rounded-full bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-95 mt-0.5"
                                    title="Crear nuevo tercero"
                                >
                                    <FiPlus size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Medio de pago */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Medio de pago <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9">
                                <select
                                    value={medioPago}
                                    onChange={(e) => setMedioPago(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    required
                                >
                                    {mediosPagoList.map((m, idx) => {
                                        const mName = typeof m === 'string' ? m : (m.nombre || m.name || m.label || "Efectivo");
                                        return (
                                            <option key={idx} value={mName}>
                                                {mName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Condición de pago */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Condición de pago <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9">
                                <select
                                    value={condicionPago}
                                    onChange={(e) => setCondicionPago(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    required
                                >
                                    <option value="">Seleccione condición...</option>
                                    {condicionesPagoList.map((cond, idx) => {
                                        const condName = typeof cond === 'string' ? cond : (cond.nombre || cond.label || cond.condicion || "Condición");
                                        const diasInfo = cond.dias ? ` (${cond.dias} días)` : '';
                                        return (
                                            <option key={idx} value={condName}>
                                                {condName}{diasInfo}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Pago facturas de compra */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div className="md:col-span-3 text-right flex items-center justify-end gap-1">
                                <span className="text-xs font-medium text-slate-600">Pago facturas de compra</span>
                                <span title="Permite asociar este pago a facturas de compra pendientes" className="cursor-help text-slate-400">
                                    <FiInfo size={13} />
                                </span>
                            </div>
                            <div className="md:col-span-9 flex items-center">
                                <button
                                    type="button"
                                    onClick={() => setPagoFacturasCompra(!pagoFacturasCompra)}
                                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${pagoFacturasCompra ? 'bg-[#8dc63f]' : 'bg-slate-200'}`}
                                >
                                    <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${pagoFacturasCompra ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 3: TABLA DE CONCEPTOS / FACTURAS                     */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                    <div className="flex items-center justify-end">
                        {pagoFacturasCompra ? (
                            <button
                                type="button"
                                onClick={handleAddFactura}
                                className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                            >
                                + Añadir factura
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleAddConcepto}
                                className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                            >
                                + Nuevo concepto
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white">
                                    <th className="py-3 px-4 w-[28%]">Concepto</th>
                                    <th className="py-3 px-4 w-[32%]">Descripción</th>
                                    <th className="py-3 px-4 w-[16%]">
                                        {pagoFacturasCompra ? "Precio" : "Precio unitario"}
                                    </th>
                                    <th className="py-3 px-4 w-[10%]">Cantidad</th>
                                    <th className="py-3 px-4 w-[10%]">Total</th>
                                    <th className="py-3 px-4 w-[4%] text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs italic">
                                            {pagoFacturasCompra 
                                                ? "Haga clic en '+ Añadir factura' para asociar una factura de compra." 
                                                : "Haga clic en '+ Nuevo concepto' para agregar un concepto de pago."}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                                                {item.concepto}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-600">
                                                {item.descripcion || "—"}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-700">
                                                {fmt(item.precioUnitario)}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-700">
                                                {item.cantidad}
                                            </td>
                                            <td className="py-2.5 px-4 font-bold text-slate-800">
                                                {fmt(item.total)}
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveConcepto(item.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-2 pr-4">
                        <div className="text-right">
                            <span className="text-xs text-slate-500 mr-4 font-medium">Total</span>
                            <span className="text-sm font-bold text-slate-800">{fmt(totalGeneral)}</span>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 4: OBSERVACIONES                                     */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
                        <h2 className="text-sm font-semibold text-slate-800">Observaciones</h2>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600 pt-2">
                                Observaciones
                            </label>
                            <div className="md:col-span-9">
                                <textarea
                                    rows={4}
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Comentarios adicionales sobre el pago..."
                                    className="w-full max-w-2xl p-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-y"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Save Action */}
                <div className="flex justify-end gap-3 pt-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all border border-slate-300"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSavePago}
                        disabled={saving}
                        className="px-8 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>

            </div>

            {/* MODAL CREAR NUEVO TERCERO - 100% IDÉNTICO A ORAL DRIVE */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-scaleIn">
                        {/* Header */}
                        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-sm font-semibold text-slate-800">
                                Nuevo tercero <span className="text-rose-500">*</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSaveNewTercero} className="p-6 space-y-3 text-xs">
                            {/* Nombre */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Nombre <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        required
                                        value={newTerceroData.nombre}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, nombre: e.target.value })}
                                        placeholder="Nombre del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Apellidos */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Apellidos
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        value={newTerceroData.apellidos}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, apellidos: e.target.value })}
                                        placeholder="Apellidos del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Tipo de documento */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Tipo de documento <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <select
                                        required
                                        value={newTerceroData.tipoDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, tipoDocumento: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="CC">Cédula de ciudadanía</option>
                                        <option value="NIT">NIT</option>
                                        <option value="CE">Cédula de extranjería</option>
                                        <option value="PAS">Pasaporte</option>
                                        <option value="TI">Tarjeta de identidad</option>
                                        <option value="RC">Registro civil</option>
                                    </select>
                                </div>
                            </div>

                            {/* Número de documento */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Número de documento <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        required
                                        value={newTerceroData.nroDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, nroDocumento: e.target.value })}
                                        placeholder="Nro. de documento del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Razón social */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Razón social
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        value={newTerceroData.razonSocial}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, razonSocial: e.target.value })}
                                        placeholder="Razón social del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Teléfono */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Teléfono <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        required
                                        value={newTerceroData.telefono}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, telefono: e.target.value })}
                                        placeholder="Teléfono del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Dirección */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Dirección <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        required
                                        value={newTerceroData.direccion}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, direccion: e.target.value })}
                                        placeholder="Dirección del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* País de domicilio */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    País de domicilio
                                </label>
                                <div className="md:col-span-8">
                                    <select
                                        value={newTerceroData.pais}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, pais: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="Colombia">Colombia</option>
                                        <option value="Venezuela">Venezuela</option>
                                        <option value="Ecuador">Ecuador</option>
                                        <option value="Perú">Perú</option>
                                        <option value="Panamá">Panamá</option>
                                        <option value="Estados Unidos">Estados Unidos</option>
                                        <option value="España">España</option>
                                    </select>
                                </div>
                            </div>

                            {/* Ciudad de domicilio */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Ciudad de domicilio
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        value={newTerceroData.ciudad}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, ciudad: e.target.value })}
                                        placeholder="Ciudad del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Correo electrónico */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Correo electrónico
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="email"
                                        value={newTerceroData.email}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, email: e.target.value })}
                                        placeholder="Correo del tercero"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(false)}
                                    className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTercero}
                                    className="px-6 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {savingTercero ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1: NUEVO CONCEPTO - 100% IDÉNTICO A ORAL DRIVE */}
            {showNewConceptoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-scaleIn">
                        {/* Header */}
                        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-sm font-semibold text-slate-800">
                                Nuevo concepto
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowNewConceptoModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSaveConceptoModal} className="p-6 space-y-3.5 text-xs">
                            {/* Concepto */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Concepto <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        required
                                        value={newConceptoData.concepto}
                                        onChange={(e) => setNewConceptoData({ ...newConceptoData, concepto: e.target.value })}
                                        placeholder="Ingrese el nombre del concepto"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Descripción */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Descripción
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        value={newConceptoData.descripcion}
                                        onChange={(e) => setNewConceptoData({ ...newConceptoData, descripcion: e.target.value })}
                                        placeholder="Ingrese la descripción del concepto"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Cantidad <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={newConceptoData.cantidad}
                                        onChange={(e) => setNewConceptoData({ ...newConceptoData, cantidad: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Precio unitario */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Precio unitario <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            required
                                            value={newConceptoData.precioUnitario}
                                            onChange={(e) => setNewConceptoData({ ...newConceptoData, precioUnitario: formatNumberWithDots(e.target.value) })}
                                            placeholder="0"
                                            className="w-full h-8 pl-7 pr-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Impuesto */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Impuesto
                                </label>
                                <div className="md:col-span-8 flex items-center gap-2">
                                    <select
                                        value={newConceptoData.impuesto}
                                        onChange={(e) => setNewConceptoData({ ...newConceptoData, impuesto: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Seleccione</option>
                                        <option value="exento">Exento (0%)</option>
                                        <option value="iva_5">IVA (5%)</option>
                                        <option value="iva_19">IVA (19%)</option>
                                        <option value="inc_8">INC (8%)</option>
                                        <option value="retefuente_25">ReteFuente (2.5%)</option>
                                    </select>
                                    <button
                                        type="button"
                                        className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center shrink-0 transition-all shadow-sm active:scale-95"
                                        title="Agregar impuesto"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNewConceptoModal(false)}
                                    className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold shadow-sm transition-all active:scale-95"
                                >
                                    Agregar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: ASOCIAR FACTURA - 100% IDÉNTICO A ORAL DRIVE */}
            {showAsociarFacturaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-scaleIn">
                        {/* Header */}
                        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-sm font-semibold text-slate-800">
                                Asociar factura
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAsociarFacturaModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSaveAsociarFacturaModal} className="p-6 space-y-3.5 text-xs">
                            {/* Factura de compra */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <div className="md:col-span-4 text-right flex items-center justify-end gap-1">
                                    <span className="text-xs font-medium text-slate-600">Factura de compra*</span>
                                    <span title="Seleccione la factura de compra pendiente que desea pagar" className="cursor-help text-slate-400">
                                        <FiInfo size={13} />
                                    </span>
                                </div>
                                <div className="md:col-span-8 space-y-1.5">
                                    <select
                                        value={asociarFacturaData.facturaId}
                                        onChange={(e) => handleSelectFacturaChange(e.target.value)}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">No seleccionar factura</option>
                                        {availableFacturasCompra.length > 0 ? (
                                            <optgroup label={selectedTerceroObj ? `Facturas de ${selectedTerceroObj.nombre}` : "Facturas del tercero"}>
                                                {availableFacturasCompra.map((fc) => (
                                                    <option key={fc.id} value={fc.id}>
                                                        {getFacturaCode(fc)} - {extractProvName(fc) || "Proveedor"} ({fmt(fc.saldo_pendiente ?? fc.saldoPendiente ?? fc.totalNeto ?? fc.total ?? fc.monto)})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ) : (
                                            <option value="" disabled>
                                                {selectedTerceroObj || Boolean(terceroSearchQuery.trim())
                                                    ? "No hay facturas pendientes para este tercero"
                                                    : "Seleccione primero un tercero o paciente"}
                                            </option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Cantidad*
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="number"
                                        min="1"
                                        value={asociarFacturaData.cantidad}
                                        onChange={(e) => setAsociarFacturaData({ ...asociarFacturaData, cantidad: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Pendiente por pagar */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Pendiente por pagar
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        readOnly
                                        value={fmt(asociarFacturaData.pendientePorPagar)}
                                        className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 cursor-not-allowed select-none outline-none"
                                    />
                                </div>
                            </div>

                            {/* Valor a pagar */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Valor a pagar*
                                </label>
                                <div className="md:col-span-8">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            required
                                            value={asociarFacturaData.valorAPagar}
                                            onChange={(e) => setAsociarFacturaData({ ...asociarFacturaData, valorAPagar: formatNumberWithDots(e.target.value) })}
                                            placeholder="0"
                                            className="w-full h-8 pl-7 pr-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Impuesto */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                                    Impuesto
                                </label>
                                <div className="md:col-span-8 flex items-center gap-2">
                                    <select
                                        value={asociarFacturaData.impuesto}
                                        onChange={(e) => setAsociarFacturaData({ ...asociarFacturaData, impuesto: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Seleccione</option>
                                        <option value="exento">Exento (0%)</option>
                                        <option value="iva_5">IVA (5%)</option>
                                        <option value="iva_19">IVA (19%)</option>
                                        <option value="inc_8">INC (8%)</option>
                                        <option value="retefuente_25">ReteFuente (2.5%)</option>
                                    </select>
                                    <button
                                        type="button"
                                        className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center shrink-0 transition-all shadow-sm active:scale-95"
                                        title="Agregar impuesto"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="submit"
                                    className="px-6 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold shadow-sm transition-all active:scale-95"
                                >
                                    Añadir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAsociarFacturaModal(false)}
                                    className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        
            {/* Modal de Alerta por Fondos Insuficientes en Caja */}
            {showInsuficienteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3 text-amber-600">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <FiAlertCircle size={22} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Dinero insuficiente en caja</h3>
                                <p className="text-xs text-slate-500">Confirmación de saldo en descubierto</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            El dinero disponible en la caja (<span className="font-bold text-slate-800">{userCajaLabel}</span>) no es suficiente para realizar este pago.
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Saldo actual en caja:</span>
                                <span className="font-semibold text-slate-800">{fmt(miCajaAbierta?.saldo_actual ?? miCajaAbierta?.saldoActual ?? 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Monto del pago:</span>
                                <span className="font-semibold text-slate-900">{fmt(totalGeneral)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200 text-rose-600 font-bold">
                                <span>Nuevo saldo proyectado:</span>
                                <span>{fmt((Number(miCajaAbierta?.saldo_actual ?? miCajaAbierta?.saldoActual ?? 0)) - totalGeneral)}</span>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 italic">
                            ¿Desea confirmar y realizar el pago de todos modos? En el módulo de caja el saldo se actualizará y quedará en negativo.
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowInsuficienteModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowInsuficienteModal(false);
                                    handleSavePago(true);
                                }}
                                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
                            >
                                Sí, realizar pago
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
