import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiActivity, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { registerTrialClinic } from '../../services/registrationService';

export default function TrialModal({ isOpen, onClose, initialPlan }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        clinicName: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        requestedPlan: initialPlan?.name || initialPlan || 'Basic',
        features: initialPlan?.features || []
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await registerTrialClinic({
                ...formData,
                requestedPlanFeatures: formData.features
            });
            onClose();
            alert("¡Registro exitoso! Ya puedes iniciar sesión con tus credenciales.");
            navigate("/login");
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
                        <form onSubmit={handleSubmit} className="p-8 md:p-12">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Inicia tu Prueba Gratuita</h3>
                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Plan Seleccionado:</label>
                                    <select
                                        className="w-full bg-blue-50 border border-blue-100 text-blue-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                        value={typeof formData.requestedPlan === 'string' ? formData.requestedPlan : formData.requestedPlan.name}
                                        onChange={(e) => setFormData({ ...formData, requestedPlan: e.target.value })}
                                    >
                                        <option value="Esencial">Plan Esencial</option>
                                        <option value="Pro Professional">Plan Pro Professional</option>
                                        <option value="Élite Multi-Sede">Plan Élite Multi-Sede</option>
                                    </select>
                                </div>
                                <p className="text-slate-600 font-medium text-sm">Experimenta la gestión dental moderna por 30 días.</p>
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
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                        placeholder="correo@ejemplo.com"
                                        value={formData.adminEmail}
                                        onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                                    <input
                                        required
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                        placeholder="Mínimo 6 caracteres"
                                        minLength={6}
                                        value={formData.adminPassword}
                                        onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                    />
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
