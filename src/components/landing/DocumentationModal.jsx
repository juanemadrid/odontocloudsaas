import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiExternalLink, FiSearch, FiBookOpen, FiCalendar, FiUser, FiDollarSign, FiChevronRight, FiCheckCircle } from 'react-icons/fi';

const docCategories = [
    {
        id: 'inicio',
        title: 'Guía de Inicio',
        icon: <FiBookOpen className="text-sky-500" size={18} />,
        articles: [
            {
                id: 'intro',
                title: 'Introducción a OdontoCloud',
                subtitle: 'Conoce los conceptos básicos de la plataforma.',
                content: 'OdontoCloud es el software de gestión dental definitivo, diseñado para simplificar la administración de clínicas dentales y consultorios independientes. Desde aquí podrás gestionar las agendas de múltiples especialistas, expedir historias clínicas electrónicas, realizar odontogramas interactivos en tiempo real y emitir facturas y reportes financieros sin complicaciones.',
                steps: [
                    'Inicia sesión con tus credenciales de administrador u odontólogo.',
                    'Ve a Configuración para cargar los datos de tu clínica, logotipo y sedes de atención.',
                    'Define los odontólogos asociados y sus especialidades para habilitar sus agendas.'
                ],
                tip: 'Puedes configurar recordatorios automáticos de citas por WhatsApp para reducir el ausentismo de pacientes hasta en un 80%.'
            },
            {
                id: 'roles',
                title: 'Roles y Permisos',
                subtitle: 'Configura el acceso para tu equipo de trabajo.',
                content: 'Garantiza la seguridad de los datos de tus pacientes controlando qué información puede ver y editar cada miembro de tu equipo. El sistema cuenta con tres niveles de acceso principales.',
                steps: [
                    'Administrador: Control total sobre finanzas, configuraciones globales y base de datos.',
                    'Odontólogo: Acceso a su propia agenda, historias clínicas y odontograma de pacientes.',
                    'Recepcionista/Secretaria: Permiso para agendar citas, registrar pacientes y gestionar cobros.'
                ],
                tip: 'Los roles se pueden reasignar en cualquier momento desde la sección de Usuarios del panel de Configuración.'
            }
        ]
    },
    {
        id: 'agenda',
        title: 'Agenda y Citas',
        icon: <FiCalendar className="text-emerald-500" size={18} />,
        articles: [
            {
                id: 'crear-cita',
                title: 'Programación de Citas',
                subtitle: 'Aprende a agendar y gestionar citas.',
                content: 'La agenda digital de OdontoCloud te permite ver los horarios disponibles de todos tus especialistas y agendar tratamientos de manera ágil.',
                steps: [
                    'Haz clic en el módulo "Agenda" en el menú de navegación principal.',
                    'Selecciona la vista por día, semana, mes o por especialista.',
                    'Haz clic sobre una hora disponible o pulsa el botón "+ Nueva Cita".',
                    'Selecciona el paciente, la especialidad, el doctor encargado y el tratamiento primario.',
                    'Guarda la cita. El sistema la registrará al instante y cambiará su color según el estado (Pendiente, Confirmada, En Sala, Atendido).'
                ],
                tip: 'Puedes arrastrar y soltar (drag and drop) cualquier cita en la agenda para reprogramarla automáticamente.'
            }
        ]
    },
    {
        id: 'pacientes',
        title: 'Módulo de Pacientes',
        icon: <FiUser className="text-indigo-500" size={18} />,
        articles: [
            {
                id: 'historia-clinica',
                title: 'Historia Clínica y Evolución',
                subtitle: 'Cómo registrar el historial clínico.',
                content: 'El expediente del paciente agrupa toda la información médica relevante. Podrás registrar notas de evolución en cada sesión y asociar diagnósticos formales usando la base de datos CIE-10 integrada.',
                steps: [
                    'Ingresa al módulo "Pacientes" y busca al paciente.',
                    'Haz clic en su nombre para abrir su perfil y selecciona la pestaña "Historia Clínica".',
                    'Haz clic en "Nueva Entrada de Evolución".',
                    'Escribe las observaciones del tratamiento realizado y selecciona los códigos CIE-10 correspondientes al diagnóstico.',
                    'Firma digitalmente la consulta para bloquear la edición por seguridad legal.'
                ]
            },
            {
                id: 'odontograma',
                title: 'Uso del Odontograma Interactivo',
                subtitle: 'Registra los tratamientos de forma gráfica.',
                content: 'OdontoCloud cuenta con un odontograma interactivo en 3D/2D donde puedes pintar directamente sobre las caras de las piezas dentales para indicar patologías (rojo) o tratamientos ya realizados (azul).',
                steps: [
                    'En la ficha del paciente, dirígete a la pestaña "Odontograma".',
                    'Haz clic sobre la pieza dental que deseas tratar.',
                    'Selecciona la zona o cara del diente (oclusal, mesial, distal, vestibular, lingual).',
                    'Elige el estado (Caries, Endodoncia, Corona, Ausente, etc.) para que se dibuje gráficamente.',
                    'Guarda el odontograma. Automáticamente se generará un plan de tratamiento en el presupuesto del paciente.'
                ]
            }
        ]
    },
    {
        id: 'finanzas',
        title: 'Facturación y Finanzas',
        icon: <FiDollarSign className="text-amber-500" size={18} />,
        articles: [
            {
                id: 'pagos',
                title: 'Registrar Pagos y Presupuestos',
                subtitle: 'Controla el flujo de caja de tu clínica.',
                content: 'Administra presupuestos para tratamientos complejos y registra abonos o pagos totales de manera transparente.',
                steps: [
                    'Ve a la pestaña "Presupuestos y Pagos" del paciente.',
                    'Crea un nuevo presupuesto detallando los tratamientos sugeridos y los descuentos si aplican.',
                    'Una vez aprobado el presupuesto, haz clic en "Registrar Pago".',
                    'Indica el monto recibido, la forma de pago (Efectivo, Tarjeta, Transferencia) y genera el recibo en PDF o envíalo por correo.'
                ],
                tip: 'El sistema permite facturación parcial para tratamientos que requieren múltiples sesiones, manteniendo el saldo deudor visible.'
            }
        ]
    }
];

export default function DocumentationModal({ isOpen, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState(docCategories[0].articles[0]);

    if (!isOpen) return null;

    // Filter categories and articles based on search query
    const filteredCategories = docCategories.map(cat => {
        const filteredArticles = cat.articles.filter(art => 
            art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            art.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return {
            ...cat,
            articles: filteredArticles
        };
    }).filter(cat => cat.articles.length > 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 font-sans">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl w-full h-[85vh] max-w-6xl overflow-hidden relative flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-6 bg-sky-500 rounded-full" />
                                Centro de Ayuda OdontoCloud
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Layout Body */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Sidebar */}
                            <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                                {/* Search Bar */}
                                <div className="p-4 border-b border-slate-100 bg-white">
                                    <div className="relative">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar temas de ayuda..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white transition-all text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* Navigation Menu */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                    {filteredCategories.length > 0 ? (
                                        filteredCategories.map(cat => (
                                            <div key={cat.id} className="space-y-2">
                                                <div className="flex items-center gap-2 px-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    {cat.icon}
                                                    <span>{cat.title}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {cat.articles.map(art => {
                                                        const isSelected = selectedArticle.id === art.id;
                                                        return (
                                                            <button
                                                                key={art.id}
                                                                onClick={() => setSelectedArticle(art)}
                                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between transition-all group ${
                                                                    isSelected
                                                                        ? 'bg-sky-500 text-white font-semibold shadow-md shadow-sky-500/10'
                                                                        : 'hover:bg-slate-100 text-slate-600'
                                                                }`}
                                                            >
                                                                <span className="truncate">{art.title}</span>
                                                                <FiChevronRight
                                                                    className={`transition-transform duration-300 ${
                                                                        isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
                                                                    }`}
                                                                />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-slate-400">
                                            <p className="text-sm">No se encontraron temas.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-white">
                                {selectedArticle ? (
                                    <div className="max-w-3xl space-y-8 animate-fade-in">
                                        {/* Header */}
                                        <div className="space-y-2">
                                            <h1 className="text-3xl font-bold text-slate-800 leading-tight">
                                                {selectedArticle.title}
                                            </h1>
                                            <p className="text-lg text-slate-500 font-light">
                                                {selectedArticle.subtitle}
                                            </p>
                                        </div>

                                        {/* Content */}
                                        <div className="text-slate-600 leading-relaxed text-base border-l-2 border-sky-500 pl-4 bg-slate-50/50 py-2.5 rounded-r-xl">
                                            {selectedArticle.content}
                                        </div>

                                        {/* Steps */}
                                        {selectedArticle.steps && (
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                                    Paso a Paso
                                                </h3>
                                                <div className="space-y-3">
                                                    {selectedArticle.steps.map((step, index) => (
                                                        <div key={index} className="flex gap-4 items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 hover:bg-slate-50 transition-colors">
                                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">
                                                                {index + 1}
                                                            </span>
                                                            <p className="text-slate-700 text-sm leading-relaxed pt-0.5">{step}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tip Box */}
                                        {selectedArticle.tip && (
                                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/50 flex gap-3">
                                                <span className="text-xl">💡</span>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-800">Consejo Pro</h4>
                                                    <p className="text-sm text-amber-700/90 leading-relaxed mt-0.5">{selectedArticle.tip}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400">
                                        <p>Selecciona un tema de ayuda de la barra lateral.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
