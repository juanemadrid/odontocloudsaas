import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiStar, FiFolder, FiMessageCircle } from 'react-icons/fi';

export default function FeatureDetailModal({ feature, isOpen, onClose }) {
    if (!feature) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl relative overflow-hidden my-auto max-h-[90vh] flex flex-col"
                    >
                        {/* Close Button - Absolute */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-20 p-2 bg-white/50 backdrop-blur-md rounded-full text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-slate-100"
                        >
                            <FiX size={24} />
                        </button>

                        <div className="overflow-y-auto p-8 md:p-12">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row gap-8 items-start mb-10">
                                {/* Icon Box */}
                                <div className="shrink-0 w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-4xl shadow-inner">
                                    {feature.icon || <FiStar />}
                                </div>

                                <div className="flex-1 pr-12">
                                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                                        {feature.title}
                                    </h2>
                                    <p className="text-lg text-slate-500 font-light leading-relaxed">
                                        {feature.longDesc || feature.desc}
                                    </p>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-slate-100 mb-10" />

                            {/* Content Grid */}
                            <div className="grid md:grid-cols-2 gap-10">
                                {/* Features List */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <FiFolder className="text-base" /> Características Principales
                                    </h3>
                                    <ul className="space-y-3">
                                        {feature.features?.map((item, idx) => (
                                            <motion.li
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex items-start gap-3 text-slate-600 font-medium text-sm md:text-base"
                                            >
                                                <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 text-[10px] mt-0.5 font-bold">
                                                    {idx + 1}
                                                </div>
                                                {item}
                                            </motion.li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Benefits List */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                        <FiStar className="text-base" /> Beneficios para tu Clínica
                                    </h3>
                                    <ul className="space-y-3">
                                        {feature.benefits?.map((item, idx) => (
                                            <motion.li
                                                key={idx}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 + (idx * 0.05) }}
                                                className="flex items-start gap-3 text-slate-600 font-medium text-sm md:text-base"
                                            >
                                                <FiCheck className="text-green-500 mt-1 shrink-0" />
                                                {item}
                                            </motion.li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Footer CTA */}
                            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50 -mx-8 -mb-12 p-8">
                                <div className="text-slate-500 text-sm font-medium">
                                    ¿Te interesa esta funcionalidad?
                                </div>
                                <button
                                    onClick={() => window.open(`https://wa.me/573001234567?text=Hola,%20me%20interesa%20saber%20más%20sobre%20${feature.title}`, '_blank')}
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-green-500/20 transition-all hover:-translate-y-1 flex items-center gap-2 text-sm"
                                >
                                    <FiMessageCircle size={18} /> Consultar por WhatsApp
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
