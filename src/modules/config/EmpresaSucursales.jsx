// src/modules/config/EmpresaSucursales.jsx
// ============================================================
// 🏢 Gestión de Sucursales y Sedes - OdontoCloud
// Réplica exacta de los campos de OralDrive
// ============================================================
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 
    FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiMapPin, 
    FiCheckCircle, FiSave, FiPhoneCall, FiCheck, FiHelpCircle, FiUsers, FiBox
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

const CIUDADES_COLOMBIA = [
    "Abejorral", "Acacías", "Aguachica", "Agustín Codazzi", "Anapoima", "Andes", "Apartadó", "Aracataca", "Arauca", "Armenia",
    "Baranoa", "Barbosa", "Barrancabermeja", "Barranquilla", "Bello", "Bogotá D.C.", "Bucaramanga", "Buenaventura", "Buga",
    "Cajicá", "Calarcá", "Caldas", "Cali", "Candelaria", "Carepa", "Cartagena", "Cartago", "Caucasia", "Cereté", "Chía",
    "Chigorodó", "Chiquinquirá", "Ciénaga", "Cota", "Cúcuta", "Dosquebradas", "Duitama", "El Bagre", "El Carmen de Viboral",
    "Envigado", "Espinal", "Facatativá", "Florencia", "Floridablanca", "Fundación", "Funza", "Fusagasugá", "Garzón", "Girardot",
    "Girón", "Granada", "Honda", "Ibagué", "Ipiales", "Itagüí", "Jamundí", "La Ceja", "La Dorada", "La Estrella", "La Mesa",
    "Lorica", "Madrid", "Magangué", "Maicao", "Malambo", "Manizales", "Marinilla", "Medellín", "Melgar", "Mitú", "Montelíbano",
    "Montería", "Mosquera", "Neiva", "Ocaña", "Paipa", "Palmira", "Pamplona", "Pasto", "Pereira", "Pitalito", "Planeta Rica",
    "Plato", "Popayán", "Puerto Asís", "Puerto Berrío", "Puerto Boyacá", "Puerto Carreño", "Puerto Colombia", "Quibdó",
    "Riohacha", "Rionegro", "Sabanalarga", "Sabaneta", "Sahagún", "San Andrés", "San Gil", "Santa Marta", "Santa Rosa de Cabal",
    "Santander de Quilichao", "Saravena", "Sevilla", "Sibaté", "Sincelejo", "Soacha", "Socorro", "Sogamoso", "Soledad", "Sonsón",
    "Sopó", "Tibú", "Tierralta", "Tuluá", "Tumaco", "Tunja", "Turbaco", "Turbo", "Valledupar", "Villa del Rosario", "Villavicencio",
    "Villeta", "Yopal", "Yumbo", "Zipaquirá"
].sort();

// Componente Seleccionar / Autocompletado Elegante de Ciudades
function CitySelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value || "");

    useEffect(() => {
        setQuery(value || "");
    }, [value]);

    const filtered = CIUDADES_COLOMBIA.filter(c =>
        c.toLowerCase().includes((query || "").toLowerCase())
    );

    return (
        <div className="relative">
            <div className="relative flex items-center">
                <FiMapPin className="absolute left-3 text-slate-400" size={15} />
                <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                    placeholder="Seleccione o busque la ciudad..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                />
            </div>

            {open && (
                <div className="absolute left-0 right-0 top-11 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5 animate-fade-in">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-semibold text-slate-500">
                            Usar ciudad personalizada: "<span className="text-blue-600 font-bold">{query}</span>"
                        </div>
                    ) : (
                        filtered.map((c) => (
                            <div
                                key={c}
                                onMouseDown={() => {
                                    setQuery(c);
                                    onChange(c);
                                    setOpen(false);
                                }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between ${
                                    value === c ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span>{c}</span>
                                {value === c && <FiCheck className="text-blue-600" size={14} />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// Selector Dual de Almacenes (Dual Listbox)
function AlmacenesDualList({ available = [], selected = [], onChange }) {
    const [leftSelected, setLeftSelected] = useState([]);
    const [rightSelected, setRightSelected] = useState([]);

    // Map selected (array of strings or IDs) to items
    const selectedItems = (selected || []).map(s => {
        const match = available.find(a => 
            a.nombre === s || 
            String(a.id) === String(s) || 
            a.nombre?.toLowerCase() === String(s)?.toLowerCase()
        );
        return {
            id: match ? (match.id || match.nombre) : s,
            nombre: match ? match.nombre : s
        };
    });

    // Available items are those in `available` that are NOT in `selected`
    const availableItems = available.filter(a => {
        const itemVal = a.nombre || a.id;
        return !(selected || []).some(s => 
            s === itemVal || 
            String(s) === String(a.id) || 
            s === a.nombre || 
            String(s)?.toLowerCase() === itemVal?.toLowerCase()
        );
    });

    const moveRight = () => {
        if (leftSelected.length === 0) return;
        const newSelected = [...new Set([...(selected || []), ...leftSelected])];
        onChange(newSelected);
        setLeftSelected([]);
    };

    const moveAllRight = () => {
        const allAvailable = availableItems.map(a => a.nombre || a.id);
        const newSelected = [...new Set([...(selected || []), ...allAvailable])];
        onChange(newSelected);
        setLeftSelected([]);
    };

    const moveLeft = () => {
        if (rightSelected.length === 0) return;
        const newSelected = (selected || []).filter(s => !rightSelected.includes(s));
        onChange(newSelected);
        setRightSelected([]);
    };

    const moveAllLeft = () => {
        onChange([]);
        setRightSelected([]);
    };

    return (
        <div className="space-y-1.5 md:col-span-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FiBox className="text-blue-600" size={14} />
                <span>Almacenes *</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_45px_1fr] gap-3 items-center pt-1">
                {/* Almacenes disponibles */}
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Almacenes disponibles</span>
                    <select
                        multiple
                        className="w-full h-36 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 custom-scrollbar shadow-inner"
                        value={leftSelected}
                        onChange={(e) => setLeftSelected(Array.from(e.target.selectedOptions, o => o.value))}
                    >
                        {availableItems.map(item => (
                            <option key={item.id || item.nombre} value={item.nombre || item.id} className="p-1.5 rounded hover:bg-blue-50">
                                {item.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Botones de transferencia */}
                <div className="flex md:flex-col justify-center items-center gap-1.5">
                    <button
                        type="button"
                        onClick={moveRight}
                        className="w-9 h-8 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-black transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs"
                        title="Mover seleccionado a la derecha"
                    >
                        &gt;
                    </button>
                    <button
                        type="button"
                        onClick={moveAllRight}
                        className="w-9 h-8 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-black transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs"
                        title="Mover todos a la derecha"
                    >
                        &gt;&gt;
                    </button>
                    <button
                        type="button"
                        onClick={moveLeft}
                        className="w-9 h-8 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-black transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs"
                        title="Mover seleccionado a la izquierda"
                    >
                        &lt;
                    </button>
                    <button
                        type="button"
                        onClick={moveAllLeft}
                        className="w-9 h-8 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-black transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs"
                        title="Mover todos a la izquierda"
                    >
                        &lt;&lt;
                    </button>
                </div>

                {/* Almacenes seleccionados */}
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Almacenes seleccionados</span>
                    <select
                        multiple
                        className="w-full h-36 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 custom-scrollbar shadow-inner"
                        value={rightSelected}
                        onChange={(e) => setRightSelected(Array.from(e.target.selectedOptions, o => o.value))}
                    >
                        {selectedItems.map(item => (
                            <option key={item.id || item.nombre} value={item.nombre || item.id} className="p-1.5 rounded hover:bg-blue-50">
                                {item.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

const isGuid = (val) => typeof val === 'string' && /^[0-9a-f-]{15,}$/i.test(val);

// Editor Component for Sucursal
function SucursalEditor({ item, onBack, inquilino, initialConsecutivos = [], initialListasPrecios = [], initialAlmacenes = [] }) {
    const toast = useToast();
    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        ciudad: item?.ciudad || "",
        direccion: item?.direccion || "",
        codigoPostal: item?.codigoPostal || "",
        email: item?.email || "",
        telefono: item?.telefono || "",
        celular: item?.celular || "",
        consecutivoId: item?.consecutivoId || "",
        listaPrecioId: item?.listaPrecioId || "",
        almacenes: item?.almacenes || ["Principal"],
        mostrarPie: item?.mostrarPie ?? false,
        piePersonalizado: item?.piePersonalizado || "",
        codigoPrestador: item?.codigoPrestador || "",
        entidadExtranjeras: item?.entidadExtranjeras || "",
        entidadNacionales: item?.entidadNacionales || "",
        centroCostos: item?.centroCostos || "",
        usuarioSoporte: item?.usuarioSoporte || "Ninguno",
        codigoPrestadorPropio: item?.codigoPrestadorPropio ?? false,
        codigoPrestadorDetalle: item?.codigoPrestadorDetalle || "",
    });

    const [consecutivos, setConsecutivos] = useState(initialConsecutivos);
    const [listasPrecios, setListasPrecios] = useState(initialListasPrecios);
    const [availableAlmacenes, setAvailableAlmacenes] = useState(
        initialAlmacenes.length > 0 
            ? initialAlmacenes 
            : (item?.almacenes?.length > 0 ? item.almacenes.map(a => ({ id: a, nombre: a })) : [{ id: "principal", nombre: "Principal" }])
    );
    const [usuarios, setUsuarios] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Instant combined options so saved values render cleanly with zero raw GUID display
    const combinedConsecutivos = React.useMemo(() => {
        const list = [...consecutivos];
        if (form.consecutivoId) {
            const exists = list.some(c => String(c.id) === String(form.consecutivoId) || c.nombre === form.consecutivoId);
            if (!exists) {
                const displayName = isGuid(form.consecutivoId) ? "Cargando consecutivo..." : form.consecutivoId;
                list.unshift({ id: form.consecutivoId, nombre: displayName });
            }
        }
        return list;
    }, [consecutivos, form.consecutivoId]);

    const combinedListasPrecios = React.useMemo(() => {
        const list = [...listasPrecios];
        if (form.listaPrecioId) {
            const exists = list.some(l => String(l.id) === String(form.listaPrecioId) || l.nombre === form.listaPrecioId);
            if (!exists) {
                const displayName = isGuid(form.listaPrecioId) ? "Cargando lista de precios..." : form.listaPrecioId;
                list.unshift({ id: form.listaPrecioId, nombre: displayName });
            }
        }
        return list;
    }, [listasPrecios, form.listaPrecioId]);

    useEffect(() => {
        if (!inquilino) return;

        // Fetch Consecutivos independently for fast response
        getConfigItems(inquilino, "consecutivos", "consecutivos")
            .then(cData => {
                if (Array.isArray(cData) && cData.length > 0) setConsecutivos(cData);
            })
            .catch(e => console.error("Error cargando consecutivos:", e));

        // Fetch Listas Precios independently
        getConfigItems(inquilino, "listas_precios", "listas_precios")
            .then(lData => {
                if (Array.isArray(lData) && lData.length > 0) setListasPrecios(lData);
            })
            .catch(e => console.error("Error cargando listas precios:", e));

        // Fetch Almacenes independently
        getConfigItems(inquilino, "almacenes", "almacenes")
            .then(aData => {
                if (Array.isArray(aData) && aData.length > 0) {
                    setAvailableAlmacenes(aData);
                } else if (item?.almacenes?.length > 0) {
                    setAvailableAlmacenes(item.almacenes.map(a => ({ id: a, nombre: a })));
                } else {
                    setAvailableAlmacenes([{ id: "principal", nombre: "Principal" }]);
                }
            })
            .catch(e => console.error("Error cargando almacenes:", e));

        // Fetch Usuarios in background
        Promise.all([
            supabase.from("profiles").select("*").eq("tenant_id", inquilino),
            getConfigItems(inquilino, "usuarios", "usuarios")
        ]).then(([uProfRes, uConfigData]) => {
            const userMap = new Map();
            (uProfRes.data || []).forEach(u => {
                const name = u.full_name || u.nombreCompleto || `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email;
                if (name) userMap.set(u.id || u.email, name);
            });
            (uConfigData || []).forEach(u => {
                const name = u.nombreCompleto || u.displayName || `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email;
                if (name) userMap.set(u.id || u.email, name);
            });

            const userList = Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
            setUsuarios(userList);
        }).catch(e => console.error("Error cargando usuarios:", e));

    }, [inquilino, item]);

    const handleChange = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) {
            if (toast?.error) toast.error("El nombre de la sede es obligatorio");
            else alert("El nombre es obligatorio");
            return;
        }

        setIsSaving(true);
        try {
            await saveConfigItem(inquilino, "sucursales", "sucursales", {
                ...form,
                ...(item?.id ? { id: item.id } : {})
            });

            window.dispatchEvent(new CustomEvent("sedes-updated"));

            if (toast?.success) toast.success(item?.id ? "Sucursal actualizada correctamente" : "Sucursal creada correctamente");
            onBack();
        } catch (e) {
            console.error("Error guardando sucursal:", e);
            if (toast?.error) toast.error("Error al guardar: " + e.message);
            else alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md max-w-4xl mx-auto overflow-hidden animate-fade-in mb-12">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-[16px] font-black text-slate-800 uppercase">
                            {item ? "Editar Sucursal" : "Nueva Sucursal"}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">Gestión de sede física y contacto de la clínica</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} autoComplete="off" className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Nombre de la Sede */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Nombre de la Sede *</label>
                        <input
                            required
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.nombre}
                            onChange={e => handleChange("nombre", e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Ciudad */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Ciudad *</label>
                        <CitySelect
                            value={form.ciudad}
                            onChange={val => handleChange("ciudad", val)}
                        />
                    </div>

                    {/* Teléfono Fijo */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Teléfono Fijo</label>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.telefono}
                            onChange={e => handleChange("telefono", e.target.value)}
                        />
                    </div>

                    {/* Celular */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Celular</label>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.celular}
                            onChange={e => handleChange("celular", e.target.value)}
                        />
                    </div>

                    {/* Dirección Exacta */}
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Dirección *</label>
                        <input
                            autoComplete="off"
                            required
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.direccion}
                            onChange={e => handleChange("direccion", e.target.value)}
                        />
                    </div>

                    {/* Código postal */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Código postal</label>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.codigoPostal}
                            onChange={e => handleChange("codigoPostal", e.target.value)}
                        />
                    </div>

                    {/* Correo Electrónico */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Correo electrónico *</label>
                        <input
                            type="email"
                            required
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.email}
                            onChange={e => handleChange("email", e.target.value)}
                        />
                    </div>

                    {/* Consecutivo */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Consecutivo *</label>
                        <select
                            value={
                                combinedConsecutivos.find(c => String(c.id) === String(form.consecutivoId) || c.nombre === form.consecutivoId)?.id ||
                                combinedConsecutivos.find(c => String(c.id) === String(form.consecutivoId) || c.nombre === form.consecutivoId)?.nombre ||
                                form.consecutivoId
                            }
                            onChange={e => handleChange("consecutivoId", e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="">Seleccione consecutivo...</option>
                            {combinedConsecutivos.map(c => (
                                <option key={c.id || c.nombre} value={c.id || c.nombre}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Lista de precios */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Lista de precios *</label>
                        <select
                            value={
                                combinedListasPrecios.find(l => String(l.id) === String(form.listaPrecioId) || l.nombre === form.listaPrecioId)?.id ||
                                combinedListasPrecios.find(l => String(l.id) === String(form.listaPrecioId) || l.nombre === form.listaPrecioId)?.nombre ||
                                form.listaPrecioId
                            }
                            onChange={e => handleChange("listaPrecioId", e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="">Seleccione lista de precios...</option>
                            {combinedListasPrecios.map(l => (
                                <option key={l.id || l.nombre} value={l.id || l.nombre}>{l.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Dual Listbox: Almacenes */}
                    <AlmacenesDualList
                        available={availableAlmacenes}
                        selected={form.almacenes}
                        onChange={(newSel) => handleChange("almacenes", newSel)}
                    />

                    {/* Toggle: Datos de sucursal en pie de página */}
                    <div className="md:col-span-2 py-3 px-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">Datos de sucursal en pie de pág. doc. clínicos</span>
                            <FiHelpCircle className="text-slate-400 cursor-help" size={14} title="Imprime el pie de página de la sucursal en documentos clínicos" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={form.mostrarPie}
                                onChange={(e) => handleChange("mostrarPie", e.target.checked)}
                            />
                            <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>

                    {form.mostrarPie && (
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[11px] font-bold text-slate-600">Pie de página personalizado</label>
                            <textarea
                                rows={2}
                                value={form.piePersonalizado}
                                onChange={e => handleChange("piePersonalizado", e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    )}

                    {/* Código del prestador de servicio */}
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Código del prestador de servicio</label>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.codigoPrestador}
                            onChange={e => handleChange("codigoPrestador", e.target.value)}
                        />
                    </div>

                    {/* Entidad Administradora extranjeras */}
                    <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center gap-1">
                            <label className="text-[11px] font-bold text-slate-600">Entidad Administradora extranjeras</label>
                            <FiHelpCircle className="text-slate-400 cursor-help" size={13} title="Código o datos de entidad extranjera prestadora" />
                        </div>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.entidadExtranjeras}
                            onChange={e => handleChange("entidadExtranjeras", e.target.value)}
                        />
                    </div>

                    {/* Entidad Administradora Nacionales */}
                    <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center gap-1">
                            <label className="text-[11px] font-bold text-slate-600">Entidad Administradora Nacionales</label>
                            <FiHelpCircle className="text-slate-400 cursor-help" size={13} title="Código o datos de entidad nacional prestadora" />
                        </div>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.entidadNacionales}
                            onChange={e => handleChange("entidadNacionales", e.target.value)}
                        />
                    </div>

                    {/* Centro de costos */}
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Centro de costos</label>
                        <input
                            autoComplete="off"
                            className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.centroCostos}
                            onChange={e => handleChange("centroCostos", e.target.value)}
                        />
                    </div>

                    {/* Usuario para soporte */}
                    <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center gap-1">
                            <label className="text-[11px] font-bold text-slate-600">Usuario para soporte</label>
                            <FiHelpCircle className="text-slate-400 cursor-help" size={13} title="Usuario asignado para soporte de esta sucursal" />
                        </div>
                        <select
                            value={form.usuarioSoporte}
                            onChange={e => handleChange("usuarioSoporte", e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="Ninguno">Ninguno</option>
                            {usuarios.map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Toggle: Código de prestador propio */}
                    <div className="md:col-span-2 py-3 px-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-700">Código de prestador propio</span>
                            <FiHelpCircle className="text-slate-400 cursor-help" size={14} title="Habilita un código de prestador específico para esta sucursal" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={form.codigoPrestadorPropio}
                                onChange={(e) => handleChange("codigoPrestadorPropio", e.target.checked)}
                            />
                            <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>

                    {/* Campo condicional: Código de prestador */}
                    {form.codigoPrestadorPropio && (
                        <div className="space-y-1 md:col-span-2 animate-fadeIn">
                            <div className="flex items-center gap-1">
                                <label className="text-[11px] font-bold text-slate-600">Código de prestador</label>
                                <FiHelpCircle className="text-slate-400 cursor-help" size={13} title="Ingrese el código de prestador específico para esta sucursal" />
                            </div>
                            <input
                                type="text"
                                autoComplete="off"
                                className="w-full h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                value={form.codigoPrestadorDetalle}
                                onChange={e => handleChange("codigoPrestadorDetalle", e.target.value)}
                            />
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={16} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar Sucursal"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

// MAIN SUCURSALES COMPONENT
export default function EmpresaSucursales() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    // View: 'list' or 'editor'
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);

    // Preloaded config dependencies for instant dropdown population
    const [preloadedConsecutivos, setPreloadedConsecutivos] = useState([]);
    const [preloadedListasPrecios, setPreloadedListasPrecios] = useState([]);
    const [preloadedAlmacenes, setPreloadedAlmacenes] = useState([]);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const [data, cData, lData, aData] = await Promise.all([
                getConfigItems(inquilino, "sucursales", "sucursales"),
                getConfigItems(inquilino, "consecutivos", "consecutivos"),
                getConfigItems(inquilino, "listas_precios", "listas_precios"),
                getConfigItems(inquilino, "almacenes", "almacenes")
            ]);
            const sorted = (data || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setRows(sorted);
            if (Array.isArray(cData)) setPreloadedConsecutivos(cData);
            if (Array.isArray(lData)) setPreloadedListasPrecios(lData);
            if (Array.isArray(aData)) setPreloadedAlmacenes(aData);
        } catch (error) {
            console.error("Error fetching sucursales:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [inquilino]);

    useEffect(() => {
        if ((location.state?.editSucursalId || location.state?.editSucursalName) && rows.length > 0) {
            const match = rows.find(r => 
                String(r.id) === String(location.state.editSucursalId) || 
                (r.nombre && r.nombre === location.state.editSucursalName)
            );
            if (match) {
                setEditingItem(match);
                setView("editor");
            }
        }
    }, [location.state, rows]);

    const openNew = () => {
        setEditingItem(null);
        setView("editor");
    };

    const openEdit = (row) => {
        setEditingItem(row);
        setView("editor");
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar la sucursal "${row.nombre}"?`)) return;

        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "sucursales", "sucursales", row.id);
            setRows(prev => prev.filter(r => String(r.id) !== String(row.id)));
            window.dispatchEvent(new CustomEvent("sedes-updated"));
            if (toast?.success) toast.success("Sucursal eliminada correctamente");
            else alert("✅ Sucursal eliminada correctamente");
        } catch (e) {
            console.error("Error al eliminar sucursal:", e);
            alert("❌ Error al eliminar sucursal: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (view === "editor") {
        return (
            <SucursalEditor
                item={editingItem}
                onBack={() => { setView("list"); fetchData(); }}
                inquilino={inquilino}
                initialConsecutivos={preloadedConsecutivos}
                initialListasPrecios={preloadedListasPrecios}
                initialAlmacenes={preloadedAlmacenes}
            />
        );
    }

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.ciudad || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Header Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiMapPin size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Sucursales y Sedes</h1>
                        <p className="text-xs font-medium text-slate-500">Gestión de sedes físicas y contacto de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar sede..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={openNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Sucursal</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Sede / Clínica</th>
                            <th className="py-3 px-4">Ciudad</th>
                            <th className="py-3 px-4">Dirección</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando sucursales...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No hay sucursales registradas
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                <FiMapPin size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800 uppercase">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-700">{row.ciudad}</td>
                                    <td className="py-3 px-4 font-medium text-slate-500">{row.direccion || "-"}</td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => openEdit(row)}
                                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Editar"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Eliminar"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
