import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
    FiCalendar, FiPlus, FiTrash2, FiSave, FiAlertCircle, 
    FiCheckCircle, FiX, FiInfo, FiHome, FiArrowLeft, FiUserPlus, FiSearch, FiUser
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { getActiveCaja } from "../../../services/supabaseServices";
import { getConfigItems } from "../../../services/configPersistenceService";
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
    const [medioPago, setMedioPago] = useState("");

    // Form fields - Card 2: Datos tercero
    const [terceroId, setTerceroId] = useState("");
    const [condicionPago, setCondicionPago] = useState("");
    const [pagoFacturasCompra, setPagoFacturasCompra] = useState(false);

    // Form fields - Card 3: Items / Conceptos
    const [items, setItems] = useState([
        {
            id: Date.now(),
            concepto: "",
            descripcion: "",
            precioUnitario: 0,
            cantidad: 1,
            total: 0
        }
    ]);

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

    // Modal Crear Tercero
    const [showNewTerceroModal, setShowNewTerceroModal] = useState(false);
    const [savingTercero, setSavingTercero] = useState(false);
    const [newTerceroData, setNewTerceroData] = useState({
        nombre: "",
        tipoDocumento: "NIT",
        nroDocumento: "",
        telefono: "",
        email: "",
        direccion: "",
        ciudad: "Sincelejo"
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
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();

                const cfg = cfgRow?.config || {};

                // 2. Cargar Terceros y Pacientes unificados
                let tercerosList = [];
                try {
                    const { data: tDb } = await supabase
                        .from("terceros")
                        .select("*")
                        .eq("tenant_id", inquilino);
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

                // Cargar Pacientes de la clínica
                let pacientesList = [];
                try {
                    const { data: pDb } = await supabase
                        .from("pacientes")
                        .select("id, nombre, apellido, documento, tipo_documento, telefono")
                        .eq("tenant_id", inquilino);
                    if (pDb && pDb.length > 0) {
                        pacientesList = pDb.map(p => ({
                            id: p.id,
                            nombre: `${p.nombre || ''} ${p.apellido || ''}`.trim() || "Paciente",
                            documento: p.documento || "",
                            tipoDocumento: p.tipo_documento || "CC",
                            telefono: p.telefono || "",
                            tipo: "paciente"
                        }));
                    }
                } catch (e) {}

                const unifiedTerceros = [...tercerosList, ...pacientesList];
                setTerceros(unifiedTerceros);

                // 3. Cargar Profesionales / Doctores
                let profList = [];
                try {
                    const { data: pDb } = await supabase
                        .from("profiles")
                        .select("id, full_name, role, activo")
                        .eq("tenant_id", inquilino);
                    if (pDb && pDb.length > 0) {
                        profList = pDb.map(p => ({
                            id: p.id,
                            nombre: p.full_name || "Doctor",
                            role: p.role
                        }));
                    }
                } catch (e) {}

                if (profList.length === 0) {
                    const cfgProfs = cfg.profesionales || cfg.doctores || [];
                    profList = cfgProfs.map(p => ({
                        id: p.id || p.uid || p.nombre,
                        nombre: p.nombre || p.nombreCompleto || "Doctor"
                    }));
                }
                setProfesionales(profList);

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
                    if (fcDb) setFacturasCompraPendientes(fcDb);
                } catch (e) {}

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
        setItems(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                concepto: "",
                descripcion: "",
                precioUnitario: 0,
                cantidad: 1,
                total: 0
            }
        ]);
    };

    const handleRemoveConcepto = (id) => {
        if (items.length === 1) {
            setItems([{
                id: Date.now(),
                concepto: "",
                descripcion: "",
                precioUnitario: 0,
                cantidad: 1,
                total: 0
            }]);
            return;
        }
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
        if (!q) return [];
        return terceros.filter(t => {
            const name = String(t.nombre || "").toLowerCase();
            const doc = String(t.documento || t.nroDocumento || "").toLowerCase();
            const tel = String(t.telefono || "").toLowerCase();
            return name.includes(q) || doc.includes(q) || tel.includes(q);
        }).slice(0, 20);
    }, [terceros, terceroSearchQuery]);

    // Guardar nuevo Tercero desde Modal
    const handleSaveNewTercero = async (e) => {
        e.preventDefault();
        if (!newTerceroData.nombre.trim()) {
            toast.error("El nombre del tercero es obligatorio");
            return;
        }

        setSavingTercero(true);
        try {
            const nuevoTerceroObj = {
                id: `tercero_${Date.now()}`,
                tenant_id: inquilino,
                nombre: newTerceroData.nombre.trim(),
                tipoDocumento: newTerceroData.tipoDocumento,
                nroDocumento: newTerceroData.nroDocumento.trim(),
                telefono: newTerceroData.telefono.trim(),
                email: newTerceroData.email.trim(),
                direccion: newTerceroData.direccion.trim(),
                ciudad: newTerceroData.ciudad.trim(),
                created_at: new Date().toISOString()
            };

            // Guardar en tabla terceros si existe
            try {
                await supabase.from("terceros").insert([nuevoTerceroObj]);
            } catch (e) {}

            // Sincronizar en website_config
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                const currCfg = cfgRow?.config || {};
                const currTerceros = currCfg.terceros || [];
                currCfg.terceros = [...currTerceros, nuevoTerceroObj];
                await supabase
                    .from("website_config")
                    .upsert({ tenant_id: inquilino, config: currCfg });
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
                tipoDocumento: "NIT",
                nroDocumento: "",
                telefono: "",
                email: "",
                direccion: "",
                ciudad: "Sincelejo"
            });
            toast.success("Tercero registrado correctamente ✅");
        } catch (err) {
            console.error("Error creating tercero:", err);
            toast.error("Error al registrar el tercero");
        } finally {
            setSavingTercero(false);
        }
    };

    // Guardar Pago
    const handleSavePago = async () => {
        if (!fecha) {
            toast.error("La fecha es requerida");
            return;
        }
        if (!bancoCaja) {
            toast.error("Seleccione un Banco o Caja para el egreso");
            return;
        }
        if (!medioPago) {
            toast.error("Seleccione el medio de pago");
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
                medioPago: medioPago || bancoCaja,
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
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();

                const currCfg = cfgRow?.config || {};
                const currPagos = currCfg.pagos_proveedor || [];
                currCfg.pagos_proveedor = [pagoRecord, ...currPagos];

                await supabase
                    .from("website_config")
                    .upsert({ tenant_id: inquilino, config: currCfg });
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
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600 pt-2">
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
                                    {miCajaAbierta && (
                                        <optgroup label="Mi Caja Abierta">
                                            <option value={`Caja: ${miCajaAbierta.nombre || 'Caja Principal'}`}>
                                                {`Caja: ${miCajaAbierta.nombre || 'Caja Principal'} (Abierta)`}
                                            </option>
                                        </optgroup>
                                    )}
                                    <optgroup label="Bancos del Sistema">
                                        {bancosDisponibles.map((b, idx) => {
                                            const bName = typeof b === 'string' ? b : (b.nombre || b.nombreBanco || b.banco || "Banco");
                                            const numCta = (b.numeroCuenta || b.numero) ? ` - N° ${b.numeroCuenta || b.numero}` : '';
                                            const fullVal = bName.startsWith("Banco:") ? bName : `${bName}${numCta}`;
                                            return (
                                                <option key={idx} value={fullVal}>
                                                    {fullVal}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                </select>
                                {!miCajaAbierta && (
                                    <p className="text-[11px] text-amber-600 font-medium mt-1.5 flex items-center gap-1">
                                        <span>ℹ️</span> No tienes una caja abierta actualmente. Selecciona un banco existente para generar el pago.
                                    </p>
                                )}
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
                                    <option value="">Seleccione medio de pago...</option>
                                    {mediosPagoList.map((mp, idx) => {
                                        const mpName = typeof mp === 'string' ? mp : (mp.nombre || mp.metodo || mp.label || "Medio");
                                        return (
                                            <option key={idx} value={mpName}>
                                                {mpName}
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
                                    {isSearchingTercero && terceroSearchQuery.trim().length > 0 && (
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

                        {/* Si el toggle está activo y hay facturas de compra */}
                        {pagoFacturasCompra && (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-700 mb-2">Facturas de compra pendientes del tercero</h4>
                                {facturasCompraPendientes.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No hay facturas de compra pendientes para este tercero.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {facturasCompraPendientes.map(fc => (
                                            <label key={fc.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={facturasSeleccionadas.includes(fc.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFacturasSeleccionadas(prev => [...prev, fc.id]);
                                                        } else {
                                                            setFacturasSeleccionadas(prev => prev.filter(id => id !== fc.id));
                                                        }
                                                    }}
                                                    className="rounded text-[#8dc63f] focus:ring-[#8dc63f]"
                                                />
                                                <span className="font-semibold">{fc.numero || `FC-${fc.id}`}</span> — <span>{fc.proveedor || fc.tercero}</span> — <span className="font-bold">{fmt(fc.total || fc.monto)}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 3: TABLA DE CONCEPTOS                               */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={handleAddConcepto}
                            className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                            + Nuevo concepto
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white">
                                    <th className="py-3 px-4 w-[28%]">Concepto</th>
                                    <th className="py-3 px-4 w-[32%]">Descripción</th>
                                    <th className="py-3 px-4 w-[16%]">Precio unitario</th>
                                    <th className="py-3 px-4 w-[10%]">Cantidad</th>
                                    <th className="py-3 px-4 w-[10%]">Total</th>
                                    <th className="py-3 px-4 w-[4%] text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="text"
                                                value={item.concepto}
                                                onChange={(e) => handleItemChange(item.id, "concepto", e.target.value)}
                                                placeholder="Ej. Insumos dentales"
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={(e) => handleItemChange(item.id, "descripcion", e.target.value)}
                                                placeholder="Detalle o justificación..."
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1000"
                                                value={item.precioUnitario || ""}
                                                onChange={(e) => handleItemChange(item.id, "precioUnitario", e.target.value)}
                                                placeholder="0"
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.cantidad || ""}
                                                onChange={(e) => handleItemChange(item.id, "cantidad", e.target.value)}
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4 font-bold text-slate-800">
                                            {fmt(item.total)}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveConcepto(item.id)}
                                                className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                                                title="Eliminar concepto"
                                            >
                                                <FiTrash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
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

            {/* MODAL CREAR NUEVO TERCERO */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <FiUserPlus className="text-[#8dc63f]" /> Registrar Nuevo Tercero / Proveedor
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="text-slate-400 hover:text-rose-500 p-1"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewTercero} className="p-6 space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-600 font-semibold mb-1">Nombre o Razón Social *</label>
                                <input
                                    type="text"
                                    required
                                    value={newTerceroData.nombre}
                                    onChange={(e) => setNewTerceroData({ ...newTerceroData, nombre: e.target.value })}
                                    placeholder="Ej. Distribuidora Dental del Norte S.A.S"
                                    className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Tipo Documento</label>
                                    <select
                                        value={newTerceroData.tipoDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, tipoDocumento: e.target.value })}
                                        className="w-full h-9 px-2 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="NIT">NIT</option>
                                        <option value="CC">Cédula de Ciudadanía (CC)</option>
                                        <option value="CE">Cédula de Extranjería (CE)</option>
                                        <option value="PP">Pasaporte</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Número Documento</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.nroDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, nroDocumento: e.target.value })}
                                        placeholder="900.123.456-7"
                                        className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Teléfono / Celular</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.telefono}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, telefono: e.target.value })}
                                        placeholder="300 123 4567"
                                        className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={newTerceroData.email}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, email: e.target.value })}
                                        placeholder="contacto@proveedor.com"
                                        className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Dirección</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.direccion}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, direccion: e.target.value })}
                                        placeholder="Calle 16 # 17-68"
                                        className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Ciudad</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.ciudad}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, ciudad: e.target.value })}
                                        placeholder="Sincelejo"
                                        className="w-full h-9 px-3 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-full font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTercero}
                                    className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full font-bold shadow transition-all disabled:opacity-50"
                                >
                                    {savingTercero ? "Guardando..." : "Guardar Tercero"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
