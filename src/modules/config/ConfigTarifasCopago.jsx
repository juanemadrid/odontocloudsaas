// src/modules/config/ConfigTarifasCopago.jsx
import React, { useState, useEffect, useMemo } from "react";
import { 
    FiPlus, FiSearch, FiEdit2, FiTrash2, FiSave, FiX, 
    FiDollarSign, FiPercent, FiArrowLeft, FiCheck
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

// Sleek OralDrive Switch
const OralDriveSwitch = ({ checked, onChange, id }) => (
    <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 shrink-0 p-0.5 border-0 outline-none focus:ring-2 focus:ring-blue-300 ${
            checked ? "bg-blue-600 shadow-xs" : "bg-slate-200 hover:bg-slate-300"
        }`}
    >
        <div
            className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm flex items-center justify-center ${
                checked ? "translate-x-6" : "translate-x-0"
            }`}
        >
            {checked && <FiCheck size={11} className="text-blue-600 stroke-[3]" />}
        </div>
    </button>
);

// Separador de miles con puntos para Colombia (ej: 5.000)
const formatNumberWithDots = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const cleanStr = String(val).replace(/\D/g, "");
    if (!cleanStr) return "";
    return cleanStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function ConfigTarifasCopago() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id;

    const [tarifas, setTarifas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState("list"); // "list" | "form"
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form state matching OralDrive /NewRate
    const [formData, setFormData] = useState({
        nombre: "",
        esValorFijo: false,
        porcentaje: 0,
        valorFijo: 0,
    });

    useEffect(() => {
        if (inquilino) {
            loadTarifas();
        }
    }, [inquilino]);

    const loadTarifas = async () => {
        setLoading(true);
        try {
            const items = await getConfigItems(inquilino, "tarifas_copago", "tarifas_copago");
            setTarifas(items || []);
        } catch (error) {
            console.error("Error al cargar tarifas de copago:", error);
            if (toast?.error) toast.error("Error al cargar tarifas de copago");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingItem(null);
        setFormData({
            nombre: "",
            esValorFijo: false,
            porcentaje: 0,
            valorFijo: 0,
        });
        setViewMode("form");
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setFormData({
            nombre: item.nombre || "",
            esValorFijo: Boolean(item.esValorFijo),
            porcentaje: item.porcentaje ?? 0,
            valorFijo: item.valorFijo ?? 0,
        });
        setViewMode("form");
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar esta tarifa de copago?")) return;
        try {
            await deleteConfigItem(inquilino, "tarifas_copago", null, id);
            setTarifas(prev => prev.filter(t => t.id !== id));
            if (toast?.success) toast.success("Tarifa eliminada con éxito");
        } catch (error) {
            console.error("Error al eliminar tarifa:", error);
            if (toast?.error) toast.error("Error al eliminar tarifa");
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre?.trim()) {
            if (toast?.error) toast.error("El nombre de la tarifa es obligatorio");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                id: editingItem?.id || (crypto.randomUUID ? crypto.randomUUID() : `tarifa_${Date.now()}`),
                nombre: formData.nombre.trim(),
                esValorFijo: Boolean(formData.esValorFijo),
                porcentaje: formData.esValorFijo ? 0 : Number(formData.porcentaje) || 0,
                valorFijo: formData.esValorFijo ? Number(formData.valorFijo) || 0 : 0,
                activo: true,
                updatedAt: new Date().toISOString()
            };

            await saveConfigItem(inquilino, "tarifas_copago", null, payload);

            if (editingItem?.id) {
                setTarifas(prev => prev.map(t => t.id === editingItem.id ? payload : t));
                if (toast?.success) toast.success("Tarifa actualizada exitosamente");
            } else {
                setTarifas(prev => [...prev, payload]);
                if (toast?.success) toast.success("Tarifa creada exitosamente");
            }

            setViewMode("list");
        } catch (error) {
            console.error("Error al guardar tarifa de copago:", error);
            if (toast?.error) toast.error("Error al guardar tarifa: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredTarifas = useMemo(() => {
        if (!searchTerm.trim()) return tarifas;
        const q = searchTerm.toLowerCase();
        return tarifas.filter(t => (t.nombre || "").toLowerCase().includes(q));
    }, [tarifas, searchTerm]);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            {/* === VIEW 1: FORM (NUEVA TARIFA / EDITAR TARIFA) === */}
            {viewMode === "form" ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in">
                    {/* Breadcrumbs & Header */}
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 mb-1">
                                <span>Configuración</span>
                                <span>›</span>
                                <button 
                                    type="button" 
                                    onClick={() => setViewMode("list")}
                                    className="hover:text-blue-600 cursor-pointer underline decoration-dotted"
                                >
                                    Tarifas Copagos
                                </button>
                                <span>›</span>
                                <span className="text-slate-600 font-bold">
                                    {editingItem ? "Editar tarifa" : "Nueva tarifa"}
                                </span>
                            </div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">
                                {editingItem ? "Editar tarifa" : "Nueva tarifa"}
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-6 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition-all cursor-pointer border-0 disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FiSave size={15} />
                                )}
                                <span>{saving ? "Guardando..." : "Guardar"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Card Datos básicos */}
                    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                Datos básicos
                            </h2>
                        </div>

                        <div className="space-y-5">
                            {/* Nombre */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-xs font-bold text-slate-700 md:text-right">
                                    Nombre <span className="text-rose-500">*</span>
                                </label>
                                <div className="md:col-span-8">
                                    <input
                                        type="text"
                                        className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                        placeholder="Nombre tarifa"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Tarifa con valor fijo (Toggle Switch) */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                <label className="md:col-span-4 text-xs font-bold text-slate-700 md:text-right">
                                    Tarifa con valor fijo
                                </label>
                                <div className="md:col-span-8 flex items-center">
                                    <OralDriveSwitch
                                        id="esValorFijo"
                                        checked={formData.esValorFijo}
                                        onChange={(val) => setFormData(prev => ({ ...prev, esValorFijo: val }))}
                                    />
                                </div>
                            </div>

                            {/* Porcentaje o Valor fijo según el switch */}
                            {!formData.esValorFijo ? (
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    <label className="md:col-span-4 text-xs font-bold text-slate-700 md:text-right">
                                        Porcentaje <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="md:col-span-8 relative max-w-xs">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            className="w-full h-10 px-3.5 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left"
                                            placeholder="0"
                                            value={formData.porcentaje === "" ? "" : formData.porcentaje}
                                            onChange={(e) => setFormData(prev => ({ 
                                                ...prev, 
                                                porcentaje: e.target.value === "" ? "" : Number(e.target.value) 
                                            }))}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                            %
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    <label className="md:col-span-4 text-xs font-bold text-slate-700 md:text-right">
                                        Valor fijo <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="md:col-span-8 relative max-w-xs">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                            $
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full h-10 pl-7 pr-12 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left"
                                            placeholder="0"
                                            value={formatNumberWithDots(formData.valorFijo)}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, "");
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    valorFijo: digits === "" ? "" : Number(digits) 
                                                }));
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                            COP
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Save Bar */}
                        <div className="pt-6 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-6 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition-all cursor-pointer border-0 disabled:opacity-50"
                            >
                                <FiSave size={15} />
                                <span>{saving ? "Guardando..." : "Guardar"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* === VIEW 2: LIST (TARIFAS COPAGOS) === */
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 mb-1">
                                <span>Configuración</span>
                                <span>›</span>
                                <span className="text-slate-600 font-bold">Tarifas Copagos</span>
                            </div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">
                                Tarifas Copagos
                            </h1>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="bg-[#8CC63F] hover:bg-[#7bb335] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-1.5 transition-all cursor-pointer border-0"
                        >
                            <FiPlus size={16} />
                            <span>Nueva tarifa</span>
                        </button>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-end">
                        <div className="relative w-full sm:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input
                                type="text"
                                placeholder="Buscar tarifa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-6">Nombre tarifa</th>
                                    <th className="py-3 px-6 text-center">Porcentaje</th>
                                    <th className="py-3 px-6 text-right">Valor fijo</th>
                                    <th className="py-3 px-6 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400">
                                            <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                            Cargando tarifas de copago...
                                        </td>
                                    </tr>
                                ) : filteredTarifas.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                            {searchTerm 
                                                ? `No se encontraron tarifas que coincidan con "${searchTerm}".`
                                                : "No hay tarifas de copago configuradas. Haz clic en '+ Nueva tarifa' para crear la primera."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTarifas.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3.5 px-6 font-bold text-slate-800">
                                                {t.nombre}
                                            </td>
                                            <td className="py-3.5 px-6 text-center text-slate-600 font-medium">
                                                {!t.esValorFijo && t.porcentaje ? `${t.porcentaje}%` : "—"}
                                            </td>
                                            <td className="py-3.5 px-6 text-right font-bold text-slate-800">
                                                {t.esValorFijo 
                                                    ? `$ ${formatNumberWithDots(t.valorFijo) || "0"}` 
                                                    : (t.porcentaje ? "—" : "$ 0")}
                                            </td>
                                            <td className="py-3.5 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(t)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Editar tarifa"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(t.id)}
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Eliminar tarifa"
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
            )}
        </div>
    );
}
