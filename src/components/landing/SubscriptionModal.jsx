import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiMessageCircle, FiShield, FiLock, FiAward, FiClock } from 'react-icons/fi';

const cop = (n) =>
    n ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n) : '';

export default function SubscriptionModal({ isOpen, onClose, plan, config }) {
    const [copied, setCopied] = useState(false);

    if (!plan) return null;

    const planName = plan?.name || plan || 'Seleccionado';
    const displayPrice = plan?.displayPrice || plan?.yearlyPrice || plan?.monthlyPrice || 0;
    const billing = plan?.billing || 'anual';
    const features = plan?.features || [];
    const phone = (config?.contactPhone || '3001234567').replace(/\D/g, '');
    const bankAccount = config?.bankAccount || '031-000000-00';
    const nequiNumber = config?.nequiNumber || '300 123 4567';
    const nit = config?.nit || '900.000.000-1';

    const whatsappMessage = `Hola, me interesa suscribirme al plan *${planName}* de OdontoCloud por ${cop(displayPrice)}/${billing === 'anual' ? 'año' : 'mes'}. ¿Me pueden guiar para completar el pago?`;
    const whatsappUrl = `https://wa.me/57${phone}?text=${encodeURIComponent(whatsappMessage)}`;

    const handleCopyAccount = () => {
        navigator.clipboard.writeText(bankAccount);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const trustBadges = [
        { icon: FiShield, label: 'Sin cláusula\nde permanencia' },
        { icon: FiClock, label: '30 días\nde prueba gratis' },
        { icon: FiAward, label: 'Soporte\ndirecto 24/7' },
        { icon: FiLock, label: 'Datos\n100% seguros' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 24 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
                    >
                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-white/80 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all shadow-sm"
                        >
                            <FiX size={18} />
                        </button>

                        {/* Header gradient */}
                        <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 px-8 pt-8 pb-10 text-white overflow-hidden">
                            {/* Decorative circles */}
                            <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-white/5 border border-white/10" />
                            <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/5 border border-white/10" />

                            <div className="relative z-10">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-200 mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Has seleccionado
                                </span>
                                <h2 className="text-3xl font-black text-white mb-4 leading-tight">
                                    Plan {planName}
                                </h2>

                                {/* Price badge */}
                                <div className="inline-flex items-baseline gap-2 bg-white/10 border border-white/20 backdrop-blur-sm px-5 py-3 rounded-2xl">
                                    <span className="text-3xl font-black text-white tabular-nums">
                                        {cop(displayPrice)}
                                    </span>
                                    <span className="text-blue-200 text-sm font-semibold">
                                        / {billing === 'anual' ? 'año' : 'mes'}
                                    </span>
                                </div>

                                {billing === 'anual' && displayPrice > 0 && (
                                    <p className="text-blue-200 text-xs mt-2 font-medium">
                                        Equivalente a {cop(Math.round(displayPrice / 12))} / mes · 1 mes gratis incluido
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Trust badges row */}
                        <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50/70">
                            {trustBadges.map(({ icon: Icon, label }, i) => (
                                <div key={i} className="flex flex-col items-center justify-center py-3 px-2 gap-1.5 border-r border-slate-100 last:border-r-0">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Icon size={15} />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 text-center leading-tight whitespace-pre-line">{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">

                            {/* Features preview */}
                            {features.length > 0 && (
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                                        ✅ Incluye en tu plan:
                                    </h4>
                                    <ul className="space-y-2">
                                        {features.slice(0, 4).map((feat, i) => (
                                            <li key={i} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                                                <FiCheck className="text-emerald-500 flex-shrink-0" size={13} />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                        {features.length > 4 && (
                                            <li className="text-[10px] text-slate-400 italic pl-5">
                                                + {features.length - 4} beneficios adicionales incluidos
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Payment steps */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                                    📋 Pasos para activar tu suscripción:
                                </h4>
                                <div className="space-y-3">
                                    {/* Step 1 */}
                                    <div className="flex gap-3 p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[11px] flex-shrink-0 mt-0.5">1</div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm">Realiza el pago / transferencia</p>
                                            <div className="mt-1.5 space-y-1">
                                                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2">
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 font-semibold">Bancolombia Ahorros</p>
                                                        <p className="text-xs font-black text-slate-800 tabular-nums">{bankAccount}</p>
                                                    </div>
                                                    <button
                                                        onClick={handleCopyAccount}
                                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                                    >
                                                        {copied ? '¡Copiado!' : 'Copiar'}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 px-1">
                                                    <span className="font-semibold">Nequi / Daviplata:</span> {nequiNumber}
                                                    &nbsp;&nbsp;·&nbsp;&nbsp;
                                                    <span className="font-semibold">NIT:</span> {nit}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="flex gap-3 p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[11px] flex-shrink-0 mt-0.5">2</div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Envíanos el comprobante por WhatsApp</p>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                Activamos tu cuenta en menos de <strong className="text-slate-700">2 horas hábiles</strong> tras confirmar el pago.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA WhatsApp */}
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-[#25D366] hover:bg-[#1ebe5d] active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-lg shadow-green-500/25 transition-all flex items-center justify-center gap-3"
                            >
                                <FiMessageCircle size={20} />
                                Activar por WhatsApp
                            </a>

                            {/* Security seal */}
                            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold">
                                <FiLock size={11} />
                                <span>Transacción segura · Tus datos están protegidos · Sin compromisos de permanencia</span>
                            </div>

                            {/* Payment logos */}
                            <div className="flex items-center justify-center gap-4 pt-1 border-t border-slate-100">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-5 opacity-30 grayscale" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 opacity-30 grayscale" />
                                <div className="h-5 opacity-30 grayscale text-[10px] font-black text-slate-600 flex items-center">PSE</div>
                                <div className="h-5 opacity-30 grayscale text-[10px] font-black text-green-600 flex items-center">NEQUI</div>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-5 opacity-30 grayscale" />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
