import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiX, FiSave, FiPercent } from "react-icons/fi";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function ConfigImpuestos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre: "",
        porcentaje: 0,
        operacion: "suma",
        aplicaA: "base",
        tipoImpuesto: "ninguna"
    });

    useEffect(() => {
        if (!inquilino) return;

        setLoading(true);
        const q = query(
            collection(db, "tenants", inquilino, "impuestos"),
            orderBy("nombre", "asc")
        );

        const unsub = onSnapshot(q, (snap) => {
            setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            if (toast?.error) toast.error("Error al sincronizar impuestos");
            setLoading(false);
        });

        return () => unsub();
    }, [inquilino]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre.trim()) {
            if (toast?.warning) toast.warning("Defina el nombre del impuesto");
            return;
        }
        if (formData.porcentaje < 0) {
            if (toast?.warning) toast.warning("El porcentaje no puede ser negativo");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                nombre: formData.nombre.trim(),
                porcentaje: Number(formData.porcentaje),
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.email
            };

            if (editingId) {
                await updateDoc(doc(db, "tenants", inquilino, "impuestos", editingId), payload);
                if (toast?.success) toast.success("Impuesto actualizado");
            } else {
                await addDoc(collection(db, "tenants", inquilino, "impuestos"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile.email
                });
                if (toast?.success) toast.success("Registro tributario creado");
            }
            closeModal();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al procesar la solicitud");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Desea eliminar este impuesto de la configuración?")) return;
        try {
            await deleteDoc(doc(db, "tenants", inquilino, "impuestos", id));
            if (toast?.success) toast.success("Impuesto eliminado correctamente");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al eliminar");
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                nombre: item.nombre,
                porcentaje: item.porcentaje,
                operacion: item.operacion || "suma",
                aplicaA: item.aplicaA || "base",
                tipoImpuesto: item.tipoImpuesto || "ninguna"
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                porcentaje: 0,
                operacion: "suma",
                aplicaA: "base",
                tipoImpuesto: "ninguna"
            });
        }
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const filtered = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiPercent size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Impuestos y Retenciones</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Configuración tributaria, retención en la fuente e IVA comercial</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar impuesto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => openModal()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Registro</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre del Impuesto</th>
                            <th className="py-2.5 px-4">Porcentaje</th>
                            <th className="py-2.5 px-4">Operación</th>
                            <th className="py-2.5 px-4">Aplica A</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando registros tributarios...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron impuestos registrados
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                %
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 uppercase block">{row.nombre}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {row.tipoImpuesto !== "ninguna" ? `Tipo: ${row.tipoImpuesto.toUpperCase()}` : "Tributo General"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 font-bold text-slate-800">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-100">
                                            {row.porcentaje}%
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${row.operacion === "suma" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"}`}>
                                            {row.operacion === "suma" ? "+ SUMA" : "- RESTA / RETENCIÓN"}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 font-medium text-slate-600 capitalize">
                                        {row.aplicaA}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => openModal(row)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Impuesto"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Impuesto"
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

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiPercent size={15} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">
                                    {editingId ? "Editar Impuesto / Retención" : "Nuevo Impuesto / Retención"}
                                </h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre del Impuesto *</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ej. IVA 19%, Retefuente 2.5%, ReteIVA"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors uppercase"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Porcentaje (%) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="19"
                                        value={formData.porcentaje}
                                        onChange={(e) => setFormData({ ...formData, porcentaje: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Operación *</label>
                                    <select
                                        value={formData.operacion}
                                        onChange={(e) => setFormData({ ...formData, operacion: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="suma">Suma (+)</option>
                                        <option value="resta">Resta / Retención (-)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Aplica A *</label>
                                    <select
                                        value={formData.aplicaA}
                                        onChange={(e) => setFormData({ ...formData, aplicaA: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="base">Valor Base</option>
                                        <option value="total">Total Final</option>
                                        <option value="bruto">Valor Bruto</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Tipo Fiscal</label>
                                    <select
                                        value={formData.tipoImpuesto}
                                        onChange={(e) => setFormData({ ...formData, tipoImpuesto: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="ninguna">Genérico</option>
                                        <option value="iva">IVA</option>
                                        <option value="reteiva">ReteIVA</option>
                                        <option value="reterenta">ReteRenta</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-1.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {saving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={15} />
                                    )}
                                    <span>{saving ? "Guardando..." : "Guardar Impuesto"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
