import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiActivity, FiCheckCircle, FiArrowRight, FiPhone, FiMail } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { registerTrialClinic } from '../../services/registrationService';

export default function TrialModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        clinicName: '',
        adminName: '',
        adminEmail: '',
        phone: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await registerTrialClinic({
                ...formData,
                requestedPlan: {
                    id: 'trial',
                    name: 'Plan de Prueba Gratuita (30 Días)'
                },
                requestedPlanFeatures: []
            });
            onClose();
            alert(`¡Solicitud enviada exitosamente!\n\nTu solicitud de prueba para "${formData.clinicName || 'tu clínica'}" ha sido registrada. Recibirás un correo oficial en ${formData.adminEmail} con el enlace para activar tu cuenta y definir tu contraseña.`);
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        className="relative !bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[88dvh] overflow-y-auto my-auto border border-slate-200 z-10"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full z-20"
                        >
                            <FiX size={22} />
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
                        <form onSubmit={handleSubmit} className="p-6 sm:p-8 md:p-10" autoComplete="off">
                            <div className="text-center mb-6">
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">Inicia tu Prueba Gratuita</h3>
                                <div className="mb-3 p-3 bg-blue-50/90 border border-blue-200 rounded-2xl text-center">
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full mb-1">
                                        ✨ Plan de Prueba (30 Días)
                                    </div>
                                    <p className="text-blue-950 font-bold text-xs sm:text-sm">
                                        Explora Agenda, Odontograma, Historias Clínicas y Caja sin costo.
                                    </p>
                                    <p className="text-slate-500 text-[11px] mt-0.5 font-medium">
                                        (No incluye facturación electrónica DIAN ni RIPS)
                                    </p>
                                </div>
                                <p className="text-slate-500 font-medium text-xs">Prueba sin costo durante 30 días. No requiere tarjeta de crédito.</p>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono / WhatsApp</label>
                                    <input
                                        type="tel"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-slate-700 font-medium"
                                        placeholder="Ej: +57 300 123 4567"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>

                                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed font-medium">
                                    <FiShield className="text-blue-600 mt-0.5 shrink-0" size={16} />
                                    <span>
                                        <strong>Activación segura:</strong> Al aprobarse tu solicitud, recibirás un correo oficial con el botón para crear tu contraseña e ingresar directamente a OdontoCloud.
                                    </span>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                            >
                                {loading ? (
                                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Solicitar Prueba Gratuita <FiArrowRight /></>
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
