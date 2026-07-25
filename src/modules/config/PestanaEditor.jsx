
import React, { useState, useEffect } from "react";
import { FiArrowLeft, FiSave, FiList, FiType, FiCalendar, FiCheckSquare, FiHash, FiTrash2, FiFileText } from "react-icons/fi";
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useToast } from "../../context/ToastContext";

export default function PestanaEditor({ id, onBack, inquilino, userEmail, currentOrder }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");

    // Fields structure: { id, type, label, required, options? }
    const [fields, setFields] = useState([]);

    useEffect(() => {
        if (id && inquilino) {
            loadTab();
        }
    }, [id, inquilino]);

    const loadTab = async () => {
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, "tenants", inquilino, "pestanas_medicas", id));
            if (snap.exists()) {
                const data = snap.data();
                setNombre(data.nombre || "");
                setDescripcion(data.descripcion || "");
                setFields(data.campos || []);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar pestaña");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!nombre.trim()) return toast.warning("Asigne un nombre a la pestaña");
        // Description is optional

        setLoading(true);
        try {
            const payload = {
                nombre,
                descripcion,
                campos: fields,
                updatedAt: serverTimestamp(),
                updatedBy: userEmail
            };

            if (id) {
                await updateDoc(doc(db, "tenants", inquilino, "pestanas_medicas", id), payload);
                toast.success("Pestaña actualizada");
            } else {
                await addDoc(collection(db, "tenants", inquilino, "pestanas_medicas"), {
                    ...payload,
                    orden: currentOrder || 0, // Append to end
                    createdAt: serverTimestamp(),
                    createdBy: userEmail
                });
                toast.success("Pestaña creada");
            }
            onBack();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const addField = (type) => {
        const newField = {
            id: Date.now().toString(),
            type,
            label: type === "text" ? "Nuevo Campo" : type === "date" ? "Fecha" : "Campo",
            required: false,
            options: type === "select" ? ["Opción 1", "Opción 2"] : []
        };
        setFields([...fields, newField]);
    };

    const updateField = (id, key, value) => {
        setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
    };

    const removeField = (id) => {
        setFields(fields.filter(f => f.id !== id));
    };

    // Mock Toolbox items
    const TOOLS = [
        { type: "section", label: "Sección / Título", icon: FiList },
        { type: "text", label: "Campo de Texto", icon: FiType },
        { type: "number", label: "Número", icon: FiHash },
        { type: "textarea", label: "Área de texto", icon: FiFileText },
        { type: "date", label: "Campo de Fecha", icon: FiCalendar },
        { type: "select", label: "Seleccionable", icon: FiCheckSquare },
    ];

    return (
        <div className="emp-card" style={{ maxWidth: "100%", height: "calc(100vh - 140px)", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={onBack} className="oc-btn-cancel" style={{ border: "1px solid #e2e8f0", padding: 8, height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiArrowLeft size={18} />
                    </button>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <input
                            className="emp-input"
                            placeholder="Nombre de la pestaña (ej. Antecedentes)"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            style={{ fontSize: 18, fontWeight: 700, margin: 0, border: "none", background: "transparent", width: 300 }}
                        />
                        <input
                            className="emp-input"
                            placeholder="Descripción opcional"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            style={{ fontSize: 12, margin: 0, border: "none", background: "transparent", width: 300, color: "#64748b" }}
                        />
                    </div>
                </div>
                <button className="oc-btn-save" onClick={handleSave} disabled={loading}>
                    {loading ? "Guardando..." : "Guardar"}
                </button>
            </div>

            {/* Workspace */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Canvas (Center) */}
                <div style={{ flex: 1, background: "#f1f5f9", padding: 24, overflowY: "auto", display: "flex", justifyContent: "center" }}>
                    <div style={{ width: "210mm", minHeight: "297mm", background: "white", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: 40, position: "relative" }}>
                        {fields.length === 0 ? (
                            <div style={{ border: "2px dashed #e2e8f0", borderRadius: 8, padding: 40, height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                                Diseñe el formulario de la pestaña
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {fields.map((field) => (
                                    <div key={field.id} className="group" style={{
                                        position: "relative", padding: 12, border: "1px solid transparent", borderRadius: 6,
                                        hover: { border: "1px dashed #cbd5e1" }
                                    }}>
                                        <button onClick={() => removeField(field.id)} style={{ position: "absolute", right: 0, top: 0, padding: 4, color: "#ef4444" }}>
                                            <FiTrash2 />
                                        </button>

                                        <input
                                            value={field.label}
                                            onChange={e => updateField(field.id, "label", e.target.value)}
                                            className="w-full font-semibold text-slate-700 bg-transparent border-none focus:ring-0 mb-1"
                                            placeholder="Etiqueta del campo"
                                        />

                                        {field.type === "section" && <div style={{ height: 2, background: "#e2e8f0", margin: "8px 0" }}></div>}
                                        {field.type === "text" && <input disabled className="emp-input" placeholder="Texto corto..." />}
                                        {field.type === "number" && <input disabled type="number" className="emp-input" placeholder="0" />}
                                        {field.type === "textarea" && <textarea disabled className="emp-input" rows={3} placeholder="Texto largo..." />}
                                        {field.type === "date" && <input disabled type="date" className="emp-input" />}
                                        {field.type === "select" && (
                                            <div>
                                                <select disabled className="emp-input">
                                                    {field.options.map((op, i) => <option key={i}>{op}</option>)}
                                                </select>
                                                <div style={{ marginTop: 4, fontSize: 11, color: "blue", cursor: "pointer" }} onClick={() => {
                                                    const opts = prompt("Opciones separadas por coma:", field.options.join(","));
                                                    if (opts) updateField(field.id, "options", opts.split(","));
                                                }}>Editar Opciones</div>
                                            </div>
                                        )}

                                        <div style={{ marginTop: 4 }}>
                                            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, "required", e.target.checked)} />
                                                Obligatorio
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Toolbox (Right) */}
                <div style={{ width: 260, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: 13, color: "#475569" }}>
                        Herramientas
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                        <div style={{ display: "grid", gap: 8 }}>
                            {TOOLS.map((t, i) => (
                                <div key={i} onClick={() => addField(t.type)} style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                    background: "white", border: "1px solid #e2e8f0", borderRadius: 6,
                                    cursor: "pointer", fontSize: 13, color: "#334155", fontWeight: 500,
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                    transition: "all 0.2s"
                                }}>
                                    <t.icon /> {t.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
