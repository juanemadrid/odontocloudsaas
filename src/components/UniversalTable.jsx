import React, { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export default function UniversalTable({ collectionName, title, schema }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, collectionName));
            const snap = await getDocs(q);
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [collectionName]);

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar registro?")) return;
        try {
            await deleteDoc(doc(db, collectionName, id));
            load();
        } catch (e) { alert("Error al eliminar"); }
    };

    return (
        <div className="card animation-fade-in-up">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                <button className="btn blue" onClick={() => { setCurrentItem({}); setModalOpen(true); }}>
                    + Agregar
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                            {schema.map(field => <th key={field.key} className="p-3">{field.label}</th>)}
                            <th className="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {loading && <tr><td colSpan={schema.length + 1} className="p-4 text-center">Cargando...</td></tr>}
                        {!loading && items.length === 0 && <tr><td colSpan={schema.length + 1} className="p-4 text-center text-slate-400">Sin datos.</td></tr>}
                        {items.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                {schema.map(field => (
                                    <td key={field.key} className="p-3">
                                        {field.type === 'date' && item[field.key] ? new Date(item[field.key]).toLocaleDateString() :
                                            field.type === 'boolean' ? (item[field.key] ? 'Sí' : 'No') :
                                                item[field.key]}
                                    </td>
                                ))}
                                <td className="p-3 text-right">
                                    <button onClick={() => { setCurrentItem(item); setModalOpen(true); }} className="text-blue-600 mr-2 hover:underline">Editar</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <UniModal
                    item={currentItem}
                    onClose={() => setModalOpen(false)}
                    schema={schema}
                    collectionName={collectionName}
                    onSuccess={() => { setModalOpen(false); load(); }}
                />
            )}
        </div>
    );
}

function UniModal({ item, onClose, schema, collectionName, onSuccess }) {
    const [form, setForm] = useState(item || {});

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (item.id) {
                await updateDoc(doc(db, collectionName, item.id), form);
            } else {
                await addDoc(collection(db, collectionName), { ...form, createdAt: new Date().toISOString() });
            }
            onSuccess();
        } catch (e) { alert("Error al guardar"); }
    };

    return (
        <div className="odc-modal" style={{ zIndex: 9999 }}>
            <div className="odc-modal-backdrop" onClick={onClose} />
            <div className="odc-card" style={{ width: 400 }}>
                <h3 className="odc-title mb-4">{item.id ? "Editar" : "Crear"}</h3>
                <form onSubmit={handleSubmit} className="grid gap-3">
                    {schema.map(field => (
                        <div key={field.key}>
                            <label className="text-xs font-bold text-slate-500">{field.label}</label>
                            {field.type === 'boolean' ? (
                                <select
                                    className="form-input w-full"
                                    value={form[field.key] || ""}
                                    onChange={e => setForm({ ...form, [field.key]: e.target.value === 'true' })}
                                >
                                    <option value="false">No</option>
                                    <option value="true">Sí</option>
                                </select>
                            ) : field.type === 'date' ? (
                                <input
                                    type="date"
                                    className="form-input w-full"
                                    value={form[field.key] || ""}
                                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                />
                            ) : (
                                <input
                                    className="form-input w-full"
                                    value={form[field.key] || ""}
                                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                />
                            )}
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 mt-2">
                        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn blue">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
