import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiArrowRight, FiCreditCard, FiMessageCircle } from 'react-icons/fi';

export default function SubscriptionModal({ isOpen, onClose, plan }) {
    if (!plan) return null;

    const whatsappMessage = `Hola, me interesa suscribirme al plan *${plan.name}* de OdontoCloud. ¿Me podrían indicar los pasos para el pago?`;
    const whatsappUrl = `https://wa.me/573001234567?text=${encodeURIComponent(whatsappMessage)}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#022a63] to-blue-900 p-8 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                            >
                                <FiX size={24} />
                            </button>

                            <h3 className="text-white text-xl font-medium tracking-wide uppercase opacity-80 mb-2">Has seleccionado</h3>
                            <h2 className="text-4xl font-display font-bold text-white mb-2">{plan.name}</h2>
                            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1 rounded-full border border-white/20">
                                <span className="text-2xl font-bold text-emerald-400">$ {Number(plan.price || plan.monthlyPrice).toLocaleString('es-CO')}</span>
                                <span className="text-xs text-blue-200 uppercase tracking-widest">/ Mes</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8">
                            <div className="space-y-6 mb-8">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm uppercase tracking-wider">Incluye:</h4>
                                    <ul className="space-y-2">
                                        {(plan.features || []).slice(0, 4).map((feat, i) => (
                                            <li key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                <FiCheck className="text-green-500 shrink-0" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                        {(plan.features?.length > 4) && (
                                            <li className="text-xs text-slate-400 italic pl-7">+ {plan.features.length - 4} beneficios más</li>
                                        )}
                                    </ul>
                                </div>

                                <p className="text-center text-slate-500 text-sm leading-relaxed">
                                    Para activar tu suscripción corporativa, sigue estos pasos:
                                </p>

                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3 mb-6">
                                    <div className="flex gap-3">
                                        <div className="min-w-[24px] h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">1</div>
                                        <div className="text-sm text-slate-600 dark:text-slate-300">
                                            <p className="font-bold text-slate-800 dark:text-white">Realiza el pago/transferencia</p>
                                            <p className="text-xs mt-1">Bancolombia Ahorros: <strong>031-000000-00</strong></p>
                                            <p className="text-xs">Nequi / Daviplata: <strong>300 123 4567</strong></p>
                                            <p className="text-xs">NIT: 900.000.000-1</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="min-w-[24px] h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">2</div>
                                        <div className="text-sm text-slate-600 dark:text-slate-300">
                                            <p className="font-bold text-slate-800 dark:text-white">Envía el comprobante</p>
                                            <p className="text-xs mt-1">Envíanos una foto del comprobante a nuestro WhatsApp para activar tu cuenta inmediatamente.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <FiMessageCircle size={20} />
                                    Activar por WhatsApp
                                </a>

                                <button
                                    onClick={onClose}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>

                            <div className="mt-6 flex justify-center gap-4 opacity-50 grayscale">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-6" />
                            </div>
                        </div>
                    </motion.div>
                </div >
            )
            }
        </AnimatePresence >
    );
}
