import React, { useState, useEffect } from "react";
import { FiArrowLeft, FiSave, FiAlertCircle, FiPlus, FiTrash2 } from "react-icons/fi";
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const VIAS_ADMINISTRACION = [
    "Oral", "Tópica", "Infiltración Local", "Sublingual", "Intramuscular", "Intravenosa", "Otros"
];

export default function PlanFormulacionForm({ id, onCancel, onSuccess }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form State
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [planMeds, setPlanMeds] = useState([]);

    // Autocomplete / Search input state
    const [searchMedText, setSearchMedText] = useState("");
    const [medicamentosList, setMedicamentosList] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Load available medicines for autocomplete
    useEffect(() => {
        if (!inquilino) return;
        const loadCatalog = async () => {
            try {
                const q = query(collection(db, "medicamentos"), where("inquilino", "==", inquilino));
                const snap = await getDocs(q);
                setMedicamentosList(snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                })));
            } catch (err) {
                console.error("Error loading medicines catalog:", err);
            }
        };
        loadCatalog();
    }, [inquilino]);

    // Load plan details if editing
    useEffect(() => {
        if (!id) return;
        const loadPlan = async () => {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, "planes_formulacion", id));
                if (snap.exists()) {
                    const data = snap.data();
                    setNombre(data.nombre || "");
                    setDescripcion(data.descripcion || "");
                    setPlanMeds(data.medicamentos || []);
                }
            } catch (err) {
                console.error("Error loading plan:", err);
                setError("Error al cargar la información del plan de formulación");
            } finally {
                setLoading(false);
            }
        };
        loadPlan();
    }, [id]);

    // Autocomplete filter
    const suggestedMeds = searchMedText.trim()
        ? medicamentosList.filter(m => 
            (m.principio_activo || "").toLowerCase().includes(searchMedText.toLowerCase()) ||
            (m.descripcion || "").toLowerCase().includes(searchMedText.toLowerCase())
          )
        : [];

    const handleAddMedicine = (selectedMed) => {
        if (!selectedMed) return;
        
        // Prevent duplicate medicines in the same plan
        if (planMeds.some(m => m.principio_activo === selectedMed.principio_activo)) {
            toast.warning("Este medicamento ya ha sido agregado al plan.");
            setSearchMedText("");
            setShowSuggestions(false);
            return;
        }

        const newRow = {
            tipo: selectedMed.tipo || "Otros",
            codigo: selectedMed.codigo || "",
            principio_activo: selectedMed.principio_activo || "",
            dosis: "",
            frecuencia: "",
            via: "Oral",
            duracion: "",
            cantidad: "",
            descripcion: selectedMed.descripcion || "",
            marca: selectedMed.marca || ""
        };

        setPlanMeds(prev => [...prev, newRow]);
        setSearchMedText("");
        setShowSuggestions(false);
    };

    // Add custom medication not in database
    const handleAddCustom = () => {
        if (!searchMedText.trim()) return;

        // Prevent duplicate
        if (planMeds.some(m => m.principio_activo.toLowerCase() === searchMedText.trim().toLowerCase())) {
            toast.warning("Este medicamento ya ha sido agregado al plan.");
            setSearchMedText("");
            setShowSuggestions(false);
            return;
        }

        const newRow = {
            tipo: "Otros",
            codigo: "Custom",
            principio_activo: searchMedText.trim(),
            dosis: "",
            frecuencia: "",
            via: "Oral",
            duracion: "",
            cantidad: "",
            descripcion: "",
            marca: ""
        };

        setPlanMeds(prev => [...prev, newRow]);
        setSearchMedText("");
        setShowSuggestions(false);
    };

    const handleRemoveRow = (idx) => {
        setPlanMeds(prev => prev.filter((_, i) => i !== idx));
    };

    const handleRowChange = (idx, field, val) => {
        setPlanMeds(prev => prev.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: val };
        }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!nombre.trim()) {
            setError("El Nombre del Plan es obligatorio.");
            return;
        }

        if (planMeds.length === 0) {
            setError("Debe agregar al menos un medicamento al plan de formulación.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const planData = {
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                medicamentos: planMeds.map(m => ({
                    tipo: m.tipo || "Otros",
                    codigo: m.codigo || "",
                    principio_activo: m.principio_activo.trim(),
                    medicamento: m.principio_activo.trim(),
                    dosis: (m.dosis || "").trim(),
                    frecuencia: (m.frecuencia || "").trim(),
                    via: m.via || "Oral",
                    duracion: (m.duracion || "").trim(),
                    cantidad: (m.cantidad || "").trim(),
                    descripcion: (m.descripcion || "").trim(),
                    marca: (m.marca || "").trim()
                })),
                inquilino,
                updatedAt: serverTimestamp()
            };

            if (id) {
                await updateDoc(doc(db, "planes_formulacion", id), planData);
                toast.success("Plan de formulación actualizado correctamente");
            } else {
                await addDoc(collection(db, "planes_formulacion"), {
                    ...planData,
                    createdAt: serverTimestamp()
                });
                toast.success("Plan de formulación creado correctamente");
            }
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Error saving formulation plan:", err);
            setError("Error al guardar el plan de formulación en la base de datos.");
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
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-500 max-w-7xl">
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
                            {id ? "Editar Plan de Formulación" : "Nuevo Plan de Formulación"}
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

            {/* Input Card: Datos Generales */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información básica</h3>
                </div>
                <div className="p-8 space-y-6">
                    {/* Inline Nombre + Add Med Field */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
                        {/* Nombre */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del plan *</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Nombres del plan de formulación"
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                required
                            />
                        </div>

                        {/* Add Medication Search Bar */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ingresa el medicamento a añadir</label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={searchMedText}
                                        onChange={(e) => {
                                            setSearchMedText(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder="Buscar por principio activo..."
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    />
                                    {/* Suggestions dropdown */}
                                    {showSuggestions && searchMedText.trim() && (
                                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50">
                                            {suggestedMeds.length === 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustom}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-blue-600 hover:bg-slate-50 flex items-center justify-between"
                                                >
                                                    <span>Añadir como nuevo: "{searchMedText}"</span>
                                                    <span className="bg-blue-50 px-2 py-0.5 rounded-full text-[9px] font-black">NUEVO</span>
                                                </button>
                                            ) : (
                                                suggestedMeds.map(med => (
                                                    <button
                                                        key={med.id}
                                                        type="button"
                                                        onClick={() => handleAddMedicine(med)}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <span className="text-xs font-black text-slate-800 uppercase">{med.principio_activo}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">{med.descripcion || "Sin descripción"} • {med.marca || "Sin marca"}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddCustom}
                                    className="h-11 px-6 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
                                >
                                    Añadir
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción del plan</label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Descripción opcional sobre el propósito o uso clínico de esta receta predefinida"
                            className="w-full max-w-2xl h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Input Card: Table of added medications */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Medicamentos en este plan</h3>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Total: {planMeds.length}
                    </span>
                </div>
                <div className="p-6">
                    {planMeds.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic text-sm">
                            Sin datos. Use la barra de búsqueda superior para ingresar y añadir medicamentos al plan.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="py-3 px-3 w-28">Tipo</th>
                                        <th className="py-3 px-3 w-24">Código</th>
                                        <th className="py-3 px-3">Principio Activo</th>
                                        <th className="py-3 px-3 w-32">Dosis</th>
                                        <th className="py-3 px-3 w-40">Frecuencia</th>
                                        <th className="py-3 px-3 w-40">Vía de administración</th>
                                        <th className="py-3 px-3 w-32">Duración</th>
                                        <th className="py-3 px-3 w-24">Cantidad</th>
                                        <th className="py-3 px-3">Descripción</th>
                                        <th className="py-3 px-3 w-28">Marca</th>
                                        <th className="py-3 px-3 text-center w-16">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-xs">
                                    {planMeds.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/20">
                                            {/* Tipo (Readonly) */}
                                            <td className="py-3 px-2 font-semibold text-slate-400">{row.tipo}</td>
                                            
                                            {/* Código (Readonly) */}
                                            <td className="py-3 px-2 font-bold text-slate-500">{row.codigo}</td>
                                            
                                            {/* Principio Activo (Readonly) */}
                                            <td className="py-3 px-2 font-black text-slate-800 uppercase">{row.principio_activo}</td>

                                            {/* Dosis */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    value={row.dosis}
                                                    onChange={(e) => handleRowChange(idx, "dosis", e.target.value)}
                                                    placeholder="Dosis"
                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                                />
                                            </td>

                                            {/* Frecuencia */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    value={row.frecuencia}
                                                    onChange={(e) => handleRowChange(idx, "frecuencia", e.target.value)}
                                                    placeholder="Frecuencia"
                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                                />
                                            </td>

                                            {/* Vía */}
                                            <td className="py-3 px-2">
                                                <select
                                                    value={row.via}
                                                    onChange={(e) => handleRowChange(idx, "via", e.target.value)}
                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                                                >
                                                    {VIAS_ADMINISTRACION.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Duración */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    value={row.duracion}
                                                    onChange={(e) => handleRowChange(idx, "duracion", e.target.value)}
                                                    placeholder="Duración"
                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                                />
                                            </td>

                                            {/* Cantidad */}
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    value={row.cantidad}
                                                    onChange={(e) => handleRowChange(idx, "cantidad", e.target.value)}
                                                    placeholder="Cantidad"
                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                                />
                                            </td>

                                            {/* Descripción (Readonly) */}
                                            <td className="py-3 px-2 text-slate-400 font-semibold truncate max-w-[150px]">{row.descripcion || "—"}</td>

                                            {/* Marca (Readonly) */}
                                            <td className="py-3 px-2 text-slate-400 font-bold">{row.marca || "—"}</td>

                                            {/* Acciones */}
                                            <td className="py-3 px-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all shadow-sm mx-auto"
                                                    title="Eliminar del plan"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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
