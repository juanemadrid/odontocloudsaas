// src/modules/config/EmpresaPlanes.jsx
import React, { useState, useEffect, useMemo } from "react";
import { 
    FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiSave, FiDollarSign, 
    FiFileText, FiCheck, FiX, FiPackage, FiLayers, FiList, FiAlertCircle, FiCheckSquare, FiSquare
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";
import { CUPS_DENTAL_CODES } from "../../data/cupsCodes";

const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
        return new Date(isoString).toLocaleString("es-CO");
    } catch (e) {
        return isoString;
    }
};

export default function EmpresaPlanes() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    // View mode: 'list' | 'editor'
    const [view, setView] = useState("list");
    const [selectedPlan, setSelectedPlan] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [listas, setListas] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal state for creating new plan
    const [showNewModal, setShowNewModal] = useState(false);
    const [planName, setPlanName] = useState("");
    const [planListId, setPlanListId] = useState("");

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const [pData, lRes] = await Promise.all([
                getConfigItems(inquilino, "planes", null),
                getConfigItems(inquilino, "listas_precios", "listas_precios")
            ]);

            setRows((pData || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            setListas(lRes || []);
        } catch (error) {
            console.error("Error fetching planes:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchData(); 
    }, [inquilino]);

    const handleCreatePlan = async () => {
        if (!planName.trim()) {
            toast?.error ? toast.error("El nombre del plan es obligatorio.") : alert("El nombre del plan es obligatorio.");
            return;
        }
        if (!inquilino) return alert("No se identificó la clínica activa.");

        setLoading(true);
        try {
            const listaObj = listas.find(l => l.id === planListId);
            const newPlan = {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                nombre: planName.trim().toUpperCase(),
                listaId: planListId || "",
                listaNombre: listaObj?.nombre || "",
                items: [],
                actualizado: new Date().toISOString()
            };

            await saveConfigItem(inquilino, "planes", null, newPlan);

            if (toast?.success) toast.success("Plan creado. Ahora puedes agregar los servicios.");
            setShowNewModal(false);
            setPlanName("");
            setPlanListId("");
            fetchData();

            // Abrir directamente el editor del plan recién creado
            setSelectedPlan(newPlan);
            setView("editor");
        } catch (e) {
            console.error(e);
            alert("Error al guardar plan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar el plan "${row.nombre}"?`)) return;
        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "planes", null, row.id);
            setRows(prev => prev.filter(r => r.id !== row.id));
            if (toast?.success) toast.success("Plan eliminado correctamente");
            else alert("✅ Plan eliminado correctamente");
        } catch (e) {
            console.error("Error al eliminar plan:", e);
            alert("❌ Error al eliminar plan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const openEditor = (plan) => {
        setSelectedPlan(plan);
        setView("editor");
    };

    const closeEditor = () => {
        setView("list");
        setSelectedPlan(null);
        fetchData();
    };

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ==========================================
    // RENDER: EDITOR DE PRODUCTOS/SERVICIOS DEL PLAN
    // ==========================================
    if (view === "editor" && selectedPlan) {
        return (
            <PlanPriceListEditor 
                plan={selectedPlan} 
                listas={listas} 
                inquilino={inquilino} 
                onBack={closeEditor} 
            />
        );
    }

    // ==========================================
    // RENDER: LISTA DE PLANES
    // ==========================================
    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                        <FiPackage size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Planes de Venta y Paquetes</h1>
                        <p className="text-xs font-medium text-slate-500">Configuración de paquetes y combos para presupuestos y planes de tratamiento</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar plan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => {
                            setPlanName("");
                            setPlanListId("");
                            setShowNewModal(true);
                        }}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0 active:scale-95"
                    >
                        <FiPlus size={16} strokeWidth={3} />
                        <span>Nuevo Plan</span>
                    </button>
                </div>
            </div>

            {/* Tabla de Planes */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre del Plan</th>
                            <th className="py-3 px-4">Lista de Precios Base</th>
                            <th className="py-3 px-4 text-center">Servicios / Ítems</th>
                            <th className="py-3 px-4">Última Modificación</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando planes...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    No hay planes registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                <FiPackage size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800 uppercase">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-slate-600">
                                        {row.listaNombre || "Sin lista vinculada"}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 font-mono">
                                            {(row.items || []).length} ítems
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-slate-500">
                                        {formatDate(row.actualizado || row.created_at)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => openEditor(row)}
                                                className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                title="Configurar Servicios del Plan"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 flex items-center justify-center transition-all shadow-xs cursor-pointer border-0"
                                                title="Eliminar Plan"
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

            {/* Modal de Creación */}
            {showNewModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-scaleIn">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    <FiPackage size={18} />
                                </div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Nuevo Plan de Venta
                                </h3>
                            </div>
                            <button onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold hover:bg-rose-100 hover:text-rose-600 transition-colors">&times;</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nombre del Plan *</label>
                                <input
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                                    value={planName}
                                    onChange={e => setPlanName(e.target.value)}
                                    placeholder="Ej. PLAN COLECTIVO 2026, COMBO ORTODONCIA..."
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lista de Precios Base</label>
                                <select
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                                    value={planListId}
                                    onChange={e => setPlanListId(e.target.value)}
                                >
                                    <option value="">Seleccione lista de precio...</option>
                                    {listas.map(l => (
                                        <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowNewModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreatePlan}
                                    className="px-5 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 border-0 active:scale-95"
                                >
                                    <FiSave size={15} strokeWidth={2.5} />
                                    <span>Continuar & Agregar Servicios</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==============================================================================
// COMPONENTE: EDITOR DE PRODUCTOS Y SERVICIOS DEL PLAN (ESTILO PREMIUM ODONTOCLOUD)
// ==============================================================================
function PlanPriceListEditor({ plan, listas, inquilino, onBack }) {
    const toast = useToast();
    const [currentPlan, setCurrentPlan] = useState(plan);
    const [planName, setPlanName] = useState(plan.nombre || "PLAN");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [selectedListId, setSelectedListId] = useState(plan.listaId || "");
    const [items, setItems] = useState(plan.items || []);
    const [saving, setSaving] = useState(false);

    // Modal para agregar productos
    const [showAddModal, setShowAddModal] = useState(false);

    // Guardar cambios en el plan
    const handleSavePlan = async (itemsToSave = items, titleToSave = planName, listIdToSave = selectedListId) => {
        if (!inquilino) return;
        setSaving(true);
        try {
            const listaObj = listas.find(l => l.id === listIdToSave);
            const updatedPlan = {
                ...currentPlan,
                nombre: (titleToSave || currentPlan.nombre || "PLAN").trim().toUpperCase(),
                listaId: listIdToSave || "",
                listaNombre: listaObj?.nombre || "",
                items: itemsToSave,
                actualizado: new Date().toISOString()
            };

            await saveConfigItem(inquilino, "planes", null, updatedPlan);
            setCurrentPlan(updatedPlan);
            if (toast?.success) toast.success("Plan guardado correctamente");
        } catch (e) {
            console.error("Error al guardar plan:", e);
            if (toast?.error) toast.error("Error al guardar cambios: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateItemField = (itemId, field, value) => {
        const nextItems = items.map(it => {
            if (it.id === itemId) {
                const updated = { ...it, [field]: value };
                const unitVal = Number(updated.valor_unit !== undefined ? updated.valor_unit : updated.precio || 0);
                const qtyVal = Number(updated.cantidad !== undefined ? updated.cantidad : updated.qty || 1);
                const descVal = Number(updated.descuento || 0);
                updated.total = Math.max(0, (unitVal * qtyVal) - descVal);
                return updated;
            }
            return it;
        });
        setItems(nextItems);
    };

    const handleRemoveItem = (itemId) => {
        const nextItems = items.filter(it => it.id !== itemId);
        setItems(nextItems);
    };

    const handleAddProducts = (newProducts) => {
        const mapped = newProducts.map(p => {
            const unitPrice = Number(p.precio || p.amount || p.valor_unit || 0);
            const qty = Number(p.cantidad || p.qty || 1);
            const desc = Number(p.descuento || 0);
            return {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                codigo: p.codigo || p.code || "",
                nombre: p.nombre || p.desc || "Servicio",
                valor_unit: unitPrice,
                precio: unitPrice,
                cantidad: qty,
                qty: qty,
                descuento: desc,
                observaciones: p.observaciones || p.line_obs || "",
                total: Math.max(0, (unitPrice * qty) - desc),
                permite_descuento: p.permite_descuento !== undefined ? p.permite_descuento : true,
                max_desc: p.max_desc !== undefined ? p.max_desc : 100
            };
        });

        const nextItems = [...items, ...mapped];
        setItems(nextItems);
        setShowAddModal(false);
        if (toast?.success) toast.success(`${mapped.length} producto(s) agregado(s) al plan`);
    };

    const totalPlan = items.reduce((acc, it) => {
        const unitVal = Number(it.valor_unit !== undefined ? it.valor_unit : it.precio || 0);
        const qtyVal = Number(it.cantidad !== undefined ? it.cantidad : it.qty || 1);
        const descVal = Number(it.descuento || 0);
        return acc + Math.max(0, (unitVal * qtyVal) - descVal);
    }, 0);

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto animate-fadeIn">
            {/* Top Toolbar Card */}
            <div className="bg-white rounded-2xl p-4 md:px-6 md:py-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Side: Back button + Title */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all border border-slate-200 cursor-pointer shrink-0 group"
                        title="Volver a planes"
                    >
                        <FiArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsEditingTitle(true)}
                            className="w-10 h-10 rounded-xl bg-sky-50 text-sky-500 hover:bg-sky-100 hover:text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95 shadow-sm"
                            title="Editar nombre del plan"
                        >
                            <FiEdit2 size={18} />
                        </button>
                        
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block leading-none mb-1">
                                Plan de Tratamiento / Paquete
                            </span>
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={planName}
                                        onChange={e => setPlanName(e.target.value)}
                                        className="text-base md:text-lg font-black text-slate-800 border-b-2 border-indigo-500 outline-none uppercase bg-transparent px-1"
                                        autoFocus
                                        onBlur={() => setIsEditingTitle(false)}
                                        onKeyDown={e => { if (e.key === "Enter") setIsEditingTitle(false); }}
                                    />
                                    <button onClick={() => setIsEditingTitle(false)} className="text-emerald-600 p-1" title="Confirmar">
                                        <FiCheck size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                                    <h1 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase">
                                        {planName}
                                    </h1>
                                    <FiEdit2 size={12} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Tarifario Selector + Action Buttons */}
                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tarifario:</span>
                        <select
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            value={selectedListId}
                            onChange={(e) => setSelectedListId(e.target.value)}
                        >
                            <option value="">Seleccionar Tarifario...</option>
                            {listas.map(l => (
                                <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0 active:scale-95 whitespace-nowrap"
                    >
                        <FiPlus size={15} strokeWidth={3} />
                        <span>Agregar Servicios</span>
                    </button>

                    <button
                        onClick={() => handleSavePlan()}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer border-0 whitespace-nowrap"
                    >
                        <FiSave size={15} />
                        <span>{saving ? "Guardando..." : "Guardar Plan"}</span>
                    </button>
                </div>
            </div>

            {/* Table of Services */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="py-3 px-4 w-28">Código</th>
                                <th className="py-3 px-4">Nombre</th>
                                <th className="py-3 px-4 w-32 text-right">Valor unit.</th>
                                <th className="py-3 px-4 w-20 text-center">Cantidad</th>
                                <th className="py-3 px-4 w-28 text-right">Descuento</th>
                                <th className="py-3 px-4 w-48">Observaciones</th>
                                <th className="py-3 px-4 w-32 text-right">Total</th>
                                <th className="py-3 px-4 w-16 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-1">
                                                <FiPackage size={28} />
                                            </div>
                                            <p className="text-sm font-black text-slate-700 uppercase tracking-tight">No hay servicios en este plan</p>
                                            <p className="text-xs text-slate-400 max-w-sm">Haz clic en el botón verde superior <strong>"Agregar Servicios"</strong> para seleccionar procedimientos de la lista de precios vinculada.</p>
                                            <button
                                                onClick={() => setShowAddModal(true)}
                                                className="mt-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 cursor-pointer border-0"
                                            >
                                                <FiPlus size={14} strokeWidth={3} />
                                                <span>Agregar Primer Servicio</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, index) => {
                                    const unitVal = Number(item.valor_unit !== undefined ? item.valor_unit : item.precio || 0);
                                    const qtyVal = Number(item.cantidad !== undefined ? item.cantidad : item.qty || 1);
                                    const descVal = Number(item.descuento || 0);
                                    const rowTotal = Math.max(0, (unitVal * qtyVal) - descVal);

                                    return (
                                        <tr key={item.id || index} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Código */}
                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600 text-[11px]">
                                                {item.codigo || item.code ? (
                                                    <span className="bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-md">
                                                        {item.codigo || item.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">---</span>
                                                )}
                                            </td>

                                            {/* Nombre */}
                                            <td className="py-3 px-4 font-bold text-slate-800 text-xs uppercase">
                                                {item.nombre || item.desc}
                                            </td>

                                            {/* Valor unit. */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 w-28 ml-auto focus-within:bg-white focus-within:border-indigo-400 transition-colors">
                                                    <span className="text-slate-400 font-bold text-[11px]">$</span>
                                                    <input
                                                        type="text"
                                                        value={unitVal === 0 ? "" : unitVal.toLocaleString('es-CO')}
                                                        onChange={e => {
                                                            const clean = e.target.value.replace(/\D/g, '');
                                                            updateItemField(item.id, 'valor_unit', clean ? Number(clean) : 0);
                                                            updateItemField(item.id, 'precio', clean ? Number(clean) : 0);
                                                        }}
                                                        className="w-full bg-transparent font-mono font-black text-slate-800 text-xs outline-none text-right"
                                                    />
                                                </div>
                                            </td>

                                            {/* Cantidad */}
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={qtyVal}
                                                    onChange={e => {
                                                        const val = Number(e.target.value) || 1;
                                                        updateItemField(item.id, 'cantidad', val);
                                                        updateItemField(item.id, 'qty', val);
                                                    }}
                                                    className="w-14 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl px-2 py-1.5 font-black text-slate-800 text-xs outline-none text-center transition-colors"
                                                />
                                            </td>

                                            {/* Descuento */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1 bg-rose-50/50 border border-rose-100 rounded-xl px-2.5 py-1.5 w-24 ml-auto focus-within:bg-white focus-within:border-rose-400 transition-colors">
                                                    <span className="text-rose-400 font-bold text-[11px]">$</span>
                                                    <input
                                                        type="text"
                                                        value={descVal === 0 ? "0" : descVal.toLocaleString('es-CO')}
                                                        onChange={e => {
                                                            const clean = e.target.value.replace(/\D/g, '');
                                                            updateItemField(item.id, 'descuento', clean ? Number(clean) : 0);
                                                        }}
                                                        className="w-full bg-transparent font-mono font-black text-rose-500 text-xs outline-none text-right"
                                                    />
                                                </div>
                                            </td>

                                            {/* Observaciones */}
                                            <td className="py-3 px-4">
                                                <input
                                                    type="text"
                                                    value={item.observaciones || item.line_obs || ""}
                                                    onChange={e => {
                                                        updateItemField(item.id, 'observaciones', e.target.value);
                                                        updateItemField(item.id, 'line_obs', e.target.value);
                                                    }}
                                                    placeholder="Observaciones..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-400 transition-colors"
                                                />
                                            </td>

                                            {/* Total */}
                                            <td className="py-3 px-4 font-mono font-black text-slate-800 text-xs text-right">
                                                $ {rowTotal.toLocaleString('es-CO')}
                                            </td>

                                            {/* Acciones */}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-all shadow-xs mx-auto cursor-pointer border-0"
                                                    title="Eliminar producto"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Summary Bar */}
            {items.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-500">
                        Total de procedimientos en este plan: <span className="font-black text-indigo-600 font-mono ml-1">{items.length}</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Estimado del Plan</span>
                            <span className="text-xl font-black font-mono text-slate-800">$ {totalPlan.toLocaleString('es-CO')}</span>
                        </div>

                        <button
                            onClick={() => handleSavePlan()}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer border-0"
                        >
                            <FiSave size={16} />
                            <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal para agregar productos desde lista de precios o catálogo */}
            {showAddModal && (
                <ProductSelectorModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddProducts}
                    baseListId={selectedListId}
                />
            )}
        </div>
    );
}

// ==============================================================================
// MODAL: SELECTOR DE PRODUCTOS / SERVICIOS DE LA LISTA DE PRECIOS
// ==============================================================================
function ProductSelectorModal({ isOpen, onClose, onAdd, baseListId }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("TODAS");
    const [categories, setCategories] = useState(["TODAS"]);
    const [availableItems, setAvailableItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItemsMap, setSelectedItemsMap] = useState({}); // { [id]: { item, qty: 1 } }

    useEffect(() => {
        if (!isOpen) return;

        const loadItems = async () => {
            setLoading(true);
            try {
                let list = [];
                if (baseListId) {
                    const { data: listRow } = await supabase
                        .from("listas_precios")
                        .select("descripcion, nombre")
                        .eq("id", baseListId)
                        .maybeSingle();

                    if (listRow?.descripcion) {
                        try {
                            const parsed = JSON.parse(listRow.descripcion);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                list = parsed.map((d, idx) => ({
                                    id: d.id || `item_${idx}`,
                                    codigo: d.codigo || d.code || "",
                                    nombre: d.nombre || d.descripcion || d.desc || "",
                                    precio: Number(d.precio || d.valor || d.amount || 0),
                                    categoria: d.categoria || "GENERAL"
                                }));
                            }
                        } catch (_) {}
                    }
                }

                // Fallback a catálogo CUPS si no hay lista o está vacía
                if (list.length === 0) {
                    list = CUPS_DENTAL_CODES.map((c, idx) => ({
                        id: `cups_${c.code}_${idx}`,
                        codigo: c.code,
                        nombre: c.name,
                        precio: Number(c.precio || 0),
                        categoria: c.category || "CATÁLOGO CUPS"
                    }));
                }

                setAvailableItems(list);
                const cats = ["TODAS", ...new Set(list.map(i => i.categoria).filter(Boolean))];
                setCategories(cats);
            } catch (e) {
                console.error("Error cargando productos de la lista:", e);
            } finally {
                setLoading(false);
            }
        };

        loadItems();
    }, [isOpen, baseListId]);

    const filteredItems = useMemo(() => {
        let res = availableItems;
        if (selectedCategory !== "TODAS") {
            res = res.filter(i => i.categoria === selectedCategory);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            res = res.filter(i => 
                (i.nombre || "").toLowerCase().includes(q) || 
                (i.codigo || "").toLowerCase().includes(q)
            );
        }
        return res;
    }, [availableItems, selectedCategory, searchTerm]);

    const toggleSelectItem = (item) => {
        setSelectedItemsMap(prev => {
            const copy = { ...prev };
            if (copy[item.id]) {
                delete copy[item.id];
            } else {
                copy[item.id] = { ...item, cantidad: 1, descuento: 0 };
            }
            return copy;
        });
    };

    const handleConfirm = () => {
        const selectedList = Object.values(selectedItemsMap);
        if (selectedList.length === 0) {
            alert("Selecciona al menos un producto o servicio.");
            return;
        }
        onAdd(selectedList);
    };

    const selectedCount = Object.keys(selectedItemsMap).length;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-scaleIn">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#8CC63F] text-white flex items-center justify-center font-bold">
                            <FiPlus size={18} strokeWidth={3} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Agregar Procedimientos al Plan
                            </h3>
                            <p className="text-[11px] font-medium text-slate-400">Selecciona los conceptos que integrarán este paquete</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold hover:bg-rose-100 hover:text-rose-600 transition-colors">&times;</button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por código o nombre del procedimiento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Category Badges */}
                    {categories.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {categories.slice(0, 10).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border-0 cursor-pointer ${
                                        selectedCategory === cat 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400 font-medium">
                            <div className="w-6 h-6 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                            Cargando servicios...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium">
                            No se encontraron procedimientos
                        </div>
                    ) : (
                        filteredItems.slice(0, 50).map(item => {
                            const isSelected = Boolean(selectedItemsMap[item.id]);

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelectItem(item)}
                                    className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                        isSelected 
                                            ? 'bg-indigo-50/80 border border-indigo-200' 
                                            : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                        }`}>
                                            {isSelected && <FiCheck size={12} strokeWidth={3} />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {item.codigo && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 uppercase tracking-wider font-mono">
                                                        {item.codigo}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.categoria}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 truncate uppercase">{item.nombre}</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="font-mono font-black text-xs text-slate-700 block">$ {Number(item.precio || 0).toLocaleString('es-CO')}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500">
                        {selectedCount > 0 ? (
                            <span className="text-indigo-600 font-black">{selectedCount} servicio(s) seleccionado(s)</span>
                        ) : (
                            <span>Ningún servicio seleccionado</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 bg-white"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedCount === 0}
                            className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-[#8CC63F]/20 flex items-center gap-2 border-0 cursor-pointer active:scale-95"
                        >
                            <FiPlus size={15} strokeWidth={3} />
                            <span>Agregar ({selectedCount})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
