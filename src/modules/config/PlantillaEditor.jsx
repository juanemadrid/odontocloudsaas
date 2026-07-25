import React, { useState, useEffect } from "react";
import { FiArrowLeft, FiSave, FiList, FiType, FiCalendar, FiCheckSquare, FiTrash2, FiFileText, FiLayout, FiHash as FiNumber } from "react-icons/fi";
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useToast } from "../../context/ToastContext";
import { PREDEFINED_TEMPLATES } from "../../data/plantillasPredeterminadas";

export default function PlantillaEditor({ id, isViewOnly = false, onBack, inquilino, userEmail }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nombre, setNombre] = useState("");
    const [fields, setFields] = useState([]);
    const [terceraFirma, setTerceraFirma] = useState(false);

    useEffect(() => {
        if (id) {
            const pred = PREDEFINED_TEMPLATES.find(t => t.id === id);
            if (pred) {
                setNombre(pred.nombre || "");
                setFields(pred.campos || []);
                setTerceraFirma(pred.campos.some(f => f.id === 'tercera_firma') || false);
            } else if (inquilino) {
                loadTemplate();
            }
        }
    }, [id, inquilino]);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, "tenants", inquilino, "plantillas_clinicas", id));
            if (snap.exists()) {
                const data = snap.data();
                setNombre(data.nombre || "");
                setFields(data.campos || []);
                setTerceraFirma(data.terceraFirma || false);
            }
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al cargar la plantilla");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!nombre.trim()) {
            if (toast?.warning) toast.warning("Asigne un nombre a la plantilla");
            return;
        }
        if (fields.length === 0) {
            if (toast?.warning) toast.warning("Agregue al menos un campo al documento");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nombre: nombre.toUpperCase(),
                campos: fields,
                terceraFirma: terceraFirma,
                updatedAt: serverTimestamp(),
                updatedBy: userEmail
            };

            if (id) {
                await updateDoc(doc(db, "tenants", inquilino, "plantillas_clinicas", id), payload);
                if (toast?.success) toast.success("Documento actualizado con éxito");
            } else {
                await addDoc(collection(db, "tenants", inquilino, "plantillas_clinicas"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdBy: userEmail
                });
                if (toast?.success) toast.success("Nuevo formato clínico registrado");
            }
            onBack();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al procesar la solicitud");
        } finally {
            setSaving(false);
        }
    };

    const addField = (type) => {
        const newField = {
            id: Date.now().toString(),
            type,
            label: type === "text" ? "NUEVO CAMPO DE TEXTO" : type === "date" ? "FECHA DEL DOCUMENTO" : type === "select" ? "OPCIONES DE SELECCIÓN" : type === "section" ? "TÍTULO DE SECCIÓN" : "NUEVO CAMPO",
            required: false,
            options: type === "select" ? ["OPCIÓN 1", "OPCIÓN 2"] : []
        };
        setFields([...fields, newField]);
    };

    const updateField = (fieldId, key, value) => {
        setFields(fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f));
    };

    const removeField = (fieldId) => {
        setFields(fields.filter(f => f.id !== fieldId));
    };

    const TOOLS = [
        { type: "section", label: "TÍTULO / SECCIÓN", icon: FiList, color: "text-blue-600 bg-blue-50 border-blue-100" },
        { type: "text", label: "TEXTO CORTO", icon: FiType, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        { type: "number", label: "NÚMERICO", icon: FiNumber, color: "text-amber-600 bg-amber-50 border-amber-100" },
        { type: "date", label: "FECHA", icon: FiCalendar, color: "text-purple-600 bg-purple-50 border-purple-100" },
        { type: "select", label: "SELECCIONABLE", icon: FiCheckSquare, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
        { type: "textarea", label: "TEXTO LARGO", icon: FiFileText, color: "text-rose-600 bg-rose-50 border-rose-100" },
    ];

    const VARIABLES = ["[NombrePaciente]", "[TipoDocumento]", "[Documento]", "[Doctor]", "[Telefono]", "[Ciudad]"];

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                        title="Volver"
                    >
                        <FiArrowLeft size={16} />
                    </button>

                    <div className="flex-1 max-w-md">
                        <input
                            className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors uppercase"
                            placeholder="NOMBRE DE LA PLANTILLA CLÍNICA..."
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            disabled={isViewOnly}
                        />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        {isViewOnly ? "(Solo Lectura)" : "(Edición)"}
                    </span>
                </div>

                {!isViewOnly && (
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0 disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
                        )}
                        <span>{saving ? "Guardando..." : "Guardar Plantilla"}</span>
                    </button>
                )}
            </div>

            {/* Layout Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Canvas Area (Left 3 Columns) */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 min-h-[500px]">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h2 className="text-[14px] font-bold text-slate-800 uppercase tracking-tight">
                            {nombre || "Documento Clínico"}
                        </h2>
                        <span className="text-[11px] text-slate-400 font-medium">
                            {fields.length} campos configurados
                        </span>
                    </div>

                    {fields.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium space-y-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <FiLayout size={32} className="mx-auto text-slate-300" />
                            <p className="text-[13px] font-semibold text-slate-600">No hay campos añadidos en esta plantilla</p>
                            <p className="text-[11px] text-slate-400">Selecciona opciones de la caja de herramientas para agregar elementos</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {fields.map((field) => (
                                <div key={field.id} className="bg-slate-50/80 border border-slate-200 rounded-lg p-3 space-y-2 relative group hover:border-slate-300 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="w-1.5 h-4 bg-blue-600 rounded-full shrink-0"></span>
                                            <input
                                                value={field.label}
                                                onChange={e => updateField(field.id, "label", e.target.value.toUpperCase())}
                                                className="w-full text-[12px] font-bold text-slate-800 bg-transparent border-none outline-none uppercase p-0 focus:ring-0"
                                                placeholder="ETIQUETA DEL CAMPO..."
                                                disabled={isViewOnly}
                                            />
                                        </div>

                                        {!isViewOnly && (
                                            <button
                                                type="button"
                                                onClick={() => removeField(field.id)}
                                                className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-colors border border-rose-100 cursor-pointer"
                                                title="Eliminar campo"
                                            >
                                                <FiTrash2 size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Field Preview Input */}
                                    <div className="pl-3.5 text-[12px]">
                                        {field.type === "section" && <div className="h-0.5 bg-blue-200 rounded-full my-2" />}
                                        {field.type === "text" && (
                                            <div className="w-full h-8 bg-white border border-slate-200 rounded-md px-3 flex items-center text-slate-400 italic text-[11px]">
                                                Entrada de texto corto...
                                            </div>
                                        )}
                                        {field.type === "number" && (
                                            <div className="w-32 h-8 bg-white border border-slate-200 rounded-md px-3 flex items-center text-slate-400 italic text-[11px]">
                                                0000
                                            </div>
                                        )}
                                        {field.type === "textarea" && (
                                            <div className="w-full h-16 bg-white border border-slate-200 rounded-md p-2.5 text-slate-400 italic text-[11px]">
                                                Texto largo o detalle clínico...
                                            </div>
                                        )}
                                        {field.type === "date" && (
                                            <div className="w-40 h-8 bg-white border border-slate-200 rounded-md px-3 flex items-center text-slate-400 italic text-[11px]">
                                                DD / MM / AAAA
                                            </div>
                                        )}
                                        {field.type === "select" && (
                                            <div className="space-y-1.5">
                                                <div className="w-full h-8 bg-white border border-slate-200 rounded-md px-3 flex items-center justify-between text-slate-400 italic text-[11px]">
                                                    <span>Seleccionar opción...</span>
                                                    <FiList size={12} />
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {field.options.map((op, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100">
                                                            {op}
                                                        </span>
                                                    ))}
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors cursor-pointer border-0"
                                                            onClick={() => {
                                                                const opts = prompt("Opciones separadas por coma:", field.options.join(","));
                                                                if (opts) updateField(field.id, "options", opts.split(",").map(o => o.trim().toUpperCase()));
                                                            }}
                                                        >
                                                            + Configurar opciones
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {field.type !== "section" && (
                                        <div className="pl-3.5 pt-1 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`req-${field.id}`}
                                                checked={field.required}
                                                onChange={e => updateField(field.id, "required", e.target.checked)}
                                                disabled={isViewOnly}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <label htmlFor={`req-${field.id}`} className="text-[11px] font-medium text-slate-600 cursor-pointer">
                                                Obligatorio en diligenciamiento
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer Options */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[12px]">
                        <div>
                            <span className="font-bold text-slate-800 block">Tercera Firma</span>
                            <span className="text-[11px] text-slate-500">Habilitar un tercer firmante autorizado en este documento</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={terceraFirma}
                            onChange={(e) => setTerceraFirma(e.target.checked)}
                            disabled={isViewOnly}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Toolbox Panel (Right 1 Column) */}
                {!isViewOnly && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                        <div>
                            <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-tight">Caja de Herramientas</h3>
                            <p className="text-[11px] text-slate-500">Haz clic para agregar al documento</p>
                        </div>

                        <div className="space-y-1.5">
                            {TOOLS.map((t, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => addField(t.type)}
                                    className="w-full flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-colors cursor-pointer"
                                >
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold ${t.color}`}>
                                        <t.icon size={14} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-slate-100 space-y-2">
                            <h4 className="text-[11px] font-bold text-slate-700">Diccionario Dinámico</h4>
                            <div className="flex flex-wrap gap-1">
                                {VARIABLES.map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium border border-slate-200 cursor-pointer transition-colors"
                                        onClick={() => {
                                            navigator.clipboard.writeText(v);
                                            if (toast?.success) toast.success("Copiado: " + v);
                                        }}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
