import React, { useState, useEffect } from "react";
import { FiSearch, FiEye, FiTrash2, FiEdit2, FiPlus, FiFileText, FiCalendar, FiUser } from "react-icons/fi";
import { collection, query, orderBy, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import PlantillaEditor from "./PlantillaEditor";
import { PREDEFINED_TEMPLATES } from "../../data/plantillasPredeterminadas";

export default function ConfigPlantillas() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const [view, setView] = useState("list");
    const [selectedId, setSelectedId] = useState(null);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!inquilino || view !== "list") return;

        setLoading(true);
        const q = query(
            collection(db, "tenants", inquilino, "plantillas_clinicas"),
            orderBy("nombre", "asc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const dbTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRows([...PREDEFINED_TEMPLATES, ...dbTemplates]);
            setLoading(false);
        }, (err) => {
            console.error(err);
            if (toast?.error) toast.error("Error al sincronizar plantillas");
            setLoading(false);
        });

        return () => unsub();
    }, [inquilino, view]);

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que desea eliminar esta plantilla? Esta acción es irreversible.")) return;
        try {
            await deleteDoc(doc(db, "tenants", inquilino, "plantillas_clinicas", id));
            if (toast?.success) toast.success("Plantilla eliminada correctamente");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al eliminar la plantilla");
        }
    };

    const formatDate = (iso) => {
        if (!iso) return "SIN FECHA";
        const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
        return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    if (view === "editor") {
        return (
            <PlantillaEditor
                id={selectedId}
                isViewOnly={isViewOnly}
                onBack={() => {
                    setView("list");
                    setSelectedId(null);
                    setIsViewOnly(false);
                }}
                inquilino={inquilino}
                userEmail={userProfile?.email}
            />
        );
    }

    const filtered = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiFileText size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Plantillas Clínicas</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Configuración de formatos de anamnesis, historia clínica y consentimientos</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar plantilla o formato..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => { setSelectedId(null); setView("editor"); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Plantilla</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Fecha Registro</th>
                            <th className="py-2.5 px-4">Tipo / Nombre de Plantilla</th>
                            <th className="py-2.5 px-4">Creado Por</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando plantillas clínicas...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron plantillas clínicas registradas
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4 font-medium text-slate-500 text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                            <FiCalendar size={13} className="text-slate-400" />
                                            <span>{formatDate(row.createdAt || row.fecha)}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                📄
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 uppercase block">{row.nombre}</span>
                                                <span className="text-[10px] text-blue-600 font-semibold">
                                                    {row.campos?.length || 0} CAMPOS CONFIGURADOS
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-500 font-medium text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                            <FiUser size={12} className="text-slate-400" />
                                            <span>{row.createdBy || "Sistema"}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setSelectedId(row.id); setView("editor"); setIsViewOnly(true); }}
                                                className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Ver Vista Previa"
                                            >
                                                <FiEye size={13} />
                                            </button>
                                            {!row.isSystem && (
                                                <>
                                                    <button
                                                        onClick={() => { setSelectedId(row.id); setView("editor"); setIsViewOnly(false); }}
                                                        className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Editar Plantilla"
                                                    >
                                                        <FiEdit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(row.id)}
                                                        className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Eliminar Plantilla"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </>
                                            )}
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
