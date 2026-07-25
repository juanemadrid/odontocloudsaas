import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiActivity, FiArrowLeft, FiSave } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { subscribeToSpecialties, createSpecialty, updateSpecialty, deleteSpecialty } from '../../services/resourceService';

const specialtySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    descripcion: z.string().optional()
});

// Compact Editor Component for Especialidad
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
                await updateSpecialty(item.id, data);
                if (toast?.success) toast.success("Especialidad actualizada correctamente");
            } else {
                await createSpecialty(inquilino, data);
                if (toast?.success) toast.success("Especialidad creada correctamente");
            }
            onBack();
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al guardar especialidad");
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800">
                            {item ? "Editar Especialidad" : "Nueva Especialidad"}
                        </h2>
                        <p className="text-[11px] text-slate-500">Gestión de áreas y ramas odontológicas</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre de Especialidad *</label>
                    <input
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                        {...register("descripcion")}
                        placeholder="Breve descripción del alcance del área clínica..."
                    />
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
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
                        <span>{isSubmitting ? "Guardando..." : "Guardar Especialidad"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

// Main List Component
export default function EmpresaEspecialidades() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();
    const [specialties, setSpecialties] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState("");
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        if (!inquilino) return;
        const unsub = subscribeToSpecialties(inquilino, (data) => {
            setSpecialties(data);
            setFiltered(data);
        });
        return () => unsub();
    }, [inquilino]);

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(specialties);
        } else {
            const lower = search.toLowerCase();
            setFiltered(specialties.filter(s => s.nombre.toLowerCase().includes(lower)));
        }
    }, [search, specialties]);

    const handleOpenEditor = (item = null) => {
        setEditingItem(item);
        setView("editor");
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de eliminar esta especialidad?")) {
            try {
                await deleteSpecialty(id);
                if (toast?.success) toast.success("Especialidad eliminada correctamente");
            } catch (error) {
                if (toast?.error) toast.error("Error al eliminar especialidad");
            }
        }
    };

    if (view === "editor") {
        return <EspecialidadEditor item={editingItem} onBack={() => setView("list")} inquilino={inquilino} />;
    }

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiActivity size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Especialidades</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Catálogo de áreas médicas y disciplinas odontológicas</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar especialidad..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => handleOpenEditor()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Especialidad</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre de la Especialidad</th>
                            <th className="py-2.5 px-4">Descripción</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron especialidades registradas
                                </td>
                            </tr>
                        ) : (
                            filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                🩺
                                            </div>
                                            <span className="font-bold text-slate-800">{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className="text-slate-500">{item.descripcion || "Sin descripción"}</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenEditor(item)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Especialidad"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Especialidad"
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
        </div>
    );
}
