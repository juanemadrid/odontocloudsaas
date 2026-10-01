import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiActivity, FiCheckCircle, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { registerTrialClinic } from '../../services/registrationService';

const OFFICIAL_PLANS_TRIAL = [
    { id: "clinica", name: "Plan Clínica (Recomendado — Facturación DIAN y RIPS — 30 Días Gratis)" },
    { id: "consultorio", name: "Plan Consultorio (1 a 2 Doctores — 30 Días Gratis)" },
    { id: "enterprise", name: "Plan Enterprise (Multi-Sede y Cadenas — 30 Días Gratis)" },
];

export default function TrialModal({ isOpen, onClose, initialPlan }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        clinicName: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        requestedPlan: 'clinica',
        features: []
    });

    React.useEffect(() => {
        if (initialPlan) {
            const raw = typeof initialPlan === 'string' ? initialPlan.toLowerCase() : (initialPlan.id || initialPlan.name || '').toLowerCase();
            let matched = 'clinica';
            if (raw.includes('consultorio') || raw.includes('basic') || raw.includes('esencial')) matched = 'consultorio';
            if (raw.includes('enterprise') || raw.includes('elite') || raw.includes('ips')) matched = 'enterprise';
            setFormData(prev => ({ ...prev, requestedPlan: matched }));
        }
    }, [initialPlan]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const selectedObj = OFFICIAL_PLANS_TRIAL.find(p => p.id === formData.requestedPlan) || OFFICIAL_PLANS_TRIAL[0];
            await registerTrialClinic({
                ...formData,
                requestedPlan: {
                    id: selectedObj.id,
                    name: selectedObj.name
                },
                requestedPlanFeatures: formData.features
            });
            onClose();
            alert(`¡Solicitud enviada exitosamente!\n\nTu solicitud para "${formData.clinicName || 'tu clínica'}" ha sido registrada. Nuestro equipo revisará la información y te notificará cuando tu cuenta sea activada.`);
        } catch (error) {
            console.error(error);
            alert("Error al registrar: " + (error.message || "Intenta con otro correo."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative !bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
                        >
                            <FiX size={24} />
                        </button>

                        <style>
                            {`
                                input:-webkit-autofill,
                                input:-webkit-autofill:hover,
                                input:-webkit-autofill:focus,
                                input:-webkit-autofill:active {
                                    -webkit-box-shadow: 0 0 0 30px #f8fafc inset !important;
                                    -webkit-text-fill-color: #334155 !important;
                                    transition: background-color 5000s ease-in-out 0s;
                                }
                            `}
                        </style>
                        <form onSubmit={handleSubmit} className="p-8 md:p-12" autoComplete="off">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Inicia tu Prueba Gratuita</h3>
                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Plan de Prueba (30 Días):</label>
                                    <select
                                        className="w-full bg-blue-50/80 border border-blue-200 text-blue-950 text-xs sm:text-sm rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 block p-2.5 font-bold"
                                        value={formData.requestedPlan}
                                        onChange={(e) => setFormData({ ...formData, requestedPlan: e.target.value })}
                                    >
                                        {OFFICIAL_PLANS_TRIAL.map(plan => (
                                             <option key={plan.id} value={plan.id}>
                                                 {plan.name}
                                             </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-slate-600 font-medium text-sm">Experimenta la gestión dental moderna por 30 días sin costo.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tu Nombre</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                            placeholder="Ej: Dr. Juan Pérez"
                                            value={formData.adminName}
                                            onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Clínica</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                            placeholder="Ej: OdontoSalud"
                                            value={formData.clinicName}
                                            onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                    <input
                                        required
                                        type="email"
                                        autoComplete="off"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                        placeholder="correo@ejemplo.com"
                                        value={formData.adminEmail}
                                        onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium pr-11"
                                            placeholder="Mínimo 6 caracteres"
                                            minLength={6}
                                            value={formData.adminPassword}
                                            onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                            title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                                        >
                                            {showPassword ? <FiEyeOff size={18}/> : <FiEye size={18}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                            >
                                {loading ? (
                                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Activar Mi Prueba <FiArrowRight /></>
                                )}
                            </button>
                            <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1"><FiShield /> Seguro</span>
                                <span className="flex items-center gap-1"><FiActivity /> 30 Días</span>
                                <span className="flex items-center gap-1"><FiCheckCircle /> Full Acceso</span>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
