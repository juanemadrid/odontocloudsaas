// src/modules/config/EmpresaCategorias.jsx
// ============================================================
// 🏷️ Categorías Inventario - OdontoCloud
// Diseño compacto, limpio y estructurado sin desperdicio de espacio.
// ============================================================
import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiTag, FiArrowLeft, FiSave } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { subscribeToCategories, createCategory, updateCategory, deleteCategory } from '../../services/resourceService';

const categorySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    descripcion: z.string().optional()
});

export default function EmpresaCategorias() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();
    const [categories, setCategories] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState("");
    const [view, setView] = useState("list"); // list, editor
    const [editingItem, setEditingItem] = useState(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting }, setValue } = useForm({
        resolver: zodResolver(categorySchema)
    });

    useEffect(() => {
        if (!inquilino) return;
        const unsub = subscribeToCategories(inquilino, (data) => {
            setCategories(data);
            setFiltered(data);
        });
        return () => unsub();
    }, [inquilino]);

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(categories);
        } else {
            const lower = search.toLowerCase();
            setFiltered(categories.filter(c => c.nombre.toLowerCase().includes(lower)));
        }
    }, [search, categories]);

    const handleOpenEditor = (item = null) => {
        setEditingItem(item);
        if (item) {
            setValue('nombre', item.nombre);
            setValue('descripcion', item.descripcion || "");
        } else {
            reset({ nombre: '', descripcion: '' });
        }
        setView("editor");
    };

    const onSubmit = async (data) => {
        if (!inquilino) return;
        try {
            if (editingItem) {
                await updateCategory(editingItem.id, data);
                toast.success("Categoría actualizada");
            } else {
                await createCategory(inquilino, data);
                toast.success("Categoría creada");
            }
            setView("list");
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Eliminar esta categoría?")) {
            try {
                await deleteCategory(id);
                toast.success("Categoría eliminada");
            } catch (error) {
                toast.error("Error al eliminar");
            }
        }
    };

    if (view === "editor") {
        return (
            <div className="p-4 md:p-6 max-w-lg mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setView("list")}
                                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiArrowLeft size={16} />
                            </button>
                            <div>
                                <h2 className="text-[15px] font-bold text-slate-800">
                                    {editingItem ? "Editar Categoría" : "Nueva Categoría"}
                                </h2>
                                <p className="text-[11px] text-slate-500">Clasificación de productos e insumos</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Nombre de la Categoría *</label>
                            <input
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                {...register("nombre")}
                                placeholder="Ej: Insumos Generales"
                                autoFocus
                            />
                            {errors.nombre && (
                                <p className="text-[11px] text-rose-500 font-semibold mt-1">{errors.nombre.message}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Descripción</label>
                            <textarea
                                className="w-full h-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                {...register("descripcion")}
                                placeholder="Detalle el tipo de productos..."
                            />
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setView("list")}
                                className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FiSave size={15} />
                                )}
                                <span>{isSubmitting ? "Guardando..." : "Guardar"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Header & Bar Acciones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiTag size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Categorías Inventario</h1>
                        <p className="text-[12px] text-slate-500">Clasificación de productos e insumos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Búsqueda */}
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar categoría..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Nuevo Button */}
                    <button
                        onClick={() => handleOpenEditor()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva categoría</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 text-left font-bold text-slate-600">Nombre</th>
                                <th className="py-2.5 px-4 text-left font-bold text-slate-600">Descripción</th>
                                <th className="py-2.5 px-4 text-right font-bold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                                        Sin categorías registradas
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <FiTag size={14} />
                                                </div>
                                                <span className="font-semibold text-slate-800">{item.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4 text-slate-500">
                                            {item.descripcion || "Sin descripción"}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenEditor(item)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={14} />
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
