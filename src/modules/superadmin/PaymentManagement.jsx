import React, { useState, useEffect } from "react";
import { getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, getGlobalConfig, updateGlobalConfig, uploadFile } from "../../services/adminService";
import { FiPlus, FiEdit2, FiTrash2, FiSmartphone, FiCreditCard, FiCheckCircle, FiSave, FiAlertCircle, FiUpload, FiLoader } from "react-icons/fi";
import { FaWhatsapp, FaUniversity, FaSave } from "react-icons/fa";
import { useToast } from "../../context/ToastContext";

export default function PaymentManagement() {
    const toast = useToast();
    const [methods, setMethods] = useState([]);
    const [config, setConfig] = useState({ adminPhone: "" });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [form, setForm] = useState({
        name: "",
        type: "Billetera Digital",
        number: "",
        holder: "",
        logoUrl: "",
        active: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [m, c] = await Promise.all([getPaymentMethods(), getGlobalConfig()]);
            setMethods(m);
            setConfig(c);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar datos de pago");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setIsSaving(true);
            await updateGlobalConfig(config);
            toast.success("Configuración global actualizada");
        } catch (error) {
            toast.error("Error al guardar configuración");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            if (editingId) {
                await updatePaymentMethod(editingId, form);
                toast.success("Método de pago actualizado");
            } else {
                await addPaymentMethod(form);
                toast.success("Nuevo método de pago agregado");
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            toast.error("Error al guardar método de pago");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (m) => {
        setEditingId(m.id);
        setForm({
            name: m.name || "",
            type: m.type || "Billetera Digital",
            number: m.number || m.accountNumber || "",
            holder: m.holder || "",
            logoUrl: m.logoUrl || "",
            active: m.active ?? true
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro de eliminar este método de pago?")) return;
        try {
            await deletePaymentMethod(id);
            toast.success("Método eliminado");
            loadData();
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            const url = await uploadFile(file, "payment_logos");
            setForm(prev => ({ ...prev, logoUrl: url }));
            toast.success("Imagen subida correctamente");
        } catch (error) {
            console.error(error);
            toast.error("Error al subir imagen");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold animate-pulse uppercase tracking-[0.2em]">Cargando motores de pago...</div>;

    return (
        /* Force explicit white background */
        <div className="space-y-10 bg-slate-50/30 min-h-full">
            {/* Global Config Section - Professional Dashboard Banner */}
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 to-indigo-950 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="max-w-md">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">Motor de Recaudo Activo</span>
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight mb-2">Configuración Centralizada</h3>
                        <p className="text-slate-400 text-sm leading-relaxed font-medium">
                            Administra el contacto de soporte y los canales oficiales de recaudo para todas tus clínicas.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white/5 p-2 rounded-[24px] backdrop-blur-md border border-white/10">
                        <div className="relative group flex-1 min-w-[240px]">
                            <div className="absolute inset-y-0 left-4 flex items-center text-cyan-400">
                                <FaWhatsapp size={18} />
                            </div>
                            <input
                                type="text"
                                value={config.adminPhone}
                                onChange={(e) => setConfig({ ...config, adminPhone: e.target.value })}
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-bold text-sm outline-none"
                                placeholder="300 123 4567"
                            />
                        </div>
                        <button
                            onClick={handleSaveConfig}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-cyan-500/20 active:scale-95 flex items-center gap-3 justify-center whitespace-nowrap"
                        >
                            <FaSave size={14} />
                            Actualizar Datos
                        </button>
                    </div>
                </div>
            </div>

            {/* Methods List - Premium Card Grid */}
            <div>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Métodos de Recaudo</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">Canales habilitados para la facturación de servicios.</p>
                    </div>
                    <div className="h-px flex-1 mx-8 bg-slate-200/60 hidden md:block"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {/* Add New Card - Sleek White Theme */}
                    <button
                        onClick={() => { setEditingId(null); setForm({ name: "", type: "Billetera Digital", number: "", holder: "", logoUrl: "", active: true }); setShowModal(true); }}
                        className="h-[220px] bg-white border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:bg-white hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/10 transition-all group relative overflow-hidden"
                    >
                        <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-all">
                            <FiPlus size={24} />
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-blue-600 transition-colors">Nuevo Canal</span>
                            <span className="text-xs font-bold text-slate-300">Administrar Recaudo</span>
                        </div>
                    </button>

                    {methods.map(m => (
                        /* Premium Bank Style Cards */
                        <div key={m.id} className="bg-white rounded-[32px] border border-slate-200 shadow-lg shadow-slate-100/50 flex flex-col relative overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group">
                            {/* Card Header Decoration */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-10 
                                ${m.type === 'Billetera Digital' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>

                            <div className="p-8 relative">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 overflow-hidden shadow-sm p-2 bg-white
                                            ${m.type === 'Billetera Digital' ? 'border-purple-50' : 'border-blue-50'}`}>
                                            {m.logoUrl ? (
                                                <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain" />
                                            ) : (
                                                m.type === 'Billetera Digital' ? <FiSmartphone className="text-purple-600" size={24} /> : <FaUniversity className="text-blue-600" size={24} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{m.type}</p>
                                            <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none">{m.name}</h4>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(m)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-100">
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(m.id)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-slate-100">
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Número Oficial</span>
                                            <span className="text-xl font-black text-slate-800 tracking-wider">
                                                {m.number ? (String(m.number).match(/.{1,4}/g)?.join(' ') || m.number) : "—"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Titular de Cuenta</span>
                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{m.holder || "—"}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                                            <FiCheckCircle className="text-green-500" size={12} />
                                            <span className="text-[9px] font-black text-green-700 uppercase tracking-wider">Verificado</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Modal - Ultra Modern Refinement */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100" style={{ backgroundColor: '#ffffff' }}>
                        <div className="p-10">
                            <h4 className="text-2xl font-black text-slate-800 tracking-tight mb-2 leading-none">{editingId ? 'Editar Método' : 'Nuevo Método'}</h4>
                            <p className="text-sm text-slate-500 font-medium mb-8">Información oficial para la facturación de servicios.</p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-2 block">Nombre del Banco/Wallet</label>
                                        <input
                                            required
                                            type="text"
                                            value={form.name || ""}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="Ej: NEQUI, BANCOLOMBIA"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-2 block">Tipo de Cuenta</label>
                                        <div className="relative">
                                            <select
                                                value={form.type || "Billetera Digital"}
                                                onChange={(e) => setForm({ ...form, type: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 appearance-none transition-all outline-none cursor-pointer"
                                            >
                                                <option value="Billetera Digital">Billetera Digital</option>
                                                <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                                                <option value="Cuenta Corriente">Cuenta Corriente</option>
                                            </select>
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-2 block">Número de Cuenta/Celular</label>
                                        <input
                                            required
                                            type="text"
                                            value={form.number || ""}
                                            onChange={(e) => setForm({ ...form, number: e.target.value })}
                                            placeholder="Ej: 312 411 9846"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-2 block">Nombre del Titular</label>
                                        <input
                                            required
                                            type="text"
                                            value={form.holder || ""}
                                            onChange={(e) => setForm({ ...form, holder: e.target.value })}
                                            placeholder="Ej: OdontoCloud SAS"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-3 block">Sincronizar Identidad Visual</label>
                                        <div className="flex gap-4 items-center">
                                            <div className="relative flex-1">
                                                <input
                                                    type="file"
                                                    id="logo-upload"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                />
                                                <label
                                                    htmlFor="logo-upload"
                                                    className={`w-full flex items-center justify-between px-6 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer hover:bg-slate-100 hover:border-blue-300
                                                        ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    <span className="text-slate-500">{uploading ? 'Subiendo...' : 'Subir Logo Personalizado'}</span>
                                                    {uploading ? <FiLoader className="animate-spin text-blue-500" /> : <FiUpload className="text-slate-400" />}
                                                </label>
                                            </div>
                                            <div className="w-16 h-16 rounded-2xl border-2 border-slate-50 p-2 bg-white shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                                                {form.logoUrl ? (
                                                    <img src={form.logoUrl} alt="Preview" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="text-[8px] font-black text-slate-200 uppercase text-center leading-tight">Sin<br />Logo</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {[
                                                { id: 'nequi', color: 'bg-purple-600', label: 'NEQUI', url: "https://vignette.wikia.nocookie.net/logopedia/images/e/e4/NEQUI_Logo_2023.png/revision/latest?cb=20230526143000" },
                                                { id: 'bancolombia', color: 'bg-yellow-400', label: 'BANCOLOMBIA', url: "https://vignette.wikia.nocookie.net/logopedia/images/e/e3/Logo_Bancolombia.png/revision/latest?cb=20210712170308" },
                                                { id: 'daviplata', color: 'bg-red-600', label: 'DAVIPLATA', url: "https://vignette.wikia.nocookie.net/logopedia/images/7/7b/Daviplata_2019.png/revision/latest?cb=20210212170308" }
                                            ].map(preset => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, logoUrl: preset.url, name: preset.label })}
                                                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm"
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${preset.color}`}></span> {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50 hover:brightness-110"
                                    >
                                        {isSaving ? "Guardando..." : (editingId ? "Actualizar" : "Crear Método")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
