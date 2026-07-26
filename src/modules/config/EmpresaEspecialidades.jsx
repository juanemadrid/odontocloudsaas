// src/modules/config/EmpresaEspecialidades.jsx
import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiActivity, FiArrowLeft, FiSave } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty } from '../../services/resourceService';

const specialtySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    descripcion: z.string().optional()
});

function EspecialidadEditor({ item, onBack, inquilino }) {
    const toast = useToast();
    const { register, handleSubmit, reset, formState: { errors, isSubmitting }, setValue } = useForm({
        resolver: zodResolver(specialtySchema),
        defaultValues: {
            nombre: item?.nombre || "",
            descripcion: item?.descripcion || ""
        }
    });

    useEffect(() => {
        if (item) {
            setValue('nombre', item.nombre);
            setValue('descripcion', item.descripcion || "");
        } else {
            reset({ nombre: '', descripcion: '' });
        }
    }, [item, reset, setValue]);

    const onSubmit = async (data) => {
        if (!inquilino) return;
        try {
            if (item?.id) {
                await updateSpecialty(inquilino, item.id, data);
                if (toast?.success) toast.success("Especialidad actualizada en Supabase");
            } else {
                await createSpecialty(inquilino, data);
                if (toast?.success) toast.success("Especialidad creada en Supabase");
            }
            onBack();
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al guardar especialidad");
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md max-w-lg mx-auto overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-[16px] font-black text-slate-800 uppercase">
                            {item ? "Editar Especialidad" : "Nueva Especialidad"}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">Gestión de áreas y ramas odontológicas</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre de Especialidad *</label>
                    <input
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        {...register("nombre")}
                        placeholder="Ej. Ortodoncia, Periodoncia, Endodoncia"
                        autoFocus
                    />
                    {errors.nombre && (
                        <span className="text-[10px] text-rose-500 font-semibold">{errors.nombre.message}</span>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Descripción / Detalles</label>
                    <textarea
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                        {...register("descripcion")}
                        placeholder="Breve descripción del alcance del área clínica..."
                    />
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        <FiSave size={15} />
                        <span>{isSubmitting ? "Guardando..." : "Guardar Especialidad"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function EmpresaEspecialidades() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const [specialties, setSpecialties] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);

    const loadData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const data = await getSpecialties(inquilino);
            setSpecialties(data);
            setFiltered(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [inquilino]);

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(specialties);
        } else {
            const lower = search.toLowerCase();
            setFiltered(specialties.filter(s => (s.nombre || "").toLowerCase().includes(lower)));
        }
    }, [search, specialties]);

    const handleDelete = async (id, nombre) => {
        if (window.confirm(`⚠️ ¿Seguro que deseas eliminar la especialidad "${nombre || ''}"?`)) {
            try {
                await deleteSpecialty(inquilino, id);
                setSpecialties(prev => prev.filter(s => s.id !== id));
                if (toast?.success) toast.success("Especialidad eliminada correctamente");
                else alert("✅ Especialidad eliminada correctamente");
            } catch (error) {
                console.error(error);
                if (toast?.error) toast.error("Error al eliminar especialidad");
            }
        }
    };

    if (view === "editor") {
        return <EspecialidadEditor item={editingItem} onBack={() => { setView("list"); loadData(); }} inquilino={inquilino} />;
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiActivity size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Especialidades Médicas</h1>
                        <p className="text-xs font-medium text-slate-500">Áreas clínicas y disciplinas odontológicas</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar especialidad..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Especialidad</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre de la Especialidad</th>
                            <th className="py-3 px-4">Descripción</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && filtered.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando especialidades...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No hay especialidades registradas
                                </td>
                            </tr>
                        ) : (
                            filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                🩺
                                            </div>
                                            <span className="font-bold text-slate-800">{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 font-medium">{item.descripcion || "-"}</td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(item); setView("editor"); }}
                                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Editar"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id, item.nombre)}
                                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
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
    );
}
