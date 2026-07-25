import React from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { FiBook, FiPrinter, FiShield, FiLock, FiCheckCircle } from 'react-icons/fi';

export default function LegalPage() {
    const location = useLocation();
    const isTerms = location.pathname.includes('terminos');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', color: '#0f172a' }} className="pt-32 pb-20">
            {/* Print-specific Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    header, footer, .no-print { display: none !important; }
                    .print-container { padding: 10pt 40pt !important; margin: 0 !important; width: 100% !important; max-width: none !important; position: relative; }
                    body { background: white !important; font-size: 11pt !important; color: #111 !important; line-height: 1.5 !important; }
                    .prose { max-width: none !important; }
                    .print-header { display: flex !important; align-items: center; justify-content: space-between; border-bottom: 2px solid #022a63; margin-bottom: 25pt; padding-bottom: 10pt; }
                    .print-logo { height: 45pt !important; width: auto !important; }
                    h1 { font-size: 24pt !important; margin-bottom: 12pt !important; color: #022a63 !important; }
                    h2 { font-size: 15pt !important; margin-top: 20pt !important; border-bottom: 1px solid #ddd !important; padding-bottom: 4pt !important; color: #022a63 !important; page-break-after: avoid; }
                    p, li { margin-bottom: 10pt !important; text-align: justify; }
                    .page-break { page-break-before: always; }
                    
                    /* Watermark */
                    .watermark {
                        display: block !important;
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-35deg);
                        opacity: 0.02 !important;
                        font-size: 110pt;
                        font-weight: 900;
                        color: #000;
                        z-index: -1;
                        pointer-events: none;
                        white-space: nowrap;
                    }

                    /* Section Fixes */
                    .compromiso-box { 
                        page-break-inside: avoid !important;
                        background: #f1f5f9 !important; 
                        border: 1.5pt solid #022a63 !important; 
                        color: #022a63 !important;
                        padding: 25pt !important;
                        border-radius: 8pt !important;
                        margin-top: 30pt !important;
                    }
                    .compromiso-box h3 { color: #022a63 !important; font-size: 18pt !important; margin-bottom: 10pt !important; }
                    .compromiso-box p { color: #334155 !important; font-style: italic !important; }

                    /* Signature area */
                    .signature-area {
                        display: block !important;
                        margin-top: 30pt;
                        display: flex;
                        justify-content: space-between;
                        page-break-inside: avoid !important;
                    }
                    .sig-box {
                        width: 42%;
                        border-top: 1pt solid #444;
                        padding-top: 6pt;
                    }
                    .print-footer {
                        margin-top: 20pt !important;
                        padding-top: 10pt !important;
                    }
                }
                @media screen {
                    .print-header, .watermark, .signature-area { display: none; }
                }
            `}} />

            <div className="container mx-auto px-6 max-w-4xl print-container">
                {/* Print-only Elements */}
                <div className="watermark">ODONTOCLOUD</div>

                <div className="print-header">
                    <div className="flex items-center gap-4">
                        <img
                            src={import.meta.env.BASE_URL + "assets/logo.png"}
                            alt="OdontoCloud Logo"
                            className="print-logo"
                        />
                        <span className="text-2xl font-black text-[#022a63]">
                            Odonto<span className="text-blue-500">Cloud</span>
                        </span>
                    </div>
                    <div className="text-right text-[10pt] text-slate-500 font-light">
                        www.odontocloud.co<br />
                        Soporte: +57 301 576 8935
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-slate prose-lg max-w-none"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-slate-100 no-print" style={{ borderColor: '#e2e8f0' }}>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-2" style={{ color: '#0f172a' }}>
                                {isTerms ? 'Términos del Servicio' : 'Política de Privacidad'}
                            </h1>
                            <p className="text-slate-500 font-light tracking-wide italic" style={{ color: '#64748b' }}>
                                OdontoCloud SaaS - Última actualización: 4 de febrero de 2026
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="whitespace-nowrap bg-[#022a63] text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/10 active:scale-95"
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        >
                            <FiPrinter /> Generar Documento PDF
                        </button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 mb-16 no-print">
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                            <FiShield className="text-blue-500 text-3xl mb-4" style={{ color: '#3b82f6' }} />
                            <h4 className="font-bold text-blue-900 mb-2" style={{ color: '#1e3a8a' }}>Seguridad Bancaria</h4>
                            <p className="text-blue-700/70 text-sm leading-relaxed" style={{ color: '#1e40af' }}>Encriptación de punto a punto AES-256 para proteger cada dato clínico.</p>
                        </div>
                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100" style={{ backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }}>
                            <FiLock className="text-indigo-500 text-3xl mb-4" style={{ color: '#6366f1' }} />
                            <h4 className="font-bold text-indigo-900 mb-2" style={{ color: '#312e81' }}>Habeas Data</h4>
                            <p className="text-indigo-700/70 text-sm leading-relaxed" style={{ color: '#3730a3' }}>Cumplimiento total con la Ley 1581 y normativas internacionales de privacidad.</p>
                        </div>
                        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100" style={{ backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }}>
                            <FiCheckCircle className="text-emerald-500 text-3xl mb-4" style={{ color: '#10b981' }} />
                            <h4 className="font-bold text-emerald-900 mb-2" style={{ color: '#064e3b' }}>Respaldo Cloud</h4>
                            <p className="text-emerald-700/70 text-sm leading-relaxed" style={{ color: '#065f46' }}>Copias de seguridad automáticas en tiempo real en AWS y Google Cloud.</p>
                        </div>
                    </div>

                    <section className="space-y-12 text-slate-700 leading-relaxed font-light font-sans" style={{ color: '#334155' }}>
                        {isTerms ? (
                            <>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>1. Aceptación de los Términos</h2>
                                    <p>
                                        Al acceder y utilizar el ecosistema SaaS de OdontoCloud, el usuario (en adelante "El Prestador") manifiesta su aceptación plena y sin reservas a los presentes términos. Este acuerdo rige la relación entre OdontoCloud y la clínica dental para la prestación de servicios de software en la nube. Si no está de acuerdo con estos términos, debe abstenerse de utilizar la plataforma.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>2. Licencia de Uso y Restricciones</h2>
                                    <p>
                                        OdontoCloud otorga una licencia limitada, no exclusiva, intransferible y revocable para operar sus módulos administrativos y clínicos. El Prestador se compromete a no realizar ingeniería inversa, copiado de código fuente, reventa no autorizada del software o uso del sistema para fines ajenos a la gestión odontológica profesional y legalmente constituida.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>3. Tarifas, Pagos y Facturación</h2>
                                    <p>
                                        La contraprestación por el uso del software se rige por el plan de suscripción seleccionado (Básico o Corporativo). Los pagos se realizarán de forma anticipada. El incumplimiento en el pago generará la suspensión temporal del servicio tras 5 días calendario de mora. OdontoCloud se reserva el derecho de ajustar sus tarifas con un previo aviso de 30 días.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>4. Disponibilidad del Servicio (SLA)</h2>
                                    <p>
                                        OdontoCloud garantiza una disponibilidad del sistema (uptime) del 99.9% mensual, excluyendo mantenimientos programados informados con antelación. Contamos con una arquitectura de alta disponibilidad para asegurar que la clínica pueda operar de forma continua y sin interrupciones críticas en el flujo de pacientes.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>5. Propiedad Intelectual</h2>
                                    <p>
                                        Cualquier logo, marca, código fuente, interfaz de usuario y arquitectura de base de datos son propiedad exclusiva de OdontoCloud. El Prestador mantiene la propiedad absoluta sobre la información clínica y personal de sus pacientes cargada al sistema, siendo OdontoCloud únicamente el custodio tecnológico de dicha información.
                                    </p>
                                </div>
                                <div className="page-break">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>6. Terminación y Migración de Datos</h2>
                                    <p>
                                        Cualquiera de las partes puede dar por terminado el servicio con un preaviso de 30 días. En caso de retiro, OdontoCloud se compromete a facilitar la exportación de la base de datos de pacientes en formatos estándares (Excel/CSV) y las historias clínicas en PDF, garantizando así la portabilidad y el cumplimiento del Prestador con las leyes de custodia de historial clínico.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>7. Limitación de Responsabilidad</h2>
                                    <p>
                                        OdontoCloud no se hace responsable por diagnósticos médicos, decisiones clínicas o fallas en el tratamiento aplicados por los profesionales de la clínica. El software es una herramienta de gestión y apoyo, siendo la responsabilidad médica exclusiva del doctor tratante y la clínica prestadora.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>1. Declaración de Responsabilidades</h2>
                                    <p>
                                        En cumplimiento con la Ley 1581 de 2012 y el Decreto 1377 de 2013, OdontoCloud informa que actúa bajo la figura de **Encargado del Tratamiento**. La clínica dental (El Cliente) es el único **Responsable del Tratamiento** de los datos sensibles de sus pacientes, obligándose a obtener de cada paciente la autorización expresa para el tratamiento de su información clínica.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>2. Finalidad de la Recolección</h2>
                                    <p>
                                        Los datos procesados en nuestra plataforma tienen como única finalidad técnica facilitar la gestión odontológica: agendamiento inteligente, registro de historias clínicas, generación de RIPS, facturación y seguimiento de tratamientos. No compartimos ni comercializamos datos con farmacéuticas, aseguradoras o terceros con fines de prospección comercial.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>3. Medidas de Seguridad de Datos</h2>
                                    <p>
                                        Implementamos un sistema de gestión de seguridad de la información inspirado en la norma ISO 27001. Todos los datos viajan y se almacenan encriptados (AES-256). El acceso a la plataforma está protegido por perfiles de usuario con permisos granulares, evitando que el personal administrativo acceda a información clínica sensible no autorizada.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>4. Retención y Conservación</h2>
                                    <p>
                                        La información clínica se conservará en nuestros servidores de alta seguridad por el tiempo que dure la relación comercial y, posteriormente, se mantendrá en custodia inactiva según los términos legales de conservación de historias clínicas vigentes en el país de operación (mínimo 15 años en Colombia), o hasta que el Responsable solicite su eliminación definitiva.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>5. Cookies y Tecnologías de Seguimiento</h2>
                                    <p>
                                        Utilizamos cookies técnicas estrictamente necesarias para mantener la seguridad de la sesión del usuario. También empleamos analítica anónima para medir el rendimiento de la plataforma. El usuario puede configurar su navegador para limitar estas tecnologías, entendiendo que esto podría afectar algunas funciones de personalización del sistema.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>6. Derechos de los Titulares (ARCO)</h2>
                                    <p>
                                        Los titulares de los datos (pacientes y doctores) tienen derecho a conocer, actualizar, rectificar y suprimir su información. Estas solicitudes deben ser gestionadas inicialmente por la clínica dental. OdontoCloud prestará todo el apoyo técnico necesario para que el Responsable cumpla con estas solicitudes en un plazo máximo de 10 días hábiles.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display" style={{ color: '#0f172a' }}>7. Transferencia Internacional de Datos</h2>
                                    <p>
                                        Para garantizar la máxima disponibilidad y resistencia ante desastres naturales, los datos podrán ser almacenados en servidores internacionales (AWS/Google Cloud) que cuenten con niveles de protección iguales o superiores a los exigidos por la normativa local colombiana.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="compromiso-box bg-[#022a63] text-white p-12 rounded-[3.5rem] mt-16 relative overflow-hidden shadow-2xl" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-6 font-display" style={{ color: '#ffffff' }}>Compromiso Legal OdontoCloud</h3>
                                <p className="text-blue-100 font-light text-xl leading-relaxed" style={{ color: '#cbd5e1' }}>
                                    "Entendemos que la información de tus pacientes es el activo más valioso de tu clínica. Por eso, nuestra arquitectura digital está diseñada bajo el principio de **Privacy by Design**, garantizando que la seguridad no sea una opción, sino la base de cada línea de código."
                                </p>
                            </div>
                            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px]" />
                        </div>

                        {/* Print-only Signature Area */}
                        <div className="signature-area">
                            <div className="sig-box">
                                <span className="text-xs uppercase font-bold text-slate-900">Por OdontoCloud SaaS</span>
                                <p className="text-[10pt] mt-1">Representante Legal</p>
                            </div>
                            <div className="sig-box">
                                <span className="text-xs uppercase font-bold text-slate-900">Por El Prestador / Clínica</span>
                                <p className="text-[10pt] mt-1">Firma y Sello Autorizado</p>
                            </div>
                        </div>
                    </section>
                </motion.div>

                {/* Print Footer */}
                <div className="hidden print-only:flex flex-col items-center mt-12 pt-8 border-t border-slate-200 text-center text-[9pt] text-slate-400 font-light print-footer">
                    <p>Documento generado digitalmente el {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    <p className="mt-1 font-bold">OdontoCloud SaaS v4.0 - Software Certificado de Gestión Dental en la Nube</p>
                    <p className="mt-2 italic">Este documento tiene validez legal como anexo técnico del contrato de prestación de servicios.</p>
                </div>
            </div>
        </div>
    );
}
