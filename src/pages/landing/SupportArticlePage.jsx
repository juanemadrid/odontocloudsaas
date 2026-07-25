import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { buildDashboardPath } from '../../utils/dashboardBasePath';
import { FiArrowLeft, FiClock, FiCheckCircle, FiAlertCircle, FiMonitor, FiSettings, FiUserPlus, FiMapPin, FiGrid, FiMessageCircle, FiEdit3, FiSave, FiList, FiActivity, FiTool, FiFileText, FiDownload, FiDollarSign, FiThumbsUp, FiThumbsDown, FiMessageSquare } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

// --- DATA: Artículos Reales (Contenido Mejorado) ---
const ARTICLES = {
    "guia-inicio-rapido": {
        title: "Guía de Inicio Rápido: Configura tu Clínica",
        subtitle: "Aprende a configurar usuarios, sedes y especialidades. Sigue este orden exacto para evitar errores.",
        readTime: "10 min lectura",
        category: "Primeros Pasos",
        content: (
            <div className="space-y-16 text-slate-700" style={{ color: '#334155' }}>
                {/* Introducción */}
                <section>
                    <p className="text-lg leading-relaxed mb-6" style={{ color: '#334155' }}>
                        Para que OdontoCloud funcione correctamente, el sistema necesita una estructura base.
                        No puedes crear una cita sin un doctor, y no puedes crear un doctor sin una especialidad ni una sede.
                        Por eso, el orden de configuración es crítico.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex gap-4 items-start" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                        <FiMonitor className="text-blue-600 text-2xl mt-1 flex-shrink-0" style={{ color: '#2563eb' }} />
                        <div>
                            <h4 className="font-bold text-blue-900 mb-1" style={{ color: '#1e3a8a' }}>Ruta de Navegación</h4>
                            <p className="text-blue-800 text-sm" style={{ color: '#1e40af' }}>
                                Todas las opciones mencionadas aquí se encuentran en el menú lateral izquierdo, dentro del módulo <strong className="font-bold">Configuración</strong>.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Paso 1: Sucursales */}
                <section className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-slate-200 hidden md:block" style={{ backgroundColor: '#e2e8f0' }}></div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>1</span>
                        Sedes y Sucursales
                    </h2>

                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}>
                        <p className="mb-6 text-slate-600" style={{ color: '#475569' }}>
                            La sucursal es el lugar físico donde ocurren las citas. Incluso si solo tienes un consultorio, debes registrarlo como la "Sede Principal".
                        </p>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2" style={{ color: '#0f172a' }}><FiSettings className="text-slate-400" style={{ color: '#94a3b8' }} /> Configuración Mínima</h4>
                                <ul className="space-y-3 text-sm text-slate-600" style={{ color: '#475569' }}>
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="text-green-500 mt-1" style={{ color: '#22c55e' }} />
                                        <span><strong>Nombre y Ciudad:</strong> Obligatorios para los encabezados de reportes.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="text-green-500 mt-1" style={{ color: '#22c55e' }} />
                                        <span><strong>Consecutivo de Facturación:</strong> Debes seleccionar uno (ej. FACT-001) para poder cobrar.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <FiCheckCircle className="text-green-500 mt-1" style={{ color: '#22c55e' }} />
                                        <span><strong>Lista de Precios:</strong> Define qué tarifas se aplican por defecto en esta sede.</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                                <h4 className="font-bold text-slate-900 mb-2" style={{ color: '#0f172a' }}>¿Cómo hacerlo?</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700" style={{ color: '#334155' }}>
                                    <li>Ve a <strong>Configuración {'>'} Sucursales</strong>.</li>
                                    <li>Clic en <strong>+ Nueva sucursal</strong>.</li>
                                    <li>Llena el formulario. Si no tienes almacenes creados, el sistema asignará uno por defecto.</li>
                                    <li>Clic en <strong>Guardar</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Paso 2: Especialidades */}
                <section className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-slate-200 hidden md:block" style={{ backgroundColor: '#e2e8f0' }}></div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>2</span>
                        Especialidades Médicas
                    </h2>

                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}>
                        <p className="mb-4 text-slate-600" style={{ color: '#475569' }}>
                            OdontoCloud usa las especialidades para filtrar la agenda. Un paciente busca cita por "Ortodoncia", no necesariamente por el nombre del doctor.
                        </p>
                        <div className="flex flex-col md:flex-row gap-6 items-center bg-yellow-50 p-4 rounded-lg border border-yellow-100" style={{ backgroundColor: '#fefce8', borderColor: '#fef9c3' }}>
                            <FiAlertCircle className="text-yellow-600 text-3xl flex-shrink-0" style={{ color: '#ca8a04' }} />
                            <p className="text-sm text-yellow-800" style={{ color: '#854d0e' }}>
                                <strong>Importante:</strong> Crea al menos una especialidad llamada "Odontología General" o "Consulta General" si no tienes especialistas.
                            </p>
                        </div>
                        <ul className="mt-6 space-y-2 text-slate-700 list-disc list-inside ml-2" style={{ color: '#334155' }}>
                            <li>Ruta: <strong>Configuración {'>'} Especialidades</strong>.</li>
                            <li>Solo requieres el <strong>Nombre</strong>. La descripción es opcional.</li>
                        </ul>
                    </div>
                </section>

                {/* Paso 3: Usuarios */}
                <section className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-slate-200 hidden md:block" style={{ backgroundColor: '#e2e8f0' }}></div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>3</span>
                        Usuarios y Doctores
                    </h2>

                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-8" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}>
                        <div>
                            <p className="text-slate-600 mb-4" style={{ color: '#475569' }}>
                                Aquí registras a todo el personal. El sistema distingue roles (permisos) de funciones clínicas.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div className="p-4 border border-slate-100 rounded-xl bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                                    <FiUserPlus className="mx-auto text-2xl text-slate-400 mb-2" style={{ color: '#94a3b8' }} />
                                    <div className="font-bold text-slate-900" style={{ color: '#0f172a' }}>Recepcionista</div>
                                    <div className="text-xs text-slate-500" style={{ color: '#64748b' }}>Agenda, Caja, Pacientes</div>
                                </div>
                                <div className="p-4 border border-slate-100 rounded-xl bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                                    <FiSettings className="mx-auto text-2xl text-slate-400 mb-2" style={{ color: '#94a3b8' }} />
                                    <div className="font-bold text-slate-900" style={{ color: '#0f172a' }}>Administrador</div>
                                    <div className="text-xs text-slate-500" style={{ color: '#64748b' }}>Configuración total</div>
                                </div>
                                <div className="p-4 border-2 border-blue-100 rounded-xl bg-blue-50" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                                    <FiUserPlus className="mx-auto text-2xl text-blue-500 mb-2" style={{ color: '#3b82f6' }} />
                                    <div className="font-bold text-blue-700" style={{ color: '#1d4ed8' }}>Doctor/Especialista</div>
                                    <div className="text-xs text-blue-600" style={{ color: '#2563eb' }}>Agenda, Historia Clínica</div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6" style={{ borderColor: '#f1f5f9' }}>
                            <h3 className="text-lg font-bold text-slate-900 mb-4" style={{ color: '#0f172a' }}>Cómo registrar un Doctor correctamente</h3>
                            <p className="text-sm text-slate-600 mb-4" style={{ color: '#475569' }}>
                                Despliega la información para ver los detalles:
                            </p>

                            <div className="space-y-4">
                                <div className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                    <div className="font-bold text-slate-400" style={{ color: '#94a3b8' }}>A</div>
                                    <div>
                                        <div className="font-bold text-slate-800" style={{ color: '#1e293b' }}>Marca la casilla "¿Es Profesional de la Salud?"</div>
                                        <div className="text-sm text-slate-500" style={{ color: '#64748b' }}>Esto habilitará las opciones clínicas en el formulario.</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                    <div className="font-bold text-slate-400" style={{ color: '#94a3b8' }}>B</div>
                                    <div>
                                        <div className="font-bold text-slate-800" style={{ color: '#1e293b' }}>Asigna Especialidades</div>
                                        <div className="text-sm text-slate-500" style={{ color: '#64748b' }}>Selecciona las especialidades que creaste en el paso anterior.</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                    <div className="font-bold text-slate-400" style={{ color: '#94a3b8' }}>C</div>
                                    <div>
                                        <div className="font-bold text-slate-800" style={{ color: '#1e293b' }}>Asigna Sucursales</div>
                                        <div className="text-sm text-slate-500" style={{ color: '#64748b' }}>Marca las sedes donde este doctor tiene permiso para atender.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final */}
                <section className="bg-slate-900 rounded-2xl p-8 text-center text-white relative overflow-hidden" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    <h3 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>Sistema Configurado</h3>
                    <p className="text-slate-300 mb-6 max-w-2xl mx-auto" style={{ color: '#cbd5e1' }}>
                        Si has completado estos 3 pasos, tu clínica está lista para recibir el primer paciente.
                    </p>
                    <Link to={buildDashboardPath()} className="inline-block bg-white text-slate-900 font-bold py-3 px-8 rounded-full hover:bg-slate-100 transition-colors" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                        Ir al Panel Principal
                    </Link>
                </section>
            </div>
        )
    },
    // Configuración de WhatsApp COMPLETA
    "configuracion-whatsapp": {
        title: "Configuración de WhatsApp",
        subtitle: "Aprende a personalizar los mensajes automáticos y conectar tu cuenta.",
        readTime: "5 min lectura",
        category: "Automatización",
        content: (
            <div className="space-y-16 text-slate-700" style={{ color: '#334155' }}>
                <section>
                    <p className="text-lg leading-relaxed mb-6" style={{ color: '#334155' }}>
                        OdontoCloud te permite enviar confirmaciones de citas y códigos de firma digital a tus pacientes directamente por WhatsApp.
                        Puedes usar la versión gratuita (redirección) o conectar una API profesional.
                    </p>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex gap-4 items-start" style={{ backgroundColor: '#effdf5', borderColor: '#bbf7d0' }}>
                        <FiMessageCircle className="text-green-600 text-2xl mt-1 flex-shrink-0" style={{ color: '#16a34a' }} />
                        <div>
                            <h4 className="font-bold text-green-900 mb-1" style={{ color: '#14532d' }}>Ruta de Navegación</h4>
                            <p className="text-green-800 text-sm" style={{ color: '#166534' }}>
                                Ve al menú lateral: <strong className="font-bold">Configuración {'>'} Parámetros</strong> y busca la sección "Agenda".
                            </p>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#16a34a', color: '#ffffff' }}>1</span>
                        Personalizar el Mensaje de Citas
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}>
                        <p className="mb-4 text-slate-600" style={{ color: '#475569' }}>
                            Puedes crear tu propia plantilla. El sistema reemplazará automáticamente los datos entre corchetes.
                        </p>
                        <h4 className="font-bold text-slate-900 mb-2 mt-6" style={{ color: '#0f172a' }}>Variables Disponibles:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono mb-6">
                            <span className="bg-slate-100 p-2 rounded text-slate-600 border border-slate-200" style={{ borderColor: '#e2e8f0', backgroundColor: '#f1f5f9', color: '#475569' }}>[PatientName]</span>
                            <span className="bg-slate-100 p-2 rounded text-slate-600 border border-slate-200" style={{ borderColor: '#e2e8f0', backgroundColor: '#f1f5f9', color: '#475569' }}>[Date]</span>
                            <span className="bg-slate-100 p-2 rounded text-slate-600 border border-slate-200" style={{ borderColor: '#e2e8f0', backgroundColor: '#f1f5f9', color: '#475569' }}>[Hour]</span>
                            <span className="bg-slate-100 p-2 rounded text-slate-600 border border-slate-200" style={{ borderColor: '#e2e8f0', backgroundColor: '#f1f5f9', color: '#475569' }}>[Link]</span>
                        </div>
                        <div className="bg-slate-800 text-green-400 p-4 rounded-lg font-mono text-sm leading-relaxed border border-slate-700 shadow-inner" style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#4ade80' }}>
                            "Hola [PatientName], recuerda tu cita en OdontoCloud el día [Date] a las [Hour]. Confirma aquí: [Link]"
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#16a34a', color: '#ffffff' }}>2</span>
                        Tipos de Envío
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                            <div className="text-green-500 text-xl mb-3 font-bold" style={{ color: '#22c55e' }}>Versión Gratis</div>
                            <p className="text-slate-600 text-sm mb-4" style={{ color: '#475569' }}>
                                Abre la app de WhatsApp Desktop o Web en tu computadora con el mensaje prellenado. Tú debes dar clic en "Enviar".
                            </p>
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded" style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}>Incluido en todos los planes</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                            <div className="text-blue-500 text-xl mb-3 font-bold" style={{ color: '#3b82f6' }}>Versión API (Automático)</div>
                            <p className="text-slate-600 text-sm mb-4" style={{ color: '#475569' }}>
                                Envía los mensajes en segundo plano automáticamente sin que tengas que hacer nada. Requiere integración con Woflo o Meta.
                            </p>
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>Requiere configuración extra</span>
                        </div>
                    </div>
                </section>

                <section className="bg-slate-50 p-6 rounded-xl text-center" style={{ backgroundColor: '#f8fafc' }}>
                    <p className="text-slate-600" style={{ color: '#475569' }}>
                        ¿Necesitas ayuda conectando la API? Contacta a soporte técnico para una integración asistida.
                    </p>
                </section>
            </div>
        )
    },
    // Odontograma COMPLETO
    "odontograma-3d": {
        title: "Odontograma y Evoluciones",
        subtitle: "Guía completa para registrar hallazgos y tratamientos en el odontograma 2D interactivo.",
        readTime: "8 min lectura",
        category: "Clínico",
        content: (
            <div className="space-y-16 text-slate-700" style={{ color: '#334155' }}>
                {/* Introducción */}
                <section>
                    <p className="text-lg leading-relaxed mb-6" style={{ color: '#334155' }}>
                        El odontograma es el corazón del módulo clínico. Te permite registrar el estado inicial del paciente, planificar el tratamiento y marcar lo que ya realizaste, todo en un solo lugar visual.
                    </p>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex gap-4 items-start" style={{ backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }}>
                        <FiActivity className="text-indigo-600 text-2xl mt-1 flex-shrink-0" style={{ color: '#4f46e5' }} />
                        <div>
                            <h4 className="font-bold text-indigo-900 mb-1" style={{ color: '#312e81' }}>Flujo de Trabajo Recomendado</h4>
                            <p className="text-indigo-800 text-sm" style={{ color: '#3730a3' }}>
                                Diagnóstico (Inicial) {'->'} Plan de Tratamiento (Presupuesto) {'->'} Ejecución (Evolución Real).
                            </p>
                        </div>
                    </div>
                </section>

                {/* Paso 1: Fases */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}>1</span>
                        Las 3 Fases del Odontograma
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl border border-slate-200" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                            <div className="font-bold text-indigo-700 mb-2" style={{ color: '#4338ca' }}>1. Estado Inicial</div>
                            <p className="text-xs text-slate-500" style={{ color: '#64748b' }}>
                                Lo que el paciente trae en su boca la primera vez (ej. Curaciones viejas, dientes perdidos).
                            </p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                            <div className="font-bold text-amber-600 mb-2" style={{ color: '#d97706' }}>2. Plan de Tratamiento</div>
                            <p className="text-xs text-slate-500" style={{ color: '#64748b' }}>
                                Lo que <strong>propones</strong> hacer. Esto alimenta el presupuesto de venta. Se marca en color naranja/amarillo.
                            </p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                            <div className="font-bold text-emerald-600 mb-2" style={{ color: '#059669' }}>3. Evolución Real</div>
                            <p className="text-xs text-slate-500" style={{ color: '#64748b' }}>
                                Lo que <strong>realmente hiciste</strong> hoy. Se marca como realizado y descarta del inventario si aplica.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Paso 2: Herramientas */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}>2</span>
                        Convenciones y Herramientas
                    </h2>
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}>
                        <p className="mb-6 text-slate-600" style={{ color: '#475569' }}>
                            Selecciona una herramienta de la barra lateral izquierda y luego haz clic en la zona del diente (Central, Distal, Mesial, etc.).
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { l: "Caries", c: "#ef4444" },
                                { l: "Resina", c: "#3b82f6" },
                                { l: "Amalgama", c: "#64748b" },
                                { l: "Corona", c: "#eab308" },
                                { l: "Endodoncia", c: "#a855f7" },
                                { l: "Extracción", c: "#000000" },
                                { l: "Sano/Borrador", c: "#e2e8f0" },
                                { l: "Sellante", c: "#10b981" },
                            ].map(item => (
                                <div key={item.l} className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full border border-slate-100" style={{ backgroundColor: item.c }}></span>
                                    <span className="text-sm font-medium" style={{ color: '#334155' }}>{item.l}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-slate-50 p-6 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                    <h3 className="font-bold text-slate-900 mb-2" style={{ color: '#0f172a' }}>¿Cómo cambiar dentición?</h3>
                    <p className="text-slate-600 text-sm" style={{ color: '#475569' }}>
                        Usa los botones superiores para alternar entre <strong>Adulto</strong>, <strong>Mixta</strong> o <strong>Niño</strong>. Esto ocultará o mostrará los dientes temporales automáticamente.
                    </p>
                </section>
            </div>
        )
    },
    // RIPS Full
    "gestion-rips": {
        title: "RIPS y Facturación Electrónica",
        subtitle: "Guía para la generación de Archivos JSON (Res. 2275) y reportes de facturación.",
        readTime: "6 min lectura",
        category: "Administrativo",
        content: (
            <div className="space-y-16 text-slate-700" style={{ color: '#334155' }}>
                {/* Intro */}
                <section>
                    <p className="text-lg leading-relaxed mb-6" style={{ color: '#334155' }}>
                        OdontoCloud te ayuda a cumplir con la normativa colombiana actualizando sus formatos a la Resolución 2275 (JSON).
                        El proceso de generación de RIPS está integrado directamente con el módulo de Cargos y Facturas.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-orange-50 border border-orange-100 p-5 rounded-xl" style={{ backgroundColor: '#fff7ed', borderColor: '#ffedd5' }}>
                            <div className="flex items-center gap-3 mb-2">
                                <FiAlertCircle className="text-orange-600 text-xl" style={{ color: '#ea580c' }} />
                                <span className="font-bold text-orange-900" style={{ color: '#7c2d12' }}>Requisito Previo</span>
                            </div>
                            <p className="text-sm text-orange-800" style={{ color: '#9a3412' }}>
                                Para que el JSON se genere sin errores, cada procedimiento en tu <strong>Lista de Precios</strong> debe tener asignado su <strong>Código CUPS</strong> oficial.
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                            <div className="flex items-center gap-3 mb-2">
                                <FiFileText className="text-blue-600 text-xl" style={{ color: '#2563eb' }} />
                                <span className="font-bold text-blue-900" style={{ color: '#1e3a8a' }}>Estructura JSON</span>
                            </div>
                            <p className="text-sm text-blue-800" style={{ color: '#1e40af' }}>
                                El sistema genera automáticamente el archivo con los campos obligatorios: Datos del usuario, transacción, y detalles de medicamentos/procedimientos.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Flujo paso a paso */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>1</span>
                        Cómo Generar RIPS en 4 Pasos
                    </h2>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500" style={{ backgroundColor: '#f1f5f9' }}>A</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 w-full shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                <h4 className="font-bold text-slate-900 mb-1" style={{ color: '#0f172a' }}>Realizar la Evolución Clínica</h4>
                                <p className="text-sm text-slate-600" style={{ color: '#475569' }}>
                                    El doctor debe marcar el tratamiento como "Realizado" en el Odontograma o Evoluciones. Esto confirma que el servicio se prestó.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500" style={{ backgroundColor: '#f1f5f9' }}>B</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 w-full shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                <h4 className="font-bold text-slate-900 mb-1" style={{ color: '#0f172a' }}>Generar la Factura de Venta</h4>
                                <p className="text-sm text-slate-600" style={{ color: '#475569' }}>
                                    Ve a la ficha del paciente, pestaña <strong>Presupuestos / Facturación</strong>. Convierte el presupuesto en factura. Sin factura, no hay RIPS.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500" style={{ backgroundColor: '#f1f5f9' }}>C</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 w-full shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                <h4 className="font-bold text-slate-900 mb-1" style={{ color: '#0f172a' }}>Descargar Archivo JSON</h4>
                                <p className="text-sm text-slate-600" style={{ color: '#475569' }}>
                                    En la misma pestaña de Facturación, encontrarás el botón <span className="font-mono bg-slate-100 px-1 rounded">Generar RIPS (JSON)</span>. Al hacer clic, el sistema validará los datos.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Validación */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3" style={{ color: '#0f172a' }}>
                        <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>2</span>
                        Validación y Errores Comunes
                    </h2>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-bold" style={{ backgroundColor: '#f8fafc', color: '#334155' }}>
                                <tr>
                                    <th className="p-4 border-b">Error Común</th>
                                    <th className="p-4 border-b">Solución</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100" style={{ borderColor: '#f1f5f9' }}>
                                <tr>
                                    <td className="p-4 text-red-600 font-medium" style={{ color: '#dc2626' }}>"Código CUPS no encontrado"</td>
                                    <td className="p-4 text-slate-600" style={{ color: '#475569' }}>Edita el procedimiento en Configuración {'>'} Lista de Precios y añade el código oficial.</td>
                                </tr>
                                <tr>
                                    <td className="p-4 text-red-600 font-medium" style={{ color: '#dc2626' }}>"Falta Diagnóstico Principal"</td>
                                    <td className="p-4 text-slate-600" style={{ color: '#475569' }}>El doctor debe asignar un código CIE-10 a la evolución antes de cerrar la cita.</td>
                                </tr>
                                <tr>
                                    <td className="p-4 text-red-600 font-medium" style={{ color: '#dc2626' }}>"Tipo de Documento inválido"</td>
                                    <td className="p-4 text-slate-600" style={{ color: '#475569' }}>Verifica que el paciente tenga seleccionado Cédula, TI, etc., compatible con la norma.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="bg-slate-900 text-white p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <div>
                        <h4 className="font-bold text-lg mb-1" style={{ color: '#ffffff' }}>¿Listo para facturar?</h4>
                        <p className="text-slate-400 text-sm" style={{ color: '#94a3b8' }}>Asegúrate de tener tus consecutivos de facturación configurados.</p>
                    </div>
                    <Link to="/config/consecutivos" className="px-6 py-3 bg-[#d4f938] hover:bg-[#bef028] text-slate-900 rounded-xl font-bold shadow-lg shadow-lime-900/20 transition-all flex items-center gap-2" style={{ backgroundColor: '#d4f938', color: '#0f172a' }}>
                        <FiSettings /> Ir a Configuración
                    </Link>
                </section>
            </div>
        )
    }
};

export default function SupportArticlePage() {
    const { slug } = useParams();
    const article = ARTICLES[slug];
    const [feedbackSent, setFeedbackSent] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        setFeedbackSent(false);
    }, [slug]);

    const handleFeedback = (type) => {
        if (type === 'yes') {
            setFeedbackSent(true);
            // In a real app, send analytics event here
        } else {
            // Open WhatsApp support with predefined message
            const message = `Hola, necesito ayuda con la guía de soporte: ${article?.title || 'OdontoCloud'}`;
            window.open(`https://wa.me/573015768955?text=${encodeURIComponent(message)}`, '_blank');
        }
    };

    if (!article) {
        return (
            <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', color: '#0f172a' }} className="flex flex-col items-center justify-center p-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-4" style={{ color: '#1e293b' }}>Artículo no encontrado</h2>
                <Link to="/soporte" className="text-blue-600 hover:underline font-bold" style={{ color: '#2563eb' }}>Volver al Centro de Ayuda</Link>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', color: '#0f172a' }} className="font-sans text-slate-900 relative z-50">
            {/* Header / Hero CLEAN WHITE */}
            <div style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9' }} className="pt-32 pb-16 px-6 border-b border-slate-100 relative overflow-hidden">
                <div className="max-w-4xl mx-auto relative z-10">
                    <Link to="/soporte" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 transition-colors text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                        <FiArrowLeft /> Volver al Centro de Ayuda
                    </Link>

                    <span className="block text-blue-600 font-bold tracking-widest text-xs uppercase mb-3" style={{ color: '#2563eb' }}>{article.category || "Guía"}</span>
                    <h1 style={{ color: '#0f172a' }} className="text-4xl md:text-5xl font-display font-black mb-6 leading-tight tracking-tight">{article.title}</h1>
                    <p style={{ color: '#64748b' }} className="text-xl font-light max-w-2xl leading-relaxed">{article.subtitle}</p>

                    {article.readTime && (
                        <div className="flex items-center gap-2 mt-6 text-slate-400 text-sm font-medium" style={{ color: '#94a3b8' }}>
                            <FiClock /> {article.readTime}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <article className="max-w-4xl mx-auto px-6 py-16" style={{ backgroundColor: '#ffffff', color: '#334155' }}>
                {article.content}
            </article>

            {/* Footer Navigation */}
            <div className="border-t border-slate-100 py-16 bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-4" style={{ color: '#1e293b' }}>¿Te fue útil esta guía?</h3>

                    <AnimatePresence mode="wait">
                        {feedbackSent ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-green-600 font-bold flex items-center justify-center gap-2"
                            >
                                <FiCheckCircle className="text-xl" />
                                <span>¡Gracias por tu opinión! Trabajamos para mejorar.</span>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex justify-center gap-4"
                            >
                                <button
                                    onClick={() => handleFeedback('yes')}
                                    className="px-8 py-3 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:shadow-lg transition-all font-bold text-sm flex items-center gap-2 group"
                                    style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#475569' }}
                                >
                                    <FiThumbsUp className="group-hover:scale-110 transition-transform" /> Sí, gracias
                                </button>
                                <button
                                    onClick={() => handleFeedback('no')}
                                    className="px-8 py-3 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-red-400 hover:text-red-500 transition-all font-bold text-sm flex items-center gap-2"
                                    style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#475569' }}
                                >
                                    <FiMessageSquare /> Necesito más ayuda
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <p className="mt-8 text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                        ¿Tienes sugerencias adicionales? Escríbenos directamente a través del botón de soporte en la parte superior.
                    </p>
                </div>
            </div>
        </div>
    );
}
