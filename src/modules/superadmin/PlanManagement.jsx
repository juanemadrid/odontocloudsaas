import React, { useState, useEffect } from "react";
import { createPlan, getPlans, updatePlan, deletePlan } from "../../services/adminService";

// Simple Icon Components
const IconPlan = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);
const IconEdit = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);
const IconTrash = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export default function PlanManagement({ hideTitle }) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null); // ID if editing

    const STANDARD_MODULES = [
        { id: "Agenda", label: "Agenda Inteligente" },
        { id: "Pacientes", label: "Gestión Pacientes" },
        { id: "Inventario", label: "Inventarios" },
        { id: "Facturación", label: "Facturación" },
        { id: "RIPS", label: "RIPS / Normativa" },
        { id: "Administración", label: "Administración" }
    ];

    // Helper for dots formatting in inputs (e.g. 150000 -> 150.000)
    const formatInputDots = (num) => {
        if (num === null || num === undefined || num === "" || isNaN(num) || num === 0) return "";
        return Number(num).toLocaleString("es-CO");
    };

    const parseDotsInput = (str) => {
        const raw = String(str).replace(/\D/g, "");
        return raw === "" ? "" : Number(raw);
    };

    // Form State
    const [newPlan, setNewPlan] = useState({
        name: "",
        description: "",
        maxUsers: 5,
        includeFacturacion: true,
        facturasIncluidas: 300,
        monthlyPrice: 0,
        yearlyPrice: 0,
        includeCms: false,
        recommended: false,
        features: []
    });
    const [customFeature, setCustomFeature] = useState("");

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const data = await getPlans();
            setPlans(data);
        } catch (error) {
            console.error("Error loading plans:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPlan.name) return;
        try {
            // 1. Base Features
            let finalFeatures = [...newPlan.features];

            // 2. Add CMS if selected and not already present
            if (newPlan.includeCms && !finalFeatures.includes("CMS")) {
                finalFeatures.push("CMS");
            }

            const isFacturacionActive = newPlan.includeFacturacion;
            const planData = {
                name: newPlan.name,
                description: newPlan.description,
                maxUsers: Number(newPlan.maxUsers),
                includeFacturacion: isFacturacionActive,
                facturasIncluidas: isFacturacionActive ? (Number(newPlan.facturasIncluidas) || 300) : 0,
                monthlyPrice: Number(newPlan.monthlyPrice),
                yearlyPrice: Number(newPlan.yearlyPrice),
                recommended: newPlan.recommended,
                features: finalFeatures,
                status: "active"
            };

            if (editingId) {
                // UPDATE
                await updatePlan(editingId, planData);
                alert("✅ Plan actualizado.");
            } else {
                // CREATE
                await createPlan(planData);
                alert("✅ Plan creado exitosamente.");
            }

            setShowModal(false);
            setNewPlan({ name: "", description: "", maxUsers: 5, includeFacturacion: true, facturasIncluidas: 300, monthlyPrice: 0, yearlyPrice: 0, includeCms: false, recommended: false, features: [] });
            setEditingId(null);
            setCustomFeature("");
            loadPlans();
        } catch (error) {
            console.error("Error saving plan:", error);
            alert("Error al guardar el plan.");
        }
    };

    const handleEdit = (plan) => {
        setEditingId(plan.id);
        const hasFactus = plan.includeFacturacion !== false; // Default to true for all existing plans
        setNewPlan({
            name: plan.name || "",
            description: plan.description || "",
            maxUsers: plan.maxUsers || 1,
            includeFacturacion: hasFactus,
            facturasIncluidas: (plan.facturasIncluidas !== undefined && plan.facturasIncluidas !== null) ? plan.facturasIncluidas : 300,
            monthlyPrice: plan.monthlyPrice || 0,
            yearlyPrice: plan.yearlyPrice || 0,
            recommended: plan.recommended || false,
            includeCms: plan.features?.includes("CMS") || false,
            features: plan.features || []
        });
        setShowModal(true);
    };

    const addFeature = () => {
        if (!customFeature.trim()) return;
        if (!newPlan.features.includes(customFeature.trim())) {
            setNewPlan({ ...newPlan, features: [...newPlan.features, customFeature.trim()] });
        }
        setCustomFeature("");
    };

    const removeFeature = (feature) => {
        setNewPlan({ ...newPlan, features: newPlan.features.filter(f => f !== feature) });
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro de eliminar este plan? Esto no afectará a las clínicas que ya lo tienen.")) return;
        try {
            await deletePlan(id);
            loadPlans();
        } catch (error) {
            alert("Error al eliminar");
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setNewPlan({
            name: "",
            description: "",
            maxUsers: 5,
            includeFacturacion: true,
            facturasIncluidas: 300,
            monthlyPrice: 0,
            yearlyPrice: 0,
            includeCms: false,
            recommended: false,
            features: STANDARD_MODULES.map(m => m.id) // Pre-select standard features
        });
        setShowModal(true);
    };

    return (
        /* Force background white to override any dark theme leakage */
        <div className="w-full space-y-6 bg-white min-h-full" style={{ backgroundColor: '#ffffff' }}>

            {/* Header Action Area */}
            <div className="bg-white px-6 py-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                    {/* Explicitly dark slate text */}
                    <h3 className="font-black text-slate-800 text-xs uppercase tracking-[.2em]">Modelos de Negocio</h3>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                    + Definir Nuevo Plan
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400 text-sm font-medium">Cargando catálogo...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                    {plans.map((plan) => {
                        const isRecommended = plan.recommended;
                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 group
                                    ${isRecommended
                                        ? "shadow-2xl scale-105 border-2 border-blue-500 ring-4 ring-blue-500/10 z-10"
                                        : "shadow-lg shadow-slate-100 border border-slate-200 hover:border-blue-400 hover:shadow-2xl"
                                    }`}
                                style={{ backgroundColor: '#ffffff', color: '#000000' }}
                            >
                                {isRecommended && (
                                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                                        <div className="bg-gradient-to-r from-blue-600 to-cyan-400 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-2.5 rounded-full shadow-2xl border-2 border-white flex items-center gap-2 whitespace-nowrap">
                                            <span className="text-amber-300 drop-shadow-sm">★</span>
                                            PLAN RECOMENDADO
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm border
                                            ${isRecommended ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
                                            {plan.name.charAt(0)}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(plan)}
                                                className="p-2.5 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm border border-transparent hover:border-blue-100"
                                            >
                                                <IconEdit />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(plan.id)}
                                                className="p-2.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-transparent hover:border-red-100"
                                            >
                                                <IconTrash />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-black mb-2 text-slate-900" style={{ color: '#0f172a' }}>{plan.name}</h3>
                                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-8 min-h-[3em]">
                                        {plan.description || "Configuración estratégica para este nivel de servicio."}
                                    </p>

                                    <div className="mb-8">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-slate-900" style={{ color: '#0f172a' }}>
                                                {formatCurrency(plan.monthlyPrice || 0)}
                                            </span>
                                            <span className="text-xs font-bold uppercase text-slate-400 tracking-tighter">/ Mensual</span>
                                        </div>
                                        {plan.yearlyPrice > 0 && (
                                            <p className="text-[10px] font-black mt-1 text-blue-600 uppercase tracking-wide">
                                                {formatCurrency(plan.yearlyPrice)} • Ahorro Anual
                                            </p>
                                        )}
                                    </div>

                                    <div className="h-px w-full mb-8 bg-slate-100"></div>

                                    <ul className="space-y-4 mb-10">
                                        <li className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-[10px]">✓</div>
                                            <span className="text-xs font-bold text-slate-700">
                                                Hasta {plan.maxUsers} Usuarios
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            {(plan.includeFacturacion ?? Boolean(plan.facturasIncluidas && plan.facturasIncluidas > 0)) ? (
                                                <>
                                                    <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 text-[10px]">⚡</div>
                                                    <span className="text-xs font-bold text-emerald-700">
                                                        Facturación Electrónica ({plan.facturasIncluidas ? plan.facturasIncluidas.toLocaleString('es-CO') : 300} / mes)
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">✕</div>
                                                    <span className="text-xs font-medium text-slate-400">
                                                        Sin Facturación Electrónica
                                                    </span>
                                                </>
                                            )}
                                        </li>
                                        {plan.features?.slice(0, 6).map(feature => (
                                            <li key={feature} className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-[10px]">✓</div>
                                                <span className="text-xs font-medium text-slate-600">
                                                    {feature === "CMS" ? "Personalización Web CMS" : feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button
                                    onClick={() => handleEdit(plan)}
                                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-2
                                        ${isRecommended
                                            ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-500/25 border-b-4 border-blue-700 hover:brightness-110"
                                            : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-500/15 border-b-4 border-blue-600 hover:brightness-110"}`}
                                >
                                    Configurar Módulos
                                </button>
                            </div>
                        );
                    })}
                    {plans.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <IconPlan />
                            </div>
                            <h3 className="text-slate-900 font-bold mb-1">No hay planes definidos</h3>
                            <p className="text-slate-500 text-sm">Comienza creando tu primer plan de suscripción.</p>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL CREAR PLAN */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" style={{ backgroundColor: '#ffffff' }}>
                            <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center" style={{ backgroundColor: '#ffffff' }}>
                                <h3 className="text-lg font-bold text-slate-800">{editingId ? "Editar Plan" : "Nuevo Plan de Suscripción"}</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-5 bg-white max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Plan</label>
                                    <input
                                        type="text"
                                        className="w-full input-premium"
                                        placeholder="Ej: Básico, Pro, Corporativo"
                                        value={newPlan.name}
                                        onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción de Marketing</label>
                                    <textarea
                                        className="w-full input-premium min-h-[80px] text-xs py-3"
                                        placeholder="Ej: 'El estándar de oro para clínicas modernas...'"
                                        value={newPlan.description}
                                        onChange={e => setNewPlan({ ...newPlan, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Precio Mensual ($)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full input-premium mb-1 font-semibold"
                                            placeholder="150.000"
                                            value={formatInputDots(newPlan.monthlyPrice)}
                                            onChange={e => setNewPlan({ ...newPlan, monthlyPrice: parseDotsInput(e.target.value) })}
                                            required
                                        />
                                        <span className="text-xs text-slate-500 font-medium">Vista: {formatCurrency(newPlan.monthlyPrice)}</span>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Precio Anual ($)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full input-premium mb-1 font-semibold"
                                            placeholder="1.500.000"
                                            value={formatInputDots(newPlan.yearlyPrice)}
                                            onChange={e => setNewPlan({ ...newPlan, yearlyPrice: parseDotsInput(e.target.value) })}
                                            required
                                        />
                                        <span className="text-xs text-slate-500 font-medium">Vista: {formatCurrency(newPlan.yearlyPrice)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Usuarios</label>
                                    <input
                                        type="number"
                                        className="w-full input-premium"
                                        placeholder="5"
                                        value={newPlan.maxUsers}
                                        onChange={e => setNewPlan({ ...newPlan, maxUsers: e.target.value === "" ? "" : Number(e.target.value) })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Módulos Incluidos</label>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {STANDARD_MODULES.map(mod => (
                                            <button
                                                key={mod.id}
                                                type="button"
                                                onClick={() => {
                                                    const isSelected = newPlan.features.includes(mod.id);
                                                    setNewPlan({
                                                        ...newPlan,
                                                        features: isSelected
                                                            ? newPlan.features.filter(f => f !== mod.id)
                                                            : [...newPlan.features, mod.id]
                                                    });
                                                }}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all ${newPlan.features.includes(mod.id)
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                                                    }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${newPlan.features.includes(mod.id) ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                                                {mod.label}
                                            </button>
                                        ))}
                                    </div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Características Extra</label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            className="flex-1 input-premium"
                                            placeholder="Ej: Página Web, Soporte 24/7"
                                            value={customFeature}
                                            onChange={e => setCustomFeature(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                                        />
                                        <button
                                            type="button"
                                            onClick={addFeature}
                                            className="px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                                        {newPlan.features.filter(f => !STANDARD_MODULES.find(m => m.id === f) && f !== "CMS").map(f => (
                                            <span key={f} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">
                                                {f}
                                                <button type="button" onClick={() => removeFeature(f)} className="text-slate-400 hover:text-red-500">×</button>
                                            </span>
                                        ))}
                                        {newPlan.features.length === 0 && <span className="text-[10px] text-slate-400 italic">No hay beneficios extra.</span>}
                                    </div>
                                </div>

                                {/* OPIONES DE CONFIGURACIÓN AVANZADA (TOGGLES) */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Opciones Adicionales del Plan</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        
                                        {/* Toggle Facturación Electrónica */}
                                        <div className={`p-3 rounded-xl border transition-all cursor-pointer ${newPlan.includeFacturacion ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                                            onClick={() => setNewPlan(prev => ({ ...prev, includeFacturacion: !prev.includeFacturacion }))}>
                                            <div className="flex flex-col gap-2">
                                                <div className={`w-8 h-5 flex items-center bg-gray-300 rounded-full p-0.5 duration-300 ease-in-out ${newPlan.includeFacturacion ? 'bg-emerald-600' : ''}`}>
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${newPlan.includeFacturacion ? 'translate-x-3' : ''}`}></div>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-900 leading-tight">Facturación Electrónica</span>
                                            </div>
                                        </div>

                                        {/* Toggle Sitio Web */}
                                        <div className={`p-3 rounded-xl border transition-all cursor-pointer ${newPlan.includeCms ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                                            onClick={() => setNewPlan(prev => ({ ...prev, includeCms: !prev.includeCms }))}>
                                            <div className="flex flex-col gap-2">
                                                <div className={`w-8 h-5 flex items-center bg-gray-300 rounded-full p-0.5 duration-300 ease-in-out ${newPlan.includeCms ? 'bg-indigo-600' : ''}`}>
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${newPlan.includeCms ? 'translate-x-3' : ''}`}></div>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-900 leading-tight">Sitio Web CMS</span>
                                            </div>
                                        </div>

                                        {/* Toggle Destacar */}
                                        <div className={`p-3 rounded-xl border transition-all cursor-pointer ${newPlan.recommended ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                                            onClick={() => setNewPlan(prev => ({ ...prev, recommended: !prev.recommended }))}>
                                            <div className="flex flex-col gap-2">
                                                <div className={`w-8 h-5 flex items-center bg-gray-300 rounded-full p-0.5 duration-300 ease-in-out ${newPlan.recommended ? 'bg-amber-500' : ''}`}>
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${newPlan.recommended ? 'translate-x-3' : ''}`}></div>
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-900 leading-tight">Destacar Plan</span>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Si Facturación Electrónica está activa, pedir la cuota de facturas */}
                                    {newPlan.includeFacturacion && (
                                        <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 animate-fadeIn">
                                            <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">
                                                Facturas Electrónicas Incluidas al mes
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="w-full h-9 px-3 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 font-mono"
                                                placeholder="Ej: 300"
                                                value={formatInputDots(newPlan.facturasIncluidas)}
                                                onChange={e => setNewPlan({ ...newPlan, facturasIncluidas: parseDotsInput(e.target.value) })}
                                            />
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 italic text-center">
                                    * Todos los planes gestionados aquí se sincronizarán con la vista del cliente.
                                </p>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors border border-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                                    >
                                        {editingId ? "Actualizar" : "Crear Plan"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <style>{`
                .input-premium {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    padding: 0.625rem 1rem;
                    outline: none;
                    transition: all 0.2s;
                    color: #0f172a;
                }
                .input-premium:focus {
                    background-color: #fff;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
            `}</style>
        </div >
    );
}
