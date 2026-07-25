import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiCreditCard, FiDollarSign, FiArrowLeft, FiSave } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// Compact Editor Component for Banco / Caja
function BancoEditor({ item, onBack, inquilino }) {
    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        numeroCuenta: item?.numeroCuenta || "",
        metodoPagoId: item?.metodoPagoId || "",
        valor: item?.valor || 0,
        fecha: item?.fecha || new Date().toISOString().split('T')[0],
        descripcion: item?.descripcion || ""
    });

    const [metodosPago, setMetodosPago] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!inquilino) return;
            try {
                const snap = await getDocs(query(
                    collection(db, "metodos_pago"),
                    where("inquilino", "==", inquilino)
                ));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setMetodosPago(list);
            } catch (e) { console.error(e); }
        };
        load();
    }, [inquilino]);

    const handleChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre del banco es obligatorio");

        setIsSaving(true);
        try {
            const payload = { ...form, inquilino, actualizado: new Date() };
            if (item?.id) {
                await updateDoc(doc(db, "bancos", item.id), payload);
            } else {
                await addDoc(collection(db, "bancos"), { ...payload, creado: new Date() });
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
                            {item ? "Editar Banco / Caja" : "Nuevo Banco / Caja"}
                        </h2>
                        <p className="text-[11px] text-slate-500">Gestión de entidad financiera o caja general</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre de Entidad / Caja *</label>
                    <input
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.nombre}
                        onChange={e => handleChange("nombre", e.target.value)}
                        placeholder="Ej. Bancolombia, Nequi, Caja General"
                        autoFocus
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Número de Cuenta</label>
                    <input
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.numeroCuenta}
                        onChange={e => handleChange("numeroCuenta", e.target.value)}
                        placeholder="Ej. 123-456789-00 o N/A"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Medio de Pago Vinculado</label>
                    <select
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.metodoPagoId}
                        onChange={e => handleChange("metodoPagoId", e.target.value)}
                    >
                        <option value="">-- Seleccione medio de pago --</option>
                        {metodosPago.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Saldo Inicial ($)</label>
                    <input
                        type="number"
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        value={form.valor}
                        onChange={e => handleChange("valor", Number(e.target.value))}
                        placeholder="0"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Descripción / Notas</label>
                    <textarea
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                        value={form.descripcion}
                        onChange={e => handleChange("descripcion", e.target.value)}
                        placeholder="Notas adicionales..."
                    />
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
                        <span>{isSaving ? "Guardando..." : "Guardar Banco"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

// Main Component
export default function EmpresaBancos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(collection(db, "bancos"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setRows(list);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleDelete = async (row) => {
        if (!window.confirm(`¿Estás seguro de eliminar el banco "${row.nombre}"?`)) return;
        try {
            await deleteDoc(doc(db, "bancos", row.id));
            setRows(prev => prev.filter(r => r.id !== row.id));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar: " + e.message);
        }
    };

    if (view === "editor") return <BancoEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} inquilino={inquilino} />;

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.numeroCuenta || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiCreditCard size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Bancos y Cajas</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de recursos financieros y cuentas bancarias</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar banco o cuenta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Banco</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Entidad / Caja</th>
                            <th className="py-2.5 px-4">Número de Cuenta</th>
                            <th className="py-2.5 px-4">Saldo Actual</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando entidades bancarias...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron cuentas o bancos registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                🏦
                                            </div>
                                            <span className="font-bold text-slate-800">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                                        {row.numeroCuenta || "Caja General"}
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            <FiDollarSign size={11} /> {new Intl.NumberFormat('es-CO').format(row.valor || 0)}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(row); setView("editor"); }}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Banco"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Banco"
                                            >
                                                <FiTrash2 size={13} />
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
