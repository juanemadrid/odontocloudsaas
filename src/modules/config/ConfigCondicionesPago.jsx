// src/modules/config/ConfigCondicionesPago.jsx
import React, { useState, useEffect } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiSave, FiCreditCard, FiX, FiCheck } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

export default function ConfigCondicionesPago() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchItems();
    }, [inquilino]);

    const fetchItems = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "condiciones_pago", "condiciones_pago");
            setItems(data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) {
            console.error("Error fetching payment conditions:", error);
            if (toast?.error) toast.error("Error al cargar condiciones de pago");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem({ ...item });
        } else {
            setCurrentItem({ nombre: "", admiteCredito: false });
        }
        setModalOpen(true);
    };

    const handleDelete = async (item) => {
        if (window.confirm(`⚠️ ¿Estás seguro de eliminar la condición "${item.nombre}"?`)) {
            try {
                await deleteConfigItem(inquilino, "condiciones_pago", "condiciones_pago", item.id);
                setItems(prev => prev.filter(i => i.id !== item.id));
                if (toast?.success) toast.success("Eliminado correctamente de Supabase");
                else alert("✅ Condición de pago eliminada correctamente");
            } catch (error) {
                console.error("Error deleting:", error);
                alert("❌ Error al eliminar condición de pago: " + error.message);
            }
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!currentItem?.nombre?.trim()) {
            if (toast?.warning) toast.warning("El nombre es obligatorio");
            return;
        }
        setSaving(true);
        try {
            await saveConfigItem(inquilino, "condiciones_pago", "condiciones_pago", {
                ...(currentItem.id ? { id: currentItem.id } : {}),
                nombre: currentItem.nombre.trim(),
                admiteCredito: !!currentItem.admiteCredito
            });

            if (toast?.success) toast.success("Guardado correctamente en Supabase");
            setModalOpen(false);
            fetchItems();
        } catch (error) {
            console.error("Error saving:", error);
            if (toast?.error) toast.error("Error al guardar condición");
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = items.filter(item =>
        (item.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiCreditCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Condiciones de Pago</h1>
                        <p className="text-xs font-medium text-slate-500">Términos de crédito y plazos comerciales</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar condición..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Condición</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre de la Condición</th>
                            <th className="py-3 px-4 text-center">Permite Crédito</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && items.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando condiciones de pago...
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No hay condiciones de pago registradas
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                <FiCreditCard size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800 uppercase">{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.admiteCredito ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"}`}>
                                            {item.admiteCredito ? "Sí" : "No (Contado)"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Editar"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
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

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                    <FiCreditCard size={18} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 uppercase">
                                    {currentItem?.id ? "Editar Condición" : "Nueva Condición de Pago"}
                                </h3>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold">&times;</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre de la Condición *</label>
                                <input
                                    required
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={currentItem?.nombre || ""}
                                    onChange={e => setCurrentItem({ ...currentItem, nombre: e.target.value })}
                                    placeholder="Ej. Contado, Crédito a 30 días"
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700">Permite Venta a Crédito</span>
                                    <span className="text-[10px] font-medium text-slate-500">Habilita cuenta por cobrar para la venta</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!!currentItem?.admiteCredito}
                                        onChange={e => setCurrentItem({ ...currentItem, admiteCredito: e.target.checked })}
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 border-0 disabled:opacity-50"
                                >
                                    <FiSave size={15} />
                                    <span>{saving ? "Guardando..." : "Guardar Condición"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
