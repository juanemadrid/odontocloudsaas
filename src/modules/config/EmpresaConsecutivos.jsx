import React, { useState, useEffect } from "react";

import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiLink, FiFilter, FiArrowLeft, FiSave, FiHash, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

// Editor Component
function ConsecutivoEditor({ item, onBack, inquilino }) {
    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        recibo_caja: item?.recibo_caja || 0,
        nota_credito: item?.nota_credito || 0,
        nota_debito: item?.nota_debito || 0,
        egresos: item?.egresos || 0,
        presupuestos: item?.presupuestos || 0,
        tratamientos: item?.tratamientos || 0,
        ordenes_compra: item?.ordenes_compra || 0,
        cx_cobrar: item?.cx_cobrar || 0,
        saldos_favor: item?.saldos_favor || 0,
        uso_notas_credito: item?.uso_notas_credito || 0,
        rips_automaticos: item?.rips_automaticos || 0,
        num_rips: item?.num_rips || 0,

        // Toggles
        datos_manuales: item?.datos_manuales || false,
        factura_compra: item?.factura_compra || false,
        factura_venta: item?.factura_venta || false,
        facturacion_electronica: item?.facturacion_electronica || false,
        en_uso: item?.en_uso !== undefined ? item.en_uso : true
    });

    const handleChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
    };

    const handleSave = async () => {
        if (!form.nombre.trim()) return alert("El nombre es obligatorio");
        try {
            const payload = {
                ...form,
                inquilino,
                actualizado: new Date()
            };

            if (item?.id) {
                await updateDoc(doc(db, "consecutivos", item.id), payload);
                alert("Consecutivo actualizado");
            } else {
                await addDoc(collection(db, "consecutivos"), {
                    ...payload,
                    creado: new Date()
                });
                alert("Consecutivo creado");
            }
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        }
    };

    // Helper for number inputs
    const InputCounter = ({ label, field }) => (
        <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{label}</label>
            <div className="relative group">
                <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-all font-black" />
                <input
                    type="number"
                    className="w-full pl-12 pr-4 py-3 bg-slate-100/30 border border-slate-200 rounded-xl text-[14px] font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner-sm"
                    value={form[field]}
                    onChange={e => handleChange(field, Number(e.target.value))}
                    min={0}
                />
            </div>
        </div>
    );

    // Helper for Toggles
    const Toggle = ({ label, field }) => (
        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white transition-colors group/toggle">
            <label className="text-[13px] font-bold text-slate-600 group-hover/toggle:text-slate-900 transition-colors uppercase tracking-tight">{label}</label>
            <div
                onClick={() => handleChange(field, !form[field])}
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 ring-4 ring-transparent ${form[field] ? "bg-blue-600 shadow-lg shadow-blue-200" : "bg-slate-200"}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-sm ${form[field] ? "left-7" : "left-1"}`} />
            </div>
        </div>
    );

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300">
            {/* Header: Institutional & Actions */}
            <div className="group/section bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_35px_80px_rgba(0,0,0,0.06)] transition-all duration-700 overflow-hidden relative mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 shadow-[1px_0_10px_rgba(37,99,235,0.15)]"></div>

                <div className="bg-slate-50/50 backdrop-blur-sm px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-90"
                        >
                            <FiArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-200">
                            <FiHash size={20} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">
                                {item ? "Editar Consecutivo" : "Nuevo Consecutivo"}
                            </h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Configuración global de numeración</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            <FiSave className="text-lg" /> Guardar
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Counters */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-[0_15px_40px_rgba(0,0,0,0.02)] p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>

                        <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            Numeración de Operaciones
                        </h3>

                        <div className="space-y-6">
                            <div className="space-y-1.5 max-w-md">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Identificador del Consecutivo *</label>
                                <input
                                    className="w-full px-6 py-4 bg-slate-100/30 border border-slate-200 rounded-[24px] text-[18px] font-black text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner-sm"
                                    value={form.nombre}
                                    onChange={e => handleChange("nombre", e.target.value)}
                                    placeholder="Ej. Oficial 2026..."
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-slate-50">
                                <InputCounter label="Recibo de Caja" field="recibo_caja" />
                                <InputCounter label="Nota Crédito" field="nota_credito" />
                                <InputCounter label="Nota Débito" field="nota_debito" />
                                <InputCounter label="Egresos" field="egresos" />
                                <InputCounter label="Presupuestos" field="presupuestos" />
                                <InputCounter label="Plan de Tratamiento" field="tratamientos" />
                                <InputCounter label="Órdenes de Compra" field="ordenes_compra" />
                                <InputCounter label="Cuentas por Cobrar" field="cx_cobrar" />
                                <InputCounter label="Saldos a Favor" field="saldos_favor" />
                                <InputCounter label="Uso Notas Crédito" field="uso_notas_credito" />
                                <InputCounter label="RIPS Automáticos" field="rips_automaticos" />
                                <InputCounter label="Número RIPS (Res 2275)" field="num_rips" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Toggles & Options */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-50/50 backdrop-blur-md rounded-[32px] border border-slate-200/50 p-8 space-y-8 sticky top-4">
                        <div>
                            <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <FiHash className="text-blue-600" />
                                Configuración
                            </h3>

                            <div className="space-y-2">
                                <Toggle label="Datos Manuales" field="datos_manuales" />
                                <Toggle label="Factura de Compra" field="factura_compra" />
                                <Toggle label="Factura de Venta" field="factura_venta" />
                                <Toggle label="Fact. Electrónica" field="facturacion_electronica" />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-200/60">
                            <Toggle label="Estado Activo" field="en_uso" />
                            <p className="mt-3 px-3 text-[10px] font-bold text-slate-400 uppercase leading-relaxed tracking-widest">
                                Si está desactivado, el sistema no utilizará este consecutivo para nuevas operaciones
                            </p>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                        >
                            <FiSave className="text-lg group-hover:scale-110 transition-transform" /> Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default function EmpresaConsecutivos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [view, setView] = useState("list"); // list, editor
    const [editingItem, setEditingItem] = useState(null);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "consecutivos"),
                where("inquilino", "==", inquilino),
                orderBy("nombre", "asc")
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRows(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [inquilino]);

    const openNew = () => {
        setEditingItem(null);
        setView("editor");
    };

    const openEdit = (row) => {
        setEditingItem(row);
        setView("editor");
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`¿Eliminar consecutivo "${row.nombre}"?`)) return;
        try {
            await deleteDoc(doc(db, "consecutivos", row.id));
            setRows(prev => prev.filter(r => r.id !== row.id));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        }
    };

    if (view === "editor") {
        return <ConsecutivoEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} inquilino={inquilino} />;
    }

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300">
            {loading && (
                <div className="absolute top-4 right-4 z-50">
                    <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
            )}

            {/* Main Header / Toolbar */}
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_35px_80px_rgba(0,0,0,0.06)] transition-all duration-700 overflow-hidden relative mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 shadow-[1px_0_10px_rgba(37,99,235,0.15)]"></div>

                <div className="bg-slate-50/50 backdrop-blur-sm px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
                            <FiHash className="text-white text-xl" />
                        </div>
                        <div>
                            <h2 className="text-[20px] font-black text-slate-800 uppercase tracking-tighter">Consecutivos</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Gestión de numeración de documentos</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Search Input */}
                        <div className="relative group flex-1 md:flex-none">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-all font-black" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-64 pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[14px] font-extrabold text-slate-800 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                            />
                        </div>

                        {/* New Button */}
                        <button
                            onClick={openNew}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[13px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95 group/btn overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                            <FiPlus className="text-lg" /> Nuevo
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="group/section bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden relative">
                <div className="p-0 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/30">
                                <th className="px-8 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                                <th className="px-8 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Estado Operativo</th>
                                <th className="px-8 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Vinculación</th>
                                <th className="px-8 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Operaciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-blue-400">
                                                <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Cargando consecutivos...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <FiHash size={40} className="text-slate-300" />
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay consecutivos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-4 border-b border-slate-50 transition-all group-hover/row:translate-x-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover/row:scale-110 transition-transform duration-500">
                                                    <FiHash size={14} />
                                                </div>
                                                <span className="text-[15px] font-black text-slate-700 uppercase tracking-tight">{row.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            {row.en_uso ? (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full w-fit border border-emerald-100/50 shadow-sm">
                                                    <FiCheckCircle size={12} />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">En uso</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-400 rounded-full w-fit border border-slate-200/50">
                                                    <FiXCircle size={12} />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Inactivo</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50">
                                            <button
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-sky-50 text-sky-500 hover:bg-sky-500 hover:text-white hover:shadow-lg hover:shadow-sky-200 transition-all active:scale-90"
                                                title="Quienes usan el consecutivo"
                                            >
                                                <FiLink size={16} />
                                            </button>
                                        </td>
                                        <td className="px-8 py-4 border-b border-slate-50 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-all duration-500 translate-x-4 group-hover/row:translate-x-0">
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="p-2.5 rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-90"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    className="p-2.5 rounded-xl text-red-500 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-200 transition-all active:scale-90"
                                                >
                                                    <FiTrash2 size={16} />
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
        </div>
    );
}
