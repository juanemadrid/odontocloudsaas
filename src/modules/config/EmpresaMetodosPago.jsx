// src/modules/config/EmpresaMetodosPago.jsx
import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiCheckCircle, FiCreditCard, FiDollarSign, FiRefreshCw, FiArrowLeft, FiSave } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

function MetodoPagoEditor({ item, onBack }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        requiereReferencia: item?.requiereReferencia || false,
        activo: item?.activo !== undefined ? item.activo : true,
        bancoId: item?.bancoId || ""
    });
    const [bancos, setBancos] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!inquilino) return;
            try {
                const list = await getConfigItems(inquilino, "bancos", "bancos");
                setBancos(list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            } catch (e) { console.error(e); }
        };
        load();
    }, [inquilino]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre del método de pago es obligatorio");

        setIsSaving(true);
        try {
            const bancoObj = bancos.find(b => b.id === form.bancoId);
            await saveConfigItem(inquilino, "metodos_pago", "metodos_pago", {
                ...(item || {}),
                nombre: form.nombre.trim(),
                requiereReferencia: form.requiereReferencia,
                activo: form.activo,
                bancoId: form.bancoId,
                bancoNombre: bancoObj?.nombre || ""
            });
            if (toast?.success) toast.success("Método de pago guardado en Supabase");
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md max-w-lg mx-auto overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-[16px] font-black text-slate-800 uppercase">
                            {item ? "Editar Método de Pago" : "Nuevo Método de Pago"}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">Configuración de cobro y recaudos</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre del Método *</label>
                    <input
                        required
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.nombre}
                        onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Ej. Transferencia Bancaria, Nequi, Efectivo"
                        autoFocus
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Banco de Destino (Opcional)</label>
                    <select
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.bancoId}
                        onChange={e => setForm(prev => ({ ...prev, bancoId: e.target.value }))}
                    >
                        <option value="">Ninguno / Pago en Efectivo</option>
                        {bancos.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Requiere Número de Referencia</span>
                        <span className="text-[10px] font-medium text-slate-500">Exigir comprobante de transferencia o voucher</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.requiereReferencia}
                            onChange={e => setForm(prev => ({ ...prev, requiereReferencia: e.target.checked }))}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar Método"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function EmpresaMetodosPago() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "metodos_pago", "metodos_pago");
            setRows(data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) {
            console.error("Error fetching metodos_pago:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleDelete = async (row) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar el método de pago "${row.nombre}"?`)) return;
        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "metodos_pago", "metodos_pago", row.id);
            setRows(prev => prev.filter(r => r.id !== row.id));
            if (toast?.success) toast.success("Método de pago eliminado correctamente");
            else alert("✅ Método de pago eliminado correctamente");
        } catch (e) {
            console.error("Error al eliminar método de pago:", e);
            alert("❌ Error al eliminar método de pago: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (view === "editor") return <MetodoPagoEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} />;

    const filteredRows = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiCreditCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Métodos de Pago</h1>
                        <p className="text-xs font-medium text-slate-500">Modalidades de cobro y recaudos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar método..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Método</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre del Método</th>
                            <th className="py-3 px-4">Banco / Destino</th>
                            <th className="py-3 px-4 text-center">Referencia</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando métodos de pago...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No hay métodos de pago registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                <FiDollarSign size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-slate-600">{row.bancoNombre || "-"}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row.requiereReferencia ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-slate-100 text-slate-500"}`}>
                                            {row.requiereReferencia ? "Requerida" : "No aplica"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(row); setView("editor"); }}
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
