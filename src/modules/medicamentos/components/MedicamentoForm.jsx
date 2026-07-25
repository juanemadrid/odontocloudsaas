import React, { useState, useEffect } from "react";
import { FiArrowLeft, FiSave, FiAlertCircle } from "react-icons/fi";
import { collection, doc, getDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function MedicamentoForm({ id, onCancel, onSuccess }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form State
    const [tipo, setTipo] = useState("Otros");
    const [codigo, setCodigo] = useState("");
    const [principioActivo, setPrincipioActivo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [marca, setMarca] = useState("");

    useEffect(() => {
        if (!id) return;
        const loadMedicine = async () => {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, "medicamentos", id));
                if (snap.exists()) {
                    const data = snap.data();
                    setTipo(data.tipo || "Otros");
                    setCodigo(data.codigo || "");
                    setPrincipioActivo(data.principio_activo || data.nombre || "");
                    setDescripcion(data.descripcion || "");
                    setMarca(data.marca || "");
                }
            } catch (err) {
                console.error("Error loading medicine:", err);
                setError("Error al cargar la información del medicamento");
            } finally {
                setLoading(false);
            }
        };
        loadMedicine();
    }, [id]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!codigo.trim() || !principioActivo.trim()) {
            setError("Los campos Código y Principio Activo son obligatorios.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const medData = {
                tipo,
                codigo: codigo.trim(),
                principio_activo: principioActivo.trim(),
                nombre: principioActivo.trim(), // Save both for auto-complete fallback
                descripcion: descripcion.trim(),
                marca: marca.trim(),
                inquilino,
                updatedAt: serverTimestamp()
            };

            if (id) {
                await updateDoc(doc(db, "medicamentos", id), medData);
                toast.success("Medicamento actualizado correctamente");
            } else {
                await addDoc(collection(db, "medicamentos"), {
                    ...medData,
                    createdAt: serverTimestamp()
                });
                toast.success("Medicamento creado correctamente");
            }
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Error saving medicine:", err);
            setError("Error al guardar el medicamento en la base de datos.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Cargando datos...</span>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
            {/* Header / Top Action Bar */}
            <div className="flex items-center justify-between bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
                        title="Volver"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {id ? "Modificar" : "Nuevo"} registro
                        </span>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-0.5">
                            {id ? "Editar Medicamento" : "Nuevo Medicamento"}
                        </h2>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
                >
                    <FiSave className="mr-2" size={14} />
                    {saving ? "Guardando..." : "Guardar"}
                </button>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-[24px] flex items-center gap-4 animate-in shake">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-rose-500/20 shrink-0">
                        <FiAlertCircle />
                    </div>
                    <div>
                        <h4 className="text-rose-800 font-black uppercase text-sm">Error de Validación</h4>
                        <p className="text-rose-600 text-xs font-medium uppercase tracking-wide">{error}</p>
                    </div>
                </div>
            )}

            {/* Input card */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información básica</h3>
                </div>
                <div className="p-8 space-y-6">
                    {/* Tipo Dropdown */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo *</label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full max-w-md h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                        >
                            <option value="POS">POS</option>
                            <option value="NO POS">NO POS</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>

                    {/* Código */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Código *</label>
                        <input
                            type="text"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value)}
                            placeholder="Código del medicamento"
                            className="w-full max-w-md h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                            required
                        />
                    </div>

                    {/* Principio Activo */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Principio activo *</label>
                        <input
                            type="text"
                            value={principioActivo}
                            onChange={(e) => setPrincipioActivo(e.target.value)}
                            placeholder="Principio activo del medicamento"
                            className="w-full max-w-md h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                            required
                        />
                    </div>

                    {/* Descripción */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción</label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Descripción del medicamento"
                            className="w-full max-w-lg h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>

                    {/* Marca */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Marca</label>
                        <input
                            type="text"
                            value={marca}
                            onChange={(e) => setMarca(e.target.value)}
                            placeholder="Marca para el medicamento"
                            className="w-full max-w-md h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex justify-end bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
                >
                    <FiSave className="mr-2" size={14} />
                    {saving ? "Guardando..." : "Guardar"}
                </button>
            </div>
        </form>
    );
}
