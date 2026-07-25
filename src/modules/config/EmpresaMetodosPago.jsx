import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiCheckCircle, FiCreditCard, FiDollarSign, FiRefreshCw, FiArrowLeft, FiSave } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// Compact Editor Component for Método de Pago
function MetodoPagoEditor({ item, onBack, inquilino }) {
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
                const snap = await getDocs(query(
                    collection(db, "bancos"),
                    where("inquilino", "==", inquilino)
                ));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setBancos(list);
            } catch (e) { console.error(e); }
        };
        load();
    }, [inquilino]);

    const handleChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre del método de pago es obligatorio");

        setIsSaving(true);
        try {
            const bancoObj = bancos.find(b => b.id === form.bancoId);
            const payload = {
                ...form,
                inquilino,
                bancoNombre: bancoObj?.nombre || "",
                actualizado: new Date()
            };

            if (item?.id) {
                await updateDoc(doc(db, "metodos_pago", item.id), payload);
            } else {
                await addDoc(collection(db, "metodos_pago"), {
                    ...payload,
                    creado: new Date()
                });
            }
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onBack}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800">
                            {item ? "Editar Método de Pago" : "Nuevo Método de Pago"}
                        </h2>
                        <p className="text-[11px] text-slate-500">Configuración de cobro y recaudos</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre del Método *</label>
                    <input
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.nombre}
                        onChange={e => handleChange("nombre", e.target.value)}
                        placeholder="Ej. Transferencia Bancaria, Nequi, Efectivo"
                        autoFocus
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Banco / Cuenta Destino</label>
                    <select
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.bancoId}
                        onChange={(e) => handleChange("bancoId", e.target.value)}
                    >
                        <option value="">-- Ninguno / Caja General --</option>
                        {bancos.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre} - {b.numeroCuenta || "Sin # de cuenta"}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-slate-700">Solicitar Referencia</span>
                        <span className="text-[10px] text-slate-400">Obliga a ingresar el código de comprobante/transacción</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.requiereReferencia}
                            onChange={(e) => handleChange("requiereReferencia", e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-slate-700">Estado Activo</span>
                        <span className="text-[10px] text-slate-400">Habilitado para registro de pagos en caja</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.activo}
                            onChange={(e) => handleChange("activo", e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
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

// Main Component
export default function EmpresaMetodosPago() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);
    const [showInactive, setShowInactive] = useState(false);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "metodos_pago"),
                where("inquilino", "==", inquilino)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setRows(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [inquilino]);

    const handleToggleActive = async (row) => {
        const newStatus = !row.activo;
        const action = newStatus ? "Restaurar" : "Inactivar";
        if (!window.confirm(`¿${action} método de pago "${row.nombre}"?`)) return;
        try {
            await updateDoc(doc(db, "metodos_pago", row.id), { activo: newStatus });
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, activo: newStatus } : r));
        } catch (e) {
            console.error(e);
            alert("Error al cambiar estado: " + e.message);
        }
    };

    if (view === "editor") {
        return <MetodoPagoEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} inquilino={inquilino} />;
    }

    const filteredRows = rows.filter(r => {
        const matchesSearch = (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = showInactive ? !r.activo : (r.activo !== false);
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiCreditCard size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Métodos de Pago</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de recaudos y modalidades de cobro</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar método..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${showInactive ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                        <FiRefreshCw size={12} className={showInactive ? 'animate-spin-slow' : ''} />
                        <span>{showInactive ? "Ver Activos" : "Ver Inactivos"}</span>
                    </button>

                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre del Método</th>
                            <th className="py-2.5 px-4">Banco / Destino</th>
                            <th className="py-2.5 px-4 text-center">Referencia</th>
                            <th className="py-2.5 px-4">Estado</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando métodos de pago...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron métodos de pago registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                <FiDollarSign size={14} />
                                            </div>
                                            <span className="font-bold text-slate-800">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className="font-medium text-slate-600">{row.bancoNombre || "-"}</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${row.requiereReferencia ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-slate-100 text-slate-500"}`}>
                                            {row.requiereReferencia ? "Requerida" : "No aplica"}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${row.activo !== false ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"}`}>
                                            <FiCheckCircle size={10} /> {row.activo !== false ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(row); setView("editor"); }}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Método"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(row)}
                                                className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0 ${row.activo !== false ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                                title={row.activo !== false ? "Inactivar" : "Restaurar"}
                                            >
                                                {row.activo !== false ? <FiTrash2 size={13} /> : <FiCheckCircle size={13} />}
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
