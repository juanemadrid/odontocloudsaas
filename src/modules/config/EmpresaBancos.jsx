// src/modules/config/EmpresaBancos.jsx
import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiCreditCard, FiCheckCircle, FiArrowLeft, FiSave } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

function BancoEditor({ item, onBack }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        numero_cuenta: item?.numero_cuenta || item?.numeroCuenta || "",
        tipo_cuenta: item?.tipo_cuenta || item?.tipoCuenta || "Ahorros",
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre del banco es obligatorio");
        if (!inquilino) return alert("No se identificó la clínica activa");

        setIsSaving(true);
        try {
            await saveConfigItem(inquilino, "bancos", "bancos", {
                ...(item || {}),
                nombre: form.nombre.trim(),
                numero_cuenta: form.numero_cuenta.trim(),
                tipo_cuenta: form.tipo_cuenta
            });
            if (toast?.success) toast.success("Banco guardado correctamente en Supabase");
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
                            {item ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">Gestión de entidades financieras</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre de la Entidad Bancaria *</label>
                    <input
                        required
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Ej. Bancolombia / Banco de Bogotá"
                        autoFocus
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Número de Cuenta</label>
                    <input
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.numero_cuenta}
                        onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })}
                        placeholder="Ej. 123-456789-00"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Tipo de Cuenta</label>
                    <select
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.tipo_cuenta}
                        onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value })}
                    >
                        <option value="Ahorros">Ahorros</option>
                        <option value="Corriente">Corriente</option>
                    </select>
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
                        <span>{isSaving ? "Guardando..." : "Guardar Banco"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function EmpresaBancos() {
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
            const data = await getConfigItems(inquilino, "bancos", "bancos");
            setRows(data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) {
            console.error("Error fetching bancos:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleDelete = async (row) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar el banco "${row.nombre}"?`)) return;
        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "bancos", "bancos", row.id);
            setRows(prev => prev.filter(r => r.id !== row.id));
            if (toast?.success) toast.success("Banco eliminado correctamente");
            else alert("✅ Banco eliminado correctamente");
        } catch (e) {
            console.error("Error al eliminar banco:", e);
            alert("❌ Error al eliminar banco: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (view === "editor") return <BancoEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} />;

    const filteredRows = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiCreditCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Cuentas Bancarias</h1>
                        <p className="text-xs font-medium text-slate-500">Entidades financieras y cuentas para recaudo</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar banco..."
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
                        <span>Nuevo Banco</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Entidad Bancaria</th>
                            <th className="py-3 px-4">Número de Cuenta</th>
                            <th className="py-3 px-4">Tipo</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando entidades bancarias...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No hay bancos registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                                <FiCreditCard size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-slate-600">{row.numero_cuenta || row.numeroCuenta || "S/N"}</td>
                                    <td className="py-3 px-4 font-semibold text-slate-600">{row.tipo_cuenta || row.tipoCuenta || "Ahorros"}</td>
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
