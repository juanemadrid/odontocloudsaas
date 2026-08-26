// src/modules/facturacion/facturascompra/FacturasCompraForm.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
    FiCalendar, FiPlus, FiTrash2, FiSave, FiAlertCircle, 
    FiCheckCircle, FiX, FiInfo, FiHome, FiArrowLeft, FiSearch, FiDollarSign
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { getConfigItems } from "../../../services/configPersistenceService";
import { isDoctorUser } from "../../../utils/doctorHelpers";
import { toast } from "sonner";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const RETENCIONES_CATALOGO = [
    { id: "retefuente_25", nombre: "ReteFuente 2.5% (Compras Generales)", porcentaje: 0.025 },
    { id: "retefuente_35", nombre: "ReteFuente 3.5% (Compras no declarantes)", porcentaje: 0.035 },
    { id: "retefuente_4", nombre: "ReteFuente 4% (Servicios)", porcentaje: 0.04 },
    { id: "retefuente_11", nombre: "ReteFuente 11% (Honorarios)", porcentaje: 0.11 },
    { id: "reteiva_15", nombre: "ReteIVA 15%", porcentaje: 0.15 },
    { id: "reteica_0966", nombre: "ReteICA 9.66 por mil", porcentaje: 0.00966 },
    { id: "reteica_1104", nombre: "ReteICA 11.04 por mil", porcentaje: 0.01104 }
];

export default function FacturasCompraForm({ onCancel, onSuccess }) {
    const { user, userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form fields - Card 1: Información empresa
    const pagadorEmail = userProfile?.email || user?.email || userProfile?.tenant?.email || "atmcentrodeldolor@gmail.com";
    const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
    const [profesionalId, setProfesionalId] = useState("");
    const [docSoporteDian, setDocSoporteDian] = useState(false);
    const [prefijo, setPrefijo] = useState("FC");
    const [nroFactura, setNroFactura] = useState("0");

    // Form fields - Card 2: Datos tercero
    const [terceroId, setTerceroId] = useState("");
    const [condicionPago, setCondicionPago] = useState("");
    const [medioPago, setMedioPago] = useState("");

    // Form fields - Card 3: Items / Conceptos
    const [items, setItems] = useState([
        {
            id: Date.now(),
            concepto: "",
            descripcion: "",
            precioUnitario: 0,
            cantidad: 1,
            descuento: 0,
            total: 0
        }
    ]);

    // Form fields - Card 4: Anticipos
    const [anticiposSeleccionados, setAnticiposSeleccionados] = useState([]);
    const [selectedAnticipoDoc, setSelectedAnticipoDoc] = useState("");
    const [anticiposDisponibles, setAnticiposDisponibles] = useState([]);

    // Form fields - Card 5: Retenciones
    const [retencionesSeleccionadas, setRetencionesSeleccionadas] = useState([]);
    const [selectedRetencionId, setSelectedRetencionId] = useState("");
    const [baseRetencion, setBaseRetencion] = useState("");

    // Form fields - Card 6: Observaciones
    const [observaciones, setObservaciones] = useState("");

    // Lookups & Buscador
    const [profesionales, setProfesionales] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [terceroSearchQuery, setTerceroSearchQuery] = useState("");
    const [isSearchingTercero, setIsSearchingTercero] = useState(false);
    const [selectedTerceroObj, setSelectedTerceroObj] = useState(null);
    const searchContainerRef = useRef(null);

    const [mediosPagoList, setMediosPagoList] = useState([]);
    const [condicionesPagoList, setCondicionesPagoList] = useState([]);

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

    // Cerrar búsqueda flotante al hacer clic afuera
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

                // Cargar Pacientes
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

                setTerceros([...tercerosList, ...pacientesList]);

                // 3. Cargar Profesionales / Doctores exclusivamente
                let profList = [];
                try {
                    const { data: pDb } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    if (pDb && pDb.length > 0) {
                        profList = pDb
                            .filter(p => isDoctorUser(p))
                            .map(p => ({
                                id: p.id,
                                nombre: p.full_name || p.nombre || "Doctor",
                                role: p.role
                            }));
                    }
                } catch (e) {}

                if (profList.length === 0) {
                    const cfgProfs = cfg.profesionales || cfg.doctores || [];
                    profList = cfgProfs
                        .filter(p => isDoctorUser(p))
                        .map(p => ({
                            id: p.id || p.uid || p.nombre,
                            nombre: p.nombre || p.nombreCompleto || "Doctor"
                        }));
                }
                setProfesionales(profList);

                // 4. Cargar Condiciones de Pago
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
                        { id: "credito_30", nombre: "Crédito 30 días", dias: 30 }
                    ];
                }
                setCondicionesPagoList(condList);
                if (condList.length > 0 && !condicionPago) {
                    setCondicionPago(typeof condList[0] === 'string' ? condList[0] : condList[0].nombre);
                }

                // 5. Cargar Medios de Pago
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

                // 6. Cargar Egresos / Anticipos disponibles para asociar
                try {
                    const { data: pList } = await supabase
                        .from("pagos_proveedor")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    if (pList && pList.length > 0) {
                        setAnticiposDisponibles(pList);
                    }
                } catch (e) {}

                // Calcular consecutivo sugerido
                try {
                    const { data: fcCount } = await supabase
                        .from("facturas_compra")
                        .select("id", { count: "exact" })
                        .eq("tenant_id", inquilino);
                    const nextNum = (fcCount?.length || 0) + 1;
                    setNroFactura(String(nextNum));
                } catch (e) {}

            } catch (err) {
                console.error("Error loading FacturasCompraForm data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [inquilino]);

    // Manejo de Conceptos
    const handleAddConcepto = () => {
        setItems(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                concepto: "",
                descripcion: "",
                precioUnitario: 0,
                cantidad: 1,
                descuento: 0,
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
                descuento: 0,
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
            const pu = field === "precioUnitario" ? (parseFloat(value) || 0) : (parseFloat(item.precioUnitario) || 0);
            const cant = field === "cantidad" ? (parseFloat(value) || 0) : (parseFloat(item.cantidad) || 0);
            const desc = field === "descuento" ? (parseFloat(value) || 0) : (parseFloat(item.descuento) || 0);
            
            const subtotal = pu * cant;
            updated.total = Math.max(0, subtotal - desc);
            return updated;
        }));
    };

    // Anticipos disponibles pertenecientes exclusivamente al Tercero seleccionado y SIN factura asociada previa
    const anticiposFiltradosPorTercero = useMemo(() => {
        if (!terceroId && !selectedTerceroObj && !terceroSearchQuery) return [];
        const tId = String(selectedTerceroObj?.id || terceroId || "");
        const tNom = String(selectedTerceroObj?.nombre || terceroSearchQuery || "").toLowerCase().trim();
        const tDoc = String(selectedTerceroObj?.documento || "").toLowerCase().trim();

        return anticiposDisponibles.filter(p => {
            const pTerceroId = String(p.terceroId || p.proveedorId || "");
            const pTerceroNom = String(p.tercero || p.proveedor || "").toLowerCase().trim();
            const pDoc = String(p.documentoTercero || p.documento || "").toLowerCase().trim();

            const matchTercero = 
                (tId && pTerceroId === tId) ||
                (tNom && pTerceroNom === tNom) ||
                (tDoc && pDoc && pDoc === tDoc) ||
                (pTerceroNom && tNom && (pTerceroNom.includes(tNom) || tNom.includes(pTerceroNom)));

            // Solo pagos que NO tengan ya factura asociada
            const tieneFactura = p.facturaCompraId || p.factura_compra_id || p.asociadoFactura || (p.facturasAsociadas && p.facturasAsociadas.length > 0);
            
            // Y que no esté ya añadido en anticiposSeleccionados
            const yaSeleccionado = anticiposSeleccionados.some(a => String(a.idOriginal) === String(p.id));

            return matchTercero && !tieneFactura && !yaSeleccionado;
        });
    }, [anticiposDisponibles, terceroId, selectedTerceroObj, terceroSearchQuery, anticiposSeleccionados]);

    // Manejo de Anticipos
    const handleAddAnticipo = () => {
        if (!selectedAnticipoDoc) {
            toast.error("Seleccione un documento de anticipo");
            return;
        }
        const docObj = anticiposDisponibles.find(a => String(a.id) === String(selectedAnticipoDoc) || String(a.consecutivo || a.nroPago) === String(selectedAnticipoDoc));
        if (!docObj) {
            toast.error("Documento de anticipo no encontrado");
            return;
        }
        const val = docObj.monto !== undefined ? docObj.monto : (docObj.total || 0);
        
        const newAnticipo = {
            id: Date.now(),
            idOriginal: docObj.id,
            documento: docObj.nroPago || docObj.consecutivo || docObj.id || selectedAnticipoDoc,
            valor: val,
            fecha: docObj.fecha
        };

        setAnticiposSeleccionados(prev => [...prev, newAnticipo]);
        setSelectedAnticipoDoc("");
        toast.success("Anticipo asociado correctamente ✅");
    };

    const handleRemoveAnticipo = (id) => {
        setAnticiposSeleccionados(prev => prev.filter(a => a.id !== id));
    };

    // Manejo de Retenciones
    const handleAddRetencion = () => {
        if (!selectedRetencionId) {
            toast.error("Seleccione una retención");
            return;
        }
        const retObj = RETENCIONES_CATALOGO.find(r => r.id === selectedRetencionId);
        const baseNum = parseFloat(baseRetencion) || totalConceptos;
        const valorRetencion = Math.round(baseNum * (retObj?.porcentaje || 0));

        const newRet = {
            id: Date.now(),
            retencionId: selectedRetencionId,
            nombre: retObj?.nombre || "Retención",
            base: baseNum,
            porcentaje: retObj?.porcentaje || 0,
            valor: valorRetencion
        };

        setRetencionesSeleccionadas(prev => [...prev, newRet]);
        setSelectedRetencionId("");
        setBaseRetencion("");
    };

    const handleRemoveRetencion = (id) => {
        setRetencionesSeleccionadas(prev => prev.filter(r => r.id !== id));
    };

    // Totales calculados
    const totalConceptos = useMemo(() => {
        return items.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
    }, [items]);

    const totalAnticipos = useMemo(() => {
        return anticiposSeleccionados.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0);
    }, [anticiposSeleccionados]);

    const totalRetenciones = useMemo(() => {
        return retencionesSeleccionadas.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
    }, [retencionesSeleccionadas]);

    const totalNetoPagar = useMemo(() => {
        return Math.max(0, totalConceptos - totalAnticipos - totalRetenciones);
    }, [totalConceptos, totalAnticipos, totalRetenciones]);

    // Filtrar Terceros / Pacientes en tiempo real
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

            try {
                await supabase.from("terceros").insert([nuevoTerceroObj]);
            } catch (e) {}

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

    // Guardar Factura de Compra
    const handleSaveFactura = async () => {
        if (!fecha) {
            toast.error("La fecha es requerida");
            return;
        }
        if (!docSoporteDian && (!nroFactura || nroFactura.trim() === "")) {
            toast.error("El número de factura es obligatorio");
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
        if (validItems.length === 0) {
            toast.error("Debe agregar al menos un concepto de compra");
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

            const docSoporteFormatted = docSoporteDian ? "Documento soporte" : "Factura de compra";
            const fullDocCode = docSoporteDian
                ? (prefijo ? `${prefijo}-DS-${Date.now().toString().slice(-4)}` : `DS-${Date.now().toString().slice(-4)}`)
                : (prefijo ? `${prefijo} - ${nroFactura}` : nroFactura);

            const facturaRecord = {
                id: `fc_${Date.now()}`,
                tenant_id: inquilino,
                pagadorEmail,
                fecha,
                profesionalId: selectedProf?.id || profesionalId,
                profesional: selectedProf?.nombre || profesionalId || "",
                docSoporteDian,
                tipoDoc: docSoporteFormatted,
                tipoDocumento: docSoporteFormatted,
                prefijo: docSoporteDian ? "DS" : prefijo,
                nroFactura: fullDocCode,
                documentoNumero: fullDocCode,
                terceroId: selectedTercero?.id || terceroId,
                tercero: selectedTercero?.nombre || terceroId || terceroSearchQuery,
                proveedor: selectedTercero?.nombre || terceroId || terceroSearchQuery,
                documentoTercero: selectedTercero?.documento || "",
                tipoTercero: selectedTercero?.tipo || "tercero",
                condicionPago,
                medioPago,
                items: validItems,
                anticipos: anticiposSeleccionados,
                retenciones: retencionesSeleccionadas,
                subtotal: totalConceptos,
                totalConceptos,
                totalAnticipos,
                totalRetenciones,
                total: totalConceptos,
                totalNeto: totalNetoPagar,
                monto: totalConceptos,
                saldoPendiente: totalNetoPagar,
                estado: totalNetoPagar === 0 ? "Pagada" : "Pendiente",
                observaciones,
                created_at: new Date().toISOString(),
                created_by: user?.id || userProfile?.uid
            };

            // 1. Guardar en tabla facturas_compra en Supabase
            try {
                await supabase.from("facturas_compra").insert([facturaRecord]);
            } catch (e) {
                console.warn("Table facturas_compra insert notice:", e);
            }

            // 2. Sincronizar en website_config
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();

                const currentCfg = cfgRow?.config || {};
                const currentFacturas = currentCfg.facturas_compra || [];
                currentCfg.facturas_compra = [facturaRecord, ...currentFacturas];

                await supabase
                    .from("website_config")
                    .upsert({ tenant_id: inquilino, config: currentCfg, updated_at: new Date().toISOString() });
            } catch (e) {
                console.warn("website_config facturas_compra sync notice:", e);
            }

            // 3. Vincular pagos de anticipos para marcarlos como asociados a esta factura
            for (const ant of anticiposSeleccionados) {
                if (ant.idOriginal) {
                    try {
                        await supabase
                            .from("pagos_proveedor")
                            .update({ 
                                facturaCompraId: facturaRecord.id,
                                facturaCompraDoc: facturaRecord.nroFactura,
                                asociadoFactura: true
                            })
                            .eq("id", ant.idOriginal);
                    } catch (e) {}
                }
            }

            toast.success("Factura de compra registrada exitosamente ✅");
            if (onSuccess) onSuccess(facturaRecord);
            else if (onCancel) onCancel();

        } catch (err) {
            console.error("Error saving factura de compra:", err);
            toast.error("Error al guardar la factura de compra");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[#f8fafc] text-slate-700 pb-20 animate-fadeIn font-sans">
            
            {/* Header & Breadcrumbs matching OralDrive */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
                <div className="max-w-[1300px] mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Nueva factura compra</h1>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <FiHome className="text-slate-400" size={13} />
                            <span>Facturación</span>
                            <span>›</span>
                            <span>Facturas de compra</span>
                            <span>›</span>
                            <span className="text-slate-700 font-semibold">Nueva factura compra</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-full text-xs font-semibold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSaveFactura}
                            disabled={saving}
                            className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <span>Guardar</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-6">
                
                {/* ========================================================= */}
                {/* CARD 1: INFORMACIÓN EMPRESA                               */}
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
                                    className="w-full max-w-md h-9 px-3 bg-slate-100/80 border border-slate-200 rounded text-xs text-slate-500 select-none cursor-not-allowed outline-none"
                                />
                            </div>
                        </div>

                        {/* Fecha */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Fecha <span className="text-rose-500">*</span>
                            </label>
                            <div className="md:col-span-9">
                                <div className="relative max-w-md">
                                    <input
                                        type="date"
                                        value={fecha}
                                        onChange={(e) => setFecha(e.target.value)}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    />
                                </div>
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

                        {/* Documento soporte dian */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div className="md:col-span-3 text-right flex items-center justify-end gap-1">
                                <span className="text-xs font-medium text-slate-600">Documento soporte dian</span>
                            </div>
                            <div className="md:col-span-9 flex items-center">
                                <button
                                    type="button"
                                    onClick={() => setDocSoporteDian(!docSoporteDian)}
                                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${docSoporteDian ? 'bg-[#8dc63f]' : 'bg-slate-200'}`}
                                >
                                    <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${docSoporteDian ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Prefijo y #Factura (Ocultos automáticamente si es Documento Soporte DIAN) */}
                        {docSoporteDian ? (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                <div className="md:col-start-4 md:col-span-9">
                                    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                                        <FiCheckCircle className="text-emerald-600 shrink-0" size={15} />
                                        <span>Documento Soporte Electrónico DIAN (Consecutivo asignado automáticamente al transmitir por API Factus)</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                <label className="md:col-span-3 text-right text-xs font-medium text-slate-600 flex items-center justify-end gap-1">
                                    Prefijo <span title="Prefijo de la factura (ej. FC, DS)" className="text-slate-400 cursor-help"><FiInfo size={12} /></span>
                                </label>
                                <div className="md:col-span-9 flex items-center gap-4">
                                    <input
                                        type="text"
                                        value={prefijo}
                                        onChange={(e) => setPrefijo(e.target.value)}
                                        placeholder="Prefijo..."
                                        className="w-24 h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                    />
                                    
                                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                        #Factura <span className="text-rose-500">*</span> <span title="Número consecutivo de la factura" className="text-slate-400 cursor-help"><FiInfo size={12} /></span>
                                    </label>
                                    <input
                                        type="text"
                                        value={nroFactura}
                                        onChange={(e) => setNroFactura(e.target.value)}
                                        placeholder="0"
                                        className="w-32 h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>
                        )}
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
                                Tercero <span className="text-rose-500">*</span>
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
                                    <option value="">Seleccione...</option>
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

                        {/* Medio de pago */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                                Medio de pago
                            </label>
                            <div className="md:col-span-9">
                                <select
                                    value={medioPago}
                                    onChange={(e) => setMedioPago(e.target.value)}
                                    className="w-full max-w-md h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Seleccione...</option>
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
                {/* CARD 3: TABLA DE CONCEPTOS                                */}
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
                                    <th className="py-3 px-4 w-[24%]">Concepto</th>
                                    <th className="py-3 px-4 w-[26%]">Descripción</th>
                                    <th className="py-3 px-4 w-[14%]">Precio unitario</th>
                                    <th className="py-3 px-4 w-[10%]">Cantidad</th>
                                    <th className="py-3 px-4 w-[12%]">Descuento</th>
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
                                                placeholder="Concepto..."
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={(e) => handleItemChange(item.id, "descripcion", e.target.value)}
                                                placeholder="Descripción..."
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
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none text-center"
                                            />
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1000"
                                                value={item.descuento || ""}
                                                onChange={(e) => handleItemChange(item.id, "descuento", e.target.value)}
                                                placeholder="0"
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
                                                className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                                title="Eliminar fila"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-2">
                        <div className="text-right">
                            <span className="text-xs font-semibold text-slate-500 mr-2">Total</span>
                            <span className="text-sm font-bold text-slate-900">{fmt(totalConceptos)}</span>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 4: ANTICIPOS                                         */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-slate-800">Anticipos</h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center max-w-2xl">
                        <label className="md:col-span-4 text-right text-xs font-medium text-slate-600">
                            Documento asociado
                        </label>
                        <div className="md:col-span-8 flex items-center gap-2">
                            <select
                                value={selectedAnticipoDoc}
                                onChange={(e) => setSelectedAnticipoDoc(e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                            >
                                <option value="">
                                    {anticiposFiltradosPorTercero.length === 0 
                                        ? (selectedTerceroObj || terceroSearchQuery ? "No hay pagos/anticipos sin factura para este tercero" : "Seleccione primero un tercero/paciente...") 
                                        : "Seleccione pago / anticipo..."}
                                </option>
                                {anticiposFiltradosPorTercero.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.nroPago || a.consecutivo || a.id} - {a.proveedor || a.tercero || "Egreso"} ({fmt(a.monto || a.total)}) {a.fecha ? `• Fecha: ${a.fecha}` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleAddAnticipo}
                                className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                                title="Asociar anticipo"
                            >
                                <FiPlus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Tabla de anticipos */}
                    <div className="overflow-x-auto border border-slate-100 rounded-lg max-w-2xl mt-3">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                                    <th className="py-2.5 px-4 w-[60%]">Documento asociado</th>
                                    <th className="py-2.5 px-4 w-[30%]">Valor</th>
                                    <th className="py-2.5 px-4 w-[10%] text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {anticiposSeleccionados.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="py-6 text-center text-slate-400 italic">
                                            No data
                                        </td>
                                    </tr>
                                ) : (
                                    anticiposSeleccionados.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-4 font-medium text-slate-800">{a.documento}</td>
                                            <td className="py-2 px-4 font-bold text-slate-700">{fmt(a.valor)}</td>
                                            <td className="py-2 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAnticipo(a.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-1"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CARD 5: RETENCIONES                                       */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-slate-800">Retenciones</h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center max-w-3xl">
                        <label className="md:col-span-3 text-right text-xs font-medium text-slate-600">
                            Retención
                        </label>
                        <div className="md:col-span-4">
                            <select
                                value={selectedRetencionId}
                                onChange={(e) => setSelectedRetencionId(e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                            >
                                <option value="">Seleccione...</option>
                                {RETENCIONES_CATALOGO.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="md:col-span-1 text-right text-xs font-medium text-slate-600 flex items-center justify-end gap-0.5">
                            Base <span className="text-rose-500">*</span> <span title="Base gravable sobre la cual se calcula la retención" className="text-slate-400 cursor-help"><FiInfo size={11} /></span>
                        </label>
                        <div className="md:col-span-3">
                            <input
                                type="number"
                                min="0"
                                value={baseRetencion}
                                onChange={(e) => setBaseRetencion(e.target.value)}
                                placeholder={totalConceptos > 0 ? String(totalConceptos) : "Base gravable"}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="md:col-span-1 flex items-center justify-start">
                            <button
                                type="button"
                                onClick={handleAddRetencion}
                                className="w-8 h-8 rounded bg-[#8dc63f] hover:bg-[#7cb035] text-white flex items-center justify-center transition-all shadow-xs shrink-0"
                                title="Agregar retención"
                            >
                                <FiPlus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Tabla de retenciones asociadas */}
                    {retencionesSeleccionadas.length > 0 && (
                        <div className="overflow-x-auto border border-slate-100 rounded-lg max-w-2xl mt-3">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                                        <th className="py-2.5 px-4 w-[45%]">Retención</th>
                                        <th className="py-2.5 px-4 w-[25%]">Base</th>
                                        <th className="py-2.5 px-4 w-[20%]">Valor</th>
                                        <th className="py-2.5 px-4 w-[10%] text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {retencionesSeleccionadas.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-4 font-medium text-slate-800">{r.nombre}</td>
                                            <td className="py-2 px-4 text-slate-600">{fmt(r.base)}</td>
                                            <td className="py-2 px-4 font-bold text-slate-900">{fmt(r.valor)}</td>
                                            <td className="py-2 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRetencion(r.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-1"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) }
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ========================================================= */}
                {/* CARD 6: OBSERVACIONES                                     */}
                {/* ========================================================= */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-800">Observaciones</h2>
                    <textarea
                        rows={4}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Comentarios adicionales sobre la factura de compra..."
                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y transition-all"
                    />
                </div>

                {/* Botón inferior Guardar */}
                <div className="flex items-center justify-end gap-3 pt-4">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSaveFactura}
                        disabled={saving}
                        className="px-8 py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>

            {/* Modal para Crear Tercero al Instante */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800">Registrar Nuevo Tercero</h3>
                            <button
                                onClick={() => setShowNewTerceroModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewTercero} className="p-6 space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-600 font-medium mb-1">Nombre o Razón Social *</label>
                                <input
                                    type="text"
                                    required
                                    value={newTerceroData.nombre}
                                    onChange={(e) => setNewTerceroData({ ...newTerceroData, nombre: e.target.value })}
                                    placeholder="Ej. Distribuidora Dental S.A.S."
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-600 font-medium mb-1">Tipo de Documento</label>
                                    <select
                                        value={newTerceroData.tipoDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, tipoDocumento: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                    >
                                        <option value="NIT">NIT</option>
                                        <option value="CC">Cédula de Ciudadanía</option>
                                        <option value="CE">Cédula de Extranjería</option>
                                        <option value="PP">Pasaporte</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-medium mb-1">Número de Documento</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.nroDocumento}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, nroDocumento: e.target.value })}
                                        placeholder="900.123.456-7"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-600 font-medium mb-1">Teléfono / Celular</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.telefono}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, telefono: e.target.value })}
                                        placeholder="300 123 4567"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-medium mb-1">Ciudad</label>
                                    <input
                                        type="text"
                                        value={newTerceroData.ciudad}
                                        onChange={(e) => setNewTerceroData({ ...newTerceroData, ciudad: e.target.value })}
                                        placeholder="Sincelejo"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-medium mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={newTerceroData.email}
                                    onChange={(e) => setNewTerceroData({ ...newTerceroData, email: e.target.value })}
                                    placeholder="contacto@proveedor.com"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-medium mb-1">Dirección</label>
                                <input
                                    type="text"
                                    value={newTerceroData.direccion}
                                    onChange={(e) => setNewTerceroData({ ...newTerceroData, direccion: e.target.value })}
                                    placeholder="Calle 25 # 18-30"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTercero}
                                    className="px-5 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
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
