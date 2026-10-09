import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
    FiBook,
    FiPrinter,
    FiShield,
    FiLock,
    FiCheckCircle,
    FiFileText,
    FiDatabase,
    FiAward,
    FiInfo,
    FiClock,
    FiMail,
    FiPhone,
    FiMapPin
} from 'react-icons/fi';

export default function LegalPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // Determinar pestaña activa a partir de la ruta
    const isTermsPath = location.pathname.includes('terminos');
    const [activeTab, setActiveTab] = useState(isTermsPath ? 'terminos' : 'privacidad');

    useEffect(() => {
        if (location.pathname.includes('terminos')) {
            setActiveTab('terminos');
        } else if (location.pathname.includes('privacidad')) {
            setActiveTab('privacidad');
        }
    }, [location.pathname]);

    const handleSwitchTab = (tab) => {
        setActiveTab(tab);
        const targetPath = tab === 'terminos' ? '/terminos' : '/privacidad';
        if (location.pathname !== targetPath && !location.pathname.startsWith('/c/')) {
            navigate(targetPath, { replace: false });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', color: '#0f172a' }} className="pt-28 pb-20">
            {/* Estilos específicos para impresión / PDF oficial */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    header, footer, nav, .no-print, .viva-navbar, .viva-footer { display: none !important; }
                    .print-container { padding: 8pt 30pt !important; margin: 0 !important; width: 100% !important; max-width: none !important; position: relative; }
                    body { background: white !important; font-size: 10.5pt !important; color: #111 !important; line-height: 1.55 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
                    .prose { max-width: none !important; }
                    .print-header { display: flex !important; align-items: center; justify-content: space-between; border-bottom: 2px solid #022a63; margin-bottom: 20pt; padding-bottom: 8pt; }
                    .print-logo { height: 42pt !important; width: auto !important; }
                    h1 { font-size: 22pt !important; margin-bottom: 8pt !important; color: #022a63 !important; }
                    h2 { font-size: 13.5pt !important; margin-top: 18pt !important; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 3pt !important; color: #022a63 !important; page-break-after: avoid; font-weight: bold !important; }
                    h3 { font-size: 11.5pt !important; color: #1e293b !important; margin-top: 12pt !important; page-break-after: avoid; font-weight: 600 !important; }
                    p, li { margin-bottom: 8pt !important; text-align: justify; text-justify: inter-word; }
                    ul, ol { padding-left: 18pt !important; margin-bottom: 10pt !important; }
                    .page-break { page-break-before: always; }
                    
                    /* Watermark oficial */
                    .watermark {
                        display: block !important;
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-35deg);
                        opacity: 0.035 !important;
                        font-size: 90pt;
                        font-weight: 900;
                        color: #000;
                        z-index: -1;
                        pointer-events: none;
                        white-space: nowrap;
                    }

                    .compromiso-box { 
                        page-break-inside: avoid !important;
                        background: #f8fafc !important; 
                        border: 1.5pt solid #022a63 !important; 
                        color: #022a63 !important;
                        padding: 18pt !important;
                        border-radius: 6pt !important;
                        margin-top: 24pt !important;
                    }
                    .compromiso-box h3 { color: #022a63 !important; font-size: 14pt !important; margin-bottom: 6pt !important; }
                    .compromiso-box p { color: #334155 !important; font-style: italic !important; font-size: 10pt !important; }

                    .signature-area {
                        display: block !important;
                        margin-top: 35pt;
                        display: flex;
                        justify-content: space-between;
                        page-break-inside: avoid !important;
                    }
                    .sig-box {
                        width: 44%;
                        border-top: 1.2pt solid #334155;
                        padding-top: 6pt;
                    }
                    .print-footer {
                        margin-top: 25pt !important;
                        padding-top: 10pt !important;
                    }
                }
                @media screen {
                    .print-header, .watermark, .signature-area { display: none; }
                }
            `}} />

            <div className="container mx-auto px-4 md:px-6 max-w-5xl print-container">
                {/* Elementos exclusivos de impresión */}
                <div className="watermark">ODONTOCLOUD COLOMBIA</div>

                <div className="print-header">
                    <div className="flex items-center gap-3">
                        <img
                            src={import.meta.env.BASE_URL + "assets/logo.png"}
                            alt="OdontoCloud Logo"
                            className="print-logo"
                        />
                        <div>
                            <span className="text-2xl font-black text-[#022a63] block">
                                Odonto<span className="text-sky-600">Cloud</span>
                            </span>
                            <span className="text-[9pt] text-slate-500 font-medium">
                                Software Odontológico en la Nube • República de Colombia
                            </span>
                        </div>
                    </div>
                    <div className="text-right text-[9pt] text-slate-600 font-light leading-snug">
                        <strong>Ecosistema SaaS Clínico OdontoCloud</strong><br />
                        NIT / Domicilio: Colombia<br />
                        Portal: www.odontocloudcolombia.com<br />
                        Soporte Legal: privacidad@odontocloudcolombia.com
                    </div>
                </div>

                {/* Encabezado y Navegación entre Pestañas Legales (Pantalla) */}
                <div className="no-print mb-8">
                    {/* Badge de Normativa Colombiana Vigente */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <FiAward className="text-blue-600" /> Marco Legal Colombiano Vigente 2026
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FiCheckCircle className="text-emerald-600" /> Ley 1581 de 2012 • Habeas Data
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <FiDatabase className="text-sky-600" /> Resoluciones MinSalud 1995/1999 & 839/2017
                        </span>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                                {activeTab === 'terminos' ? 'Términos y Condiciones del Servicio' : 'Política de Privacidad y Tratamiento de Datos'}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1.5 flex items-center gap-2">
                                <FiClock className="text-slate-400" />
                                <span>OdontoCloud SaaS Colombia • Actualizado y conforme a la normativa vigente</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-300 shadow-sm active:scale-95"
                                title="Descargar o imprimir copia oficial con formato de auditoría"
                            >
                                <FiPrinter className="text-base" /> Imprimir / Guardar PDF
                            </button>
                        </div>
                    </div>

                    {/* Selector de Pestañas Interactivas */}
                    <div className="flex gap-2 mt-6 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 w-fit max-w-full overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => handleSwitchTab('terminos')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'terminos'
                                    ? 'bg-[#022a63] text-white shadow-md shadow-blue-900/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                        >
                            <FiFileText size={16} /> Términos del Servicio
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchTab('privacidad')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === 'privacidad'
                                    ? 'bg-[#022a63] text-white shadow-md shadow-blue-900/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                        >
                            <FiShield size={16} /> Política de Privacidad & Habeas Data
                        </button>
                    </div>
                </div>

                {/* Tarjetas de Respaldo y Blindaje Legal (Pantalla) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 no-print">
                    <div className="p-5 bg-gradient-to-br from-blue-50/80 to-white rounded-2xl border border-blue-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                            <FiShield size={20} />
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mb-1">Encargado vs Responsable</h4>
                        <p className="text-slate-600 text-xs leading-relaxed">
                            Conforme al Art. 3 de la Ley 1581/2012, OdontoCloud actúa como <strong>Encargado del Tratamiento</strong> (proveedor de tecnología) y la clínica suscriptora como <strong>Responsable</strong> ante los pacientes.
                        </p>
                    </div>

                    <div className="p-5 bg-gradient-to-br from-indigo-50/80 to-white rounded-2xl border border-indigo-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                            <FiLock size={20} />
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mb-1">Datos Sensibles de Salud</h4>
                        <p className="text-slate-600 text-xs leading-relaxed">
                            Cifrado bancario AES-256 en reposo y TLS 1.3 en tránsito. OdontoCloud <strong>nunca comercializa ni cede</strong> historias clínicas ni datos biométricos de pacientes.
                        </p>
                    </div>

                    <div className="p-5 bg-gradient-to-br from-emerald-50/80 to-white rounded-2xl border border-emerald-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                            <FiCheckCircle size={20} />
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mb-1">Custodia Legal 15 Años</h4>
                        <p className="text-slate-600 text-xs leading-relaxed">
                            Alineado a las <strong>Resoluciones 1995/1999 y 839/2017 de MinSalud</strong>, garantizando inalterabilidad, registro secuencial y derecho a portabilidad / exportación de expedientes.
                        </p>
                    </div>
                </div>

                {/* Contenido Legal Extenso */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-sans"
                >
                    {activeTab === 'terminos' ? (
                        /* ========================================================================= */
                        /* 1. TÉRMINOS Y CONDICIONES DEL SERVICIO (SAAS CLÍNICO)                     */
                        /* ========================================================================= */
                        <section className="space-y-8">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Preámbulo y Aceptación</h3>
                                <p className="text-sm text-slate-600 mb-0">
                                    El presente documento constituye un contrato vinculante entre el usuario, profesional odontológico o persona jurídica titular de la clínica (en adelante, <strong>"El Prestador"</strong> o <strong>"El Cliente"</strong>) y la plataforma <strong>OdontoCloud</strong> (en adelante, <strong>"OdontoCloud"</strong>). El registro, acceso o uso de la plataforma implica el conocimiento y aceptación expresa e incondicional de los presentes Términos y Condiciones, los cuales se rigen íntegramente por la legislación de la República de Colombia.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">1. Naturaleza del Servicio y Alcance Tecnológico</h2>
                                <p>
                                    OdontoCloud es una solución informática bajo el modelo de Software como Servicio (<strong>Software as a Service - SaaS</strong>), diseñada específicamente para la administración de consultorios, clínicas odontológicas e Instituciones Prestadoras de Servicios de Salud (IPS) en Colombia.
                                </p>
                                <p>
                                    El servicio comprende el acceso seguro a módulos de: agendamiento y turnos de citas, historia clínica odontológica electrónica, odontograma gráfico e interactivo, consentimiento informado digital, gestión de caja y pagos, emisión de soportes compatibles con el ecosistema de Facturación Electrónica en Salud y generación de estructuras de Registro Individual de Prestación de Servicios de Salud (<strong>RIPS</strong> en formato JSON con soporte MUV / MinSalud).
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">2. Exclusión de Responsabilidad Médica y Secreto Profesional</h2>
                                <p>
                                    <strong>OdontoCloud NO es un prestador de servicios de salud, NO practica la odontología ni la medicina, y NO emite conceptos clínicos.</strong> La plataforma constituye únicamente una herramienta tecnológica de registro, organización y almacenamiento de datos suministrados por los usuarios.
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>Responsabilidad Médica Exclusiva:</strong> La anamnesis, diagnóstico, plan de tratamiento, pronóstico, formulación farmacológica y ejecución de cualquier acto odontológico son responsabilidad exclusiva e indelegable del profesional de la salud tratante, quien ejerce su labor bajo su propio criterio científico, su tarjeta profesional y el estricto cumplimiento de la <strong>Ley 35 de 1989</strong> (Código de Ética del Odontólogo Colombiano) y la <strong>Ley 23 de 1981</strong>.
                                    </li>
                                    <li>
                                        <strong>Consentimiento Informado:</strong> Es deber ineludible de El Prestador obtener de forma previa, libre e informada el consentimiento clínico de sus pacientes antes de realizar cualquier intervención, utilizando los modelos proporcionados por el sistema o los propios de su clínica.
                                    </li>
                                    <li>
                                        <strong>Secreto Profesional:</strong> El personal médico y administrativo de la clínica está obligado a mantener la reserva legal de la información consignada en la historia clínica.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">3. Roles Jurídicos en Materia de Datos Personales (Ley 1581 de 2012)</h2>
                                <p>
                                    De conformidad con la <strong>Ley Estatutaria 1581 de 2012</strong> y su Decreto Reglamentario 1377 de 2013 (incorporado en el Decreto Único Reglamentario 1074 de 2015):
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>El Prestador (La Clínica) ostenta la calidad de RESPONSABLE DEL TRATAMIENTO:</strong> Decide sobre las bases de datos de sus pacientes, recolecta la información personal y sensible, recaba la autorización de Habeas Data correspondiente y atiende directamente las solicitudes de sus pacientes.
                                    </li>
                                    <li>
                                        <strong>OdontoCloud ostenta la calidad de ENCARGADO DEL TRATAMIENTO:</strong> Procesa, almacena y custodia técnicamente la información por cuenta y mandato de El Prestador, limitándose a ejecutar las operaciones necesarias para la operatividad del software, sin usar los datos para fines propios ni cederlos a terceros.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">4. Custodia, Retención e Inalterabilidad de la Historia Clínica (Res. 1995/1999 y Res. 839/2017)</h2>
                                <p>
                                    En concordancia con las <strong>Resoluciones 1995 de 1999 y 839 de 2017 del Ministerio de Salud y Protección Social de Colombia</strong>, las partes reconocen y acuerdan:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>Periodo de Conservación Legal Obligatorio:</strong> La historia clínica odontológica debe conservarse por un periodo mínimo de <strong>quince (15) años</strong> contados a partir de la fecha de la última atención (cinco años en archivo de gestión y diez años en archivo central).
                                    </li>
                                    <li>
                                        <strong>Inalterabilidad y Secuencialidad:</strong> OdontoCloud implementa registros de auditoría y estampado de tiempo que garantizan la inalterabilidad de las evoluciones clínicas y diagnósticos una vez firmados o cerrados por el profesional, cumpliendo los requisitos técnicos de las visitas de Inspección, Vigilancia y Control de las Secretarías de Salud territoriales.
                                    </li>
                                    <li>
                                        <strong>Custodia Compartida y Deber del Prestador:</strong> El Prestador es el titular de la obligación legal de custodia ante el Sistema Obligatorio de Garantía de Calidad en Salud (SOGCS) y la Secretaría de Salud correspondiente. OdontoCloud provee la infraestructura de nube para dicha custodia mientras la cuenta se encuentre activa.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">5. Validez de Mensajes de Datos y Firma Digital (Ley 527 de 1999 y Dec. 2364 de 2012)</h2>
                                <p>
                                    Los registros electrónicos, consentimientos informados firmados digitalmente o en pantalla táctil, evoluciones y fórmulas generadas en OdontoCloud tienen plena validez jurídica y fuerza probatoria con arreglo a la <strong>Ley 527 de 1999</strong> y el <strong>Decreto 2364 de 2012</strong>. La plataforma incorpora mecanismos de autenticación, captura de trazo, metadatos (dirección IP, fecha, hora) y sellado de integridad documental.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">6. Soporte RIPS y Facturación Electrónica en Salud (Res. 2275 de 2023 - MinSalud)</h2>
                                <p>
                                    OdontoCloud dispone de módulos adaptados a las directrices de la <strong>Resolución 2275 de 2023</strong> y disposiciones complementarias de MinSalud y la DIAN para la generación del Registro Individual de Prestación de Servicios de Salud (RIPS) como soporte de la Factura Electrónica de Venta en Salud (FEV). El Prestador es el único responsable de la veracidad y consistencia de los códigos CUPS, clasificaciones CIE-10 / CIE-11, valores monetarios y datos de identificación de los usuarios reportados en dichos ficheros.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">7. Portabilidad de Datos y Procedimiento en Caso de Terminación</h2>
                                <p>
                                    En caso de cancelación voluntaria del servicio o terminación del contrato de suscripción:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>Ventana de Portabilidad (30 días):</strong> El Prestador dispondrá de un periodo de gracia de hasta treinta (30) días calendario para exportar la totalidad de las historias clínicas en formato PDF y las bases de datos de pacientes y citas en formatos abiertos estándares (CSV / Excel).
                                    </li>
                                    <li>
                                        <strong>Entrega del Historial Clínico:</strong> De este modo, se asegura que El Prestador mantenga la continuidad de custodia de 15 años exigida por la Resolución 839 de 2017 sin verse expuesto a sanciones de los entes reguladores de salud. Transcurrido dicho plazo y previa confirmación, OdontoCloud procederá al borrado seguro de las copias operativas en sus bases activas.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">8. Niveles de Servicio (SLA) y Copias de Seguridad</h2>
                                <p>
                                    OdontoCloud mantendrá sus mejores esfuerzos comerciales y técnicos para ofrecer una disponibilidad del sistema (uptime) no inferior al <strong>99.8% mensual</strong>, excluyendo ventanas de mantenimiento programadas en horario no hábil y contingencias de fuerza mayor o fallas imputables a proveedores de telecomunicaciones ajenos. Asimismo, OdontoCloud efectúa copias de seguridad continuas y automáticas de las bases de datos para salvaguardar la información ante cualquier contingencia.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">9. Propiedad Intelectual y Restricciones de Uso</h2>
                                <p>
                                    OdontoCloud otorga a El Prestador una licencia de uso no exclusiva, revocable e intransferible para operar la plataforma durante la vigencia de su suscripción. Todos los derechos de propiedad intelectual sobre el código fuente, diseño, bases de datos subyacentes, módulos de inteligencia asistencial (OdontoIA) y marcas comerciales son de exclusiva propiedad de OdontoCloud.
                                </p>
                                <p>
                                    Queda expresamente prohibido descompilar, realizar ingeniería inversa, revender, arrendar o explotar comercialmente el software a favor de terceros no autorizados en el plan contratado.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">10. Ley Aplicable y Solución de Controversias</h2>
                                <p>
                                    Los presentes Términos y Condiciones se regirán, interpretarán y aplicarán de conformidad con las leyes de la <strong>República de Colombia</strong>. Cualquier diferencia o controversia que surja en relación con este acuerdo se resolverá en primera instancia mediante arreglo directo o ante un Centro de Conciliación legalmente constituido en Colombia antes de acudir a la jurisdicción ordinaria competente.
                                </p>
                            </div>
                        </section>
                    ) : (
                        /* ========================================================================= */
                        /* 2. POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES Y HABEAS DATA              */
                        /* ========================================================================= */
                        <section className="space-y-8">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Compromiso Institucional con el Hábeas Data</h3>
                                <p className="text-sm text-slate-600 mb-0">
                                    En OdontoCloud garantizamos la protección del derecho constitucional fundamental al Hábeas Data consagrado en el <strong>Artículo 15 de la Constitución Política de Colombia</strong>, dando estricto cumplimiento a la <strong>Ley Estatutaria 1581 de 2012</strong>, su <strong>Decreto Reglamentario 1377 de 2013</strong> y el <strong>Decreto Único Reglamentario 1074 de 2015</strong>.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">1. Identificación del Encargado y Oficial de Protección de Datos</h2>
                                <div className="p-4 bg-slate-100/70 rounded-xl text-sm space-y-1.5 text-slate-700">
                                    <p><strong>Razón Social:</strong> OdontoCloud SaaS Colombia</p>
                                    <p><strong>Naturaleza:</strong> Plataforma Tecnológica en la Nube para el Sector Salud Odontológico</p>
                                    <p><strong>Oficial de Protección de Datos Personales:</strong> Área de Cumplimiento y Seguridad de la Información</p>
                                    <p><strong>Correo Electrónico para Derechos ARCO / PQRS:</strong> <a href="mailto:privacidad@odontocloudcolombia.com" className="text-sky-600 font-semibold hover:underline">privacidad@odontocloudcolombia.com</a> / <a href="mailto:soporte@odontocloudcolombia.com" className="text-sky-600 font-semibold hover:underline">soporte@odontocloudcolombia.com</a></p>
                                    <p><strong>Línea de Atención Oficial:</strong> +57 (301) 576-8935</p>
                                </div>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">2. Definiciones Fundamentales (Ley 1581 de 2012)</h2>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Autorización:</strong> Consentimiento previo, expreso e informado del Titular para llevar a cabo el Tratamiento de datos personales.</li>
                                    <li><strong>Base de Datos:</strong> Conjunto organizado de datos personales que sea objeto de Tratamiento.</li>
                                    <li><strong>Dato Sensible:</strong> Aquel que afecta la intimidad del Titular o cuyo uso indebido puede generar discriminación, tales como los relativos a la <strong>salud</strong>, datos biométricos y genéticos.</li>
                                    <li><strong>Responsable del Tratamiento:</strong> Persona natural o jurídica que decide sobre la base de datos y/o el tratamiento de los mismos (en este ecosistema: La Clínica Dental o Profesional Suscriptor).</li>
                                    <li><strong>Encargado del Tratamiento:</strong> Persona natural o jurídica que realiza el tratamiento de datos personales por cuenta del Responsable (en este ecosistema: OdontoCloud).</li>
                                    <li><strong>Titular:</strong> Persona natural cuyos datos personales son objeto de tratamiento (pacientes, profesionales y personal administrativo).</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">3. Tratamiento Riguroso de Datos Sensibles de Salud (Artículos 5 y 6 Ley 1581)</h2>
                                <p>
                                    Los datos relativos a la salud bucal, antecedentes médicos y quirúrgicos, odontogramas, evoluciones clínicas, diagnósticos CIE-10 / CIE-11, radiografías y consentimientos informados constituyen <strong>DATOS SENSIBLES</strong> según la ley colombiana.
                                </p>
                                <div className="p-4 bg-amber-50/80 border-l-4 border-amber-500 rounded-r-xl my-4 text-sm text-amber-900">
                                    <strong>Garantía Estricta de No Comercialización:</strong> OdontoCloud <strong>JAMÁS</strong> vende, arrienda, cede, monetiza ni transfiere los datos clínicos ni personales de los pacientes de las clínicas a terceros, laboratorios, farmacéuticas, aseguradoras o empresas de mercadeo. Su tratamiento se limita con exclusividad a las finalidades asistenciales operadas directamente por la clínica suscriptora.
                                </div>
                                <p>
                                    El tratamiento de datos sensibles se encuentra amparado por las causales del Artículo 6 de la Ley 1581 de 2012: (i) autorización explícita del titular; (ii) salvaguarda del interés vital del paciente; y (iii) necesidad de prevención, diagnóstico o tratamiento odontológico y médico.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">4. Tratamiento de Datos de Menores de Edad (Art. 7 Ley 1581 de 2012)</h2>
                                <p>
                                    En los servicios de odontopediatría y atención a niños, niñas y adolescentes, el tratamiento de sus datos personales responderá y respetará siempre el interés superior de los menores y sus derechos prevalentes. La autorización para el tratamiento de sus datos deberá ser otorgada expresamente por sus padres, tutores o representantes legales, con audiencia previa del menor de acuerdo con su madurez y capacidad de entendimiento.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">5. Finalidades Específicas del Tratamiento</h2>
                                <p>Los datos procesados por la plataforma son utilizados para las siguientes finalidades legítimas:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Finalidades Asistenciales y Clínicas (por cuenta de la Clínica):</strong> Registro y gestión de historias clínicas electrónicas; graficación y seguimiento de odontogramas; registro de procedimientos realizados; validación de evolución y planes de tratamiento; firma digital de consentimientos informados.</li>
                                    <li><strong>Finalidades de Gestión y Contacto con Pacientes:</strong> Agendamiento, reprogramación y recordatorios de citas vía correo electrónico o WhatsApp autorizado; emisión de recibos y estados de cuenta.</li>
                                    <li><strong>Finalidades Regulatorias y Fiscales en Salud:</strong> Generación de estructuras de datos RIPS (Resolución 2275 de 2023) y Facturación Electrónica en Salud con código CUFE conforme a los lineamientos de MinSalud y DIAN.</li>
                                    <li><strong>Finalidades de Soporte y Seguridad:</strong> Mantenimiento preventivo, soporte técnico asistencial a usuarios de la clínica, auditoría de seguridad y trazabilidad de accesos.</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">6. Medidas de Seguridad de la Información (Seguridad por Diseño)</h2>
                                <p>
                                    Para salvaguardar los datos personales y sensibles contra adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento, OdontoCloud aplica rigurosas salvaguardas técnicas, administrativas y físicas:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Cifrado en Tránsito y Reposo:</strong> Todo el tráfico de red se encuentra cifrado mediante protocolos seguros <strong>TLS 1.3 / SSL de 256 bits</strong>. Las bases de datos se almacenan bajo cifrado militar <strong>AES-256</strong>.</li>
                                    <li><strong>Aislamiento Multi-Tenant Estricto:</strong> La arquitectura de bases de datos implementa <strong>Row-Level Security (RLS)</strong> en PostgreSQL, lo cual garantiza de manera matemática e inmutable que ninguna clínica puede acceder, consultar ni alterar datos pertenecientes a otra organización.</li>
                                    <li><strong>Trazabilidad y Auditoría:</strong> Cada consulta, creación o modificación de una historia clínica queda registrada con sello de tiempo, identificación del usuario del equipo médico y dirección IP para efectos de auditoría médica.</li>
                                    <li><strong>Copias de Seguridad Automatizadas:</strong> Respaldos periódicos redundantes en servidores de alta disponibilidad con protocolos de recuperación ante desastres.</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">7. Derechos de los Titulares de los Datos (Derechos ARCO)</h2>
                                <p>
                                    De conformidad con el Artículo 8 de la Ley 1581 de 2012, los titulares de los datos tienen los siguientes derechos:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente a los Responsables o Encargados del Tratamiento.</li>
                                    <li><strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento de sus datos.</li>
                                    <li><strong>Ser informado</strong> por el Responsable o Encargado sobre el uso que se ha dado a sus datos personales.</li>
                                    <li>
                                        <strong>Revocar la autorización y/o solicitar la supresión del dato:</strong> Siempre y cuando no subsista un deber legal o contractual que imponga su permanencia.
                                        <em> (Aclaración en Salud: De acuerdo con la Resolución 839 de 2017 de MinSalud, la historia clínica no puede ser suprimida antes de cumplirse el plazo obligatorio de 15 años de custodia legal).</em>
                                    </li>
                                    <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la Ley 1581 de 2012.</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">8. Procedimiento Legal para Consultas y Reclamos (Art. 14 y 15 Ley 1581)</h2>
                                <p>
                                    Los titulares o sus causahabientes podrán ejercer sus derechos a través del canal oficial: <a href="mailto:privacidad@odontocloudcolombia.com" className="text-sky-600 font-semibold hover:underline">privacidad@odontocloudcolombia.com</a>.
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>
                                        <strong>Trámite de Consultas:</strong> Serán atendidas en un término máximo de <strong>diez (10) días hábiles</strong> contados a partir de la fecha de su recibo. Si no fuere posible resolverla en dicho plazo, se informará al solicitante antes del vencimiento expresando los motivos de la demora y señalando la fecha en que se atenderá (máximo 5 días hábiles siguientes).
                                    </li>
                                    <li>
                                        <strong>Trámite de Reclamos (Corrección, Actualización o Supresión):</strong> Serán atendidos en un término máximo de <strong>quince (15) días hábiles</strong> contados a partir del día siguiente al recibo del reclamo debidamente motivado. Si el reclamo resulta incompleto, se requerirá al interesado dentro de los 5 días siguientes para que subsane las fallas.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">9. Transmisión Internacional de Datos</h2>
                                <p>
                                    Para asegurar la alta disponibilidad, redundancia y continuidad del software, los datos podrán ser procesados en infraestructura de nube ubicada en centros de datos internacionales de proveedores de primer nivel que cuentan con certificaciones internacionales de seguridad (SOC 2 Type II, ISO/IEC 27001), dando cumplimiento a los estándares de transmisión internacional exigidos por la Superintendencia de Industria y Comercio.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#022a63] mb-3">10. Vigencia y Modificaciones de la Política</h2>
                                <p>
                                    La presente Política de Tratamiento de Datos Personales rige a partir de su publicación y se mantendrá vigente mientras OdontoCloud preste sus servicios o persista la obligación legal de custodia de la información. Cualquier modificación sustancial a las políticas será informada oportunamente a través de la plataforma y de los canales oficiales de contacto.
                                </p>
                            </div>
                        </section>
                    )}

                    {/* Caja de Compromiso Institucional */}
                    <div className="compromiso-box bg-slate-900 text-white p-8 md:p-10 rounded-3xl mt-12 relative overflow-hidden shadow-xl" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                                    <FiShield size={24} />
                                </div>
                                <h3 className="text-2xl font-bold font-display" style={{ color: '#ffffff' }}>Compromiso OdontoCloud con la Salud en Colombia</h3>
                            </div>
                            <p className="text-slate-300 font-light text-base md:text-lg leading-relaxed" style={{ color: '#cbd5e1' }}>
                                "La historia clínica de los pacientes es un documento privado y sagrado de la relación odontólogo-paciente. Nuestra plataforma está construida bajo el principio de <strong>Privacidad y Seguridad desde el Diseño</strong>, garantizando que tu clínica cumpla al 100% con los estándares de habilitación de MinSalud y la protección de datos personales de la SIC."
                            </p>
                            <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-400">
                                <span className="flex items-center gap-1.5"><FiCheckCircle className="text-sky-400" /> Res. 1995/1999 & Res. 839/2017</span>
                                <span className="flex items-center gap-1.5"><FiCheckCircle className="text-sky-400" /> Ley 1581 de 2012 (Habeas Data)</span>
                                <span className="flex items-center gap-1.5"><FiCheckCircle className="text-sky-400" /> Ley 527 de 1999 (Firma Digital)</span>
                                <span className="flex items-center gap-1.5"><FiCheckCircle className="text-sky-400" /> Res. 2275 de 2023 (RIPS MinSalud)</span>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-[90px] pointer-events-none" />
                    </div>

                    {/* Área de Firma (Solo visible en Impresión / PDF para auditorías de Habilitación) */}
                    <div className="signature-area">
                        <div className="sig-box">
                            <span className="text-xs uppercase font-bold text-slate-900 block">Por OdontoCloud SaaS Colombia</span>
                            <p className="text-[9.5pt] text-slate-600 mt-1 mb-0">Representación Legal y Oficial de Datos</p>
                            <p className="text-[8.5pt] text-slate-500 mt-0.5">Software Certificado de Gestión Odontológica</p>
                        </div>
                        <div className="sig-box">
                            <span className="text-xs uppercase font-bold text-slate-900 block">Por El Prestador / Clínica Odontológica</span>
                            <p className="text-[9.5pt] text-slate-600 mt-1 mb-0">Firma del Profesional / Representante Legal de la IPS</p>
                            <p className="text-[8.5pt] text-slate-500 mt-0.5">Documento de Identificación / Registro Profesional</p>
                        </div>
                    </div>
                </motion.div>

                {/* Pie de Página Oficial para Impresión */}
                <div className="hidden print-only:flex flex-col items-center mt-12 pt-6 border-t border-slate-300 text-center text-[8.5pt] text-slate-500 font-light print-footer">
                    <p className="mb-1">
                        Documento oficial expedido digitalmente por <strong>OdontoCloud SaaS Colombia</strong> el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}.
                    </p>
                    <p className="mb-1 font-bold text-slate-700">
                        Válido como anexo técnico legal y probatorio de cumplimiento de Habilitación en Salud y Habeas Data.
                    </p>
                    <p className="italic text-slate-400">
                        Canal oficial de soporte: soporte@odontocloudcolombia.com • www.odontocloudcolombia.com
                    </p>
                </div>
            </div>
        </div>
    );
}
