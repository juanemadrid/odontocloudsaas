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

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function PagosForm({ onCancel, onSuccess }) {
    const { user, userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [saving, setSaving] = useState(false);
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
        precioUnitario: 0,
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
                    "condiciones_pago", "metodos_pago", "facturas_compra", "facturasCompra"
                ]);

                // 2. Cargar Terceros y Pacientes unificados
                let tercerosList = [];
                try {
                    const { data: tDb } = await supabase
                        .from("terceros")
                        .select("*")
                        .or(`tenant_id.eq.${inquilino},tenant_id.eq.${userProfile?.tenant_id || ''}`);
                    if (tDb && tDb.length > 0) {
                        tercerosList = tDb.map(t => ({
                            id: t.id,
                            nombre: t.nombre || t.razon_social || t.nombre_completo || "Tercero",
                            documento: t.numero_documento || t.documento || t.nit || t.nroDocumento || "",
                            tipoDocumento: t.tipo_documento || t.tipoDocumento || "NIT",
                            telefono: t.telefono || "",
                            tipo: "tercero"
                        }));
                    }
                } catch (e) {}

                if (tercerosList.length === 0) {
                    const rawT = cfg.terceros || cfg.proveedores || [];
                    tercerosList = rawT.map(t => ({
                        id: t.id || t.documento || t.nombre,
                        nombre: t.nombre || t.razonSocial || "Tercero",
                        documento: t.documento || t.nit || t.nroDocumento || "",
                        tipoDocumento: t.tipoDocumento || "NIT",
                        telefono: t.telefono || "",
                        tipo: "tercero"
                    }));
                }

                // Cargar Pacientes de la clínica (con select("*") para asegurar lectura de nombres y documentos)
                let pacientesList = [];
                try {
                    const { data: pDb } = await supabase
                        .from("pacientes")
                        .select("id,tenant_id,tipo_documento,documento,nombres,apellidos,telefono")
                        .eq("tenant_id", inquilino);
                    
                    const tenantMatches = (pDb || []).filter(p => 
                        !p.tenant_id || 
                        p.tenant_id === inquilino || 
                        p.tenant_id === userProfile?.tenant_id ||
                        p.tenant_id === "2e573a5a-70b2-4175-8332-4ebfa9bc0836" ||
                        p.tenant_id === "atm_centro_del_dolor_01"
                    );

                    pacientesList = (tenantMatches.length > 0 ? tenantMatches : (pDb || [])).map(p => {
                        const full = `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.nombreCompleto || p.displayName || p.documento || "Paciente";
                        return {
                            id: p.id,
                            nombre: full,
                            documento: p.documento || p.nroDocumento || p.identificacion || "",
                            tipoDocumento: p.tipoDocumento || p.tipo_documento || "CC",
                            telefono: p.telefono || p.celular || p.movil || "",
                            tipo: "paciente"
                        };
                    });
                } catch (e) {
                    console.warn("Error cargando pacientes en PagosForm:", e);
                }

                const unifiedTerceros = [...tercerosList, ...pacientesList];
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
                        { id: "credito_30", nombre: "Crédito 30 días" }
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

                // 8. Cargar Facturas de Compra pendientes
                try {
                    const { data: fcDb } = await supabase
                        .from("facturas_compra")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    let allFc = fcDb || [];
                    if (allFc.length === 0) {
                        allFc = cfg.facturas_compra || cfg.facturasCompra || [];
                    }
                    setFacturasCompraPendientes(allFc);
                } catch (e) {}

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
            precioUnitario: 0,
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
        const pu = parseFloat(newConceptoData.precioUnitario) || 0;
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
            precioUnitario: 0,
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
            const pu = field === "precioUnitario" ? parseFloat(value) || 0 : (parseFloat(item.precioUnitario) || 0);
            const cant = field === "cantidad" ? parseFloat(value) || 0 : (parseFloat(item.cantidad) || 0);
            updated.total = pu * cant;
            return updated;
        }));
    };

    // Calcular Total
    const totalGeneral = useMemo(() => {
        return items.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
    }, [items]);

    // Filtrar Terceros y Pacientes en tiempo real por el buscador
    const filteredTerceros = useMemo(() => {
        const q = (terceroSearchQuery || "").toLowerCase().trim();
        if (!q) return terceros.slice(0, 30);
        return terceros.filter(t => {
            const name = String(t.nombre || "").toLowerCase();
            const doc = String(t.documento || t.nroDocumento || "").toLowerCase();
            const tel = String(t.telefono || "").toLowerCase();
            return name.includes(q) || doc.includes(q) || tel.includes(q);
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

    // Facturas de compra disponibles exclusivamente para el tercero seleccionado
    const availableFacturasCompra = useMemo(() => {
        if (!selectedTerceroObj && !terceroSearchQuery.trim()) return [];
        const tName = (selectedTerceroObj?.nombre || terceroSearchQuery || "").toLowerCase().trim();
        const tDoc = (selectedTerceroObj?.documento || "").toLowerCase().trim();
        const tId = String(selectedTerceroObj?.id || "");
        
        if (!facturasCompraPendientes || facturasCompraPendientes.length === 0) return [];
        
        return facturasCompraPendientes.filter(fc => {
            const fcProvId = String(fc.tercero_id || fc.terceroId || fc.proveedor_id || fc.proveedorId || "");
            const fcProv = (fc.proveedor || fc.tercero || fc.proveedorNombre || fc.terceroNombre || fc.nombre || "").toLowerCase().trim();
            const fcDoc = (fc.documentoTercero || fc.documento || fc.nit || fc.nroDocumento || "").toLowerCase().trim();
            
            const matchId = tId && fcProvId && (tId === fcProvId);
            const matchName = tName && fcProv && (fcProv.includes(tName) || tName.includes(fcProv));
            const matchDoc = tDoc && fcDoc && (fcDoc === tDoc || fcDoc.includes(tDoc) || tDoc.includes(fcDoc));
            
            return matchId || matchName || matchDoc;
        });
    }, [facturasCompraPendientes, selectedTerceroObj, terceroSearchQuery]);

    const handleAddFactura = () => {
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
            const saldo = parseFloat(fc.saldo_pendiente || fc.total || fc.monto || 0);
            setAsociarFacturaData(prev => ({
                ...prev,
                facturaId: fc.id,
                facturaObj: fc,
                pendientePorPagar: saldo,
                valorAPagar: saldo
            }));
        }
    };

    const handleSaveAsociarFacturaModal = (e) => {
        e.preventDefault();
        const valPagar = parseFloat(asociarFacturaData.valorAPagar) || 0;
        if (valPagar <= 0) {
            toast.error("El valor a pagar debe ser mayor a 0");
            return;
        }

        const fc = asociarFacturaData.facturaObj;
        const num = fc ? (fc.numero || `FC-${fc.id}`) : "Factura de compra";
        const desc = fc ? (fc.descripcion || fc.proveedor || fc.tercero || "Factura de compra") : (selectedTerceroObj?.nombre ? `Pago factura ${selectedTerceroObj.nombre}` : "Pago de factura");

        setItems(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                concepto: num,
                descripcion: desc,
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

    // Guardar Pago
    const handleSavePago = async () => {
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

        setSaving(true);
        try {
            const selectedTercero = selectedTerceroObj || terceros.find(t => t.id === terceroId || t.nombre === terceroId) || {
                id: terceroId || `tercero_${Date.now()}`,
                nombre: terceroSearchQuery || terceroId || "Tercero",
                documento: ""
            };
            const selectedProf = profesionales.find(p => p.id === profesionalId || p.nombre === profesionalId);

            const pagoRecord = {
                id: `pago_${Date.now()}`,
                tenant_id: inquilino,
                pagadorEmail,
                fecha,
                profesionalId: selectedProf?.id || profesionalId,
                profesional: selectedProf?.nombre || profesionalId || "",
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
                monto: totalGeneral,
                total: totalGeneral,
                observaciones,
                created_at: new Date().toISOString(),
                created_by: user?.id || userProfile?.uid
            };

            // 1. Guardar en tabla pagos_proveedor
            try {
                await supabase.from("pagos_proveedor").insert([pagoRecord]);
            } catch (e) {
                console.warn("Tabla pagos_proveedor no disponible, guardando en config:", e.message);
            }

            // 2. Sincronizar en website_config
            try {
                const currPagos = await getConfigSection(inquilino, "pagos_proveedor", []);
                await saveConfigSection(inquilino, "pagos_proveedor", [
                    pagoRecord,
                    ...(Array.isArray(currPagos) ? currPagos : [])
                ]);
            } catch (e) {
                console.error("Error saving in website_config:", e);
            }

            // 3. Registrar Egreso en Caja si aplica
            try {
                await supabase.from("caja_movimientos").insert([{
                    tenant_id: inquilino,
                    tipo: "egreso",
                    concepto: `Pago a Proveedor: ${pagoRecord.tercero} - ${validItems[0]?.concepto || 'Gasto'}`,
                    monto: totalGeneral,
                    medio_pago: bancoCaja,
                    fecha: new Date(fecha).toISOString(),
                    usuario_id: user?.id || userProfile?.uid,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {}

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
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Pagos</h1>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <FiHome className="text-slate-400" size={13} />
                            <span>Facturación</span>
                            <span>›</span>
                            <span>Pagos</span>
                            <span>›</span>
                            <span className="text-slate-700 font-semibold">Nuevo pago</span>
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
                                    {/* Opción de Caja / Responsable de la sesión actual */}
                                    <option value={userCajaLabel}>
                                        {userCajaLabel}
                                    </option>
                                    {/* Bancos y Cuentas registradas */}
                                    {bancosDisponibles.map((b, idx) => {
                                        const bName = typeof b === 'string' ? b : (b.nombre || b.nombreBanco || b.banco || "Banco");
                                        if (bName.toUpperCase() === userCajaLabel.toUpperCase()) return null;
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
                                                setTerceroSearchQuery(e.target.value);
                                                setIsSearchingTercero(true);
                                                if (selectedTerceroObj && selectedTerceroObj.nombre !== e.target.value) {
                                                    setSelectedTerceroObj(null);
                                                    setTerceroId("");
                                                }
                                            }}
                                            onFocus={() => setIsSearchingTercero(true)}
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
                                    {isSearchingTercero && (
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
                                    <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        required
                                        value={newConceptoData.precioUnitario || ""}
                                        onChange={(e) => setNewConceptoData({ ...newConceptoData, precioUnitario: e.target.value })}
                                        placeholder="$0"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
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
                                <div className="md:col-span-8">
                                    <select
                                        value={asociarFacturaData.facturaId}
                                        onChange={(e) => handleSelectFacturaChange(e.target.value)}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">No seleccionar factura</option>
                                        {availableFacturasCompra.length > 0 ? (
                                            availableFacturasCompra.map((fc) => (
                                                <option key={fc.id} value={fc.id}>
                                                    {fc.numero || `FC-${fc.id}`} - {fc.proveedor || fc.tercero || "Proveedor"} ({fmt(fc.saldo_pendiente || fc.total || fc.monto)})
                                                </option>
                                            ))
                                        ) : (
                                            <option value="" disabled>
                                                {selectedTerceroObj ? "Este tercero no tiene facturas de compra pendientes" : "Seleccione primero un tercero o paciente"}
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
                                    <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        required
                                        value={asociarFacturaData.valorAPagar || ""}
                                        onChange={(e) => setAsociarFacturaData({ ...asociarFacturaData, valorAPagar: e.target.value })}
                                        placeholder="$0"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
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

        </div>
    );
}
