export const MASTER_CONFIG = {
    isMaster: true,
    name: "OdontoCloud",
    logo: `${import.meta.env.BASE_URL}assets/logo.png`,
    heroTitle: "Lleva tu Clínica al Siguiente Nivel",
    heroSubtitle: "El software de gestión dental más completo, moderno y fácil de usar. Agenda, pacientes, odontograma digital e interactivo y facturación en un solo lugar.",
    heroBadgeText: "SOFTWARE ODONTOLÓGICO LÍDER",

    // SEO
    seoTitle: "OdontoCloud | El Mejor Software de Gestión Dental",
    seoDesc: "Transforma tu práctica con la plataforma definitiva para odontólogos. Agenda inteligente, odontograma digital interactivo y control financiero total. Comienza tu prueba gratuita hoy.",

    // Hero Buttons
    heroBtn1Text: "Comenzar Prueba Gratis",
    heroBtn1Link: "#trial", // Opens modal or scrolls to trial
    heroBtn2Text: "Ver Documentación",
    heroBtn2Link: "https://docs.odontocloud.pro",

    // Content Sections
    servicesSectionBadge: "FUNCIONALIDADES CLAVE",
    servicesSectionTitle: "Potencia tu práctica con tecnología de vanguardia",
    servicesSectionDesc: "Diseñado para dentistas que buscan eficiencia, control y una experiencia superior para sus pacientes.",

    // Master Slides (SaaS Focused)
    slides: [
        {
            id: 1,
            image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=1200",
            title: "El Control Total de tu",
            highlight: "Negocio Dental",
            desc: "Administra tu agenda, historiales médicos y facturación desde cualquier lugar con nuestra plataforma 100% en la nube."
        },
        {
            id: 2,
            image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=1200",
            title: "Visualización Avanzada",
            highlight: "Odontograma Digital",
            desc: "Impresiona a tus pacientes con odontogramas vectoriales e interactivos en tiempo real de sus tratamientos y evoluciones clínicas."
        },
        {
            id: 3,
            image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1200",
            title: "Comunicación Directa",
            highlight: "Recordatorios WhatsApp",
            desc: "Reduce el ausentismo hasta en un 40% con confirmaciones automáticas enviadas directamente al móvil de tus pacientes."
        },
        {
            id: 4,
            image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1200",
            title: "Atrae más Pacientes",
            highlight: "Marketing Integrado",
            desc: "Convierte visitas a tu sitio web en citas reales con nuestro motor de captación y reserva online automática."
        },
        {
            id: 5,
            image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=1200",
            title: "Crecimiento Seguro",
            highlight: "Finanzas & Reportes IA",
            desc: "Toma decisiones inteligentes respaldadas por análisis predictivos de ingresos, cartera e inventario."
        }
    ],

    // Primary Identity / Values / SaaS Mission
    identityTitle: "La Revolución Digital en Odontología",
    identitySubtitle: "Cientos de clínicas en Latinoamérica ya han optimizado sus procesos con OdontoCloud.",
    identityMission: "Nuestra misión es empoderar a los profesionales de la salud dental a través de herramientas tecnológicas intuitivas que eliminen la fricción administrativa y mejoren el cuidado del paciente.",
    identityVision: "Para 2026, consolidarnos como el ecosistema digital más robusto para clínicas dentales, integrando inteligencia artificial en el diagnóstico y la gestión operativa.",
    identityHeroImage: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1920&auto=format&fit=crop",

    identityValues: [
        { title: 'Nube 24/7', icon: '☁️' },
        { title: 'Odontograma Digital', icon: '🦷' },
        { title: 'Pacientes Ilimitados', icon: '👥' },
        { title: 'Facturación Electrónica', icon: '🧾' },
        { title: 'Seguridad Bancaria', icon: '🛡️' },
        { title: 'Backup Automático', icon: '🔄' }
    ],

    services: [
        {
            slug: "agenda",
            title: "Agenda Inteligente",
            desc: "Gestión de citas con recordatorios automáticos por WhatsApp, reduciendo el ausentismo hasta en un 40%.",
            icon: "🗓️",
            longDesc: "Nuestra agenda no es solo un calendario; es el motor de tu clínica. Automatiza las confirmaciones y optimiza el tiempo de tus especialistas.",
            features: [
                "Sincronización en tiempo real entre múltiples dispositivos.",
                "Recordatorios automáticos vía WhatsApp para reducir inasistencias.",
                "Gestión de turnos y disponibilidades por cada doctor.",
                "Bloqueo de horarios para emergencias o mantenimientos."
            ],
            benefits: [
                "Aumenta la asistencia hasta en un 40%.",
                "Reduce la carga administrativa de recepción.",
                "Mejora la satisfacción del paciente con procesos ágiles."
            ]
        },
        {
            slug: "historia-clinica",
            title: "Historia Clínica Digital",
            desc: "Acceso instantáneo a radiografías, evoluciones y anexos desde cualquier dispositivo de forma segura.",
            icon: "📁",
            longDesc: "Lleva la explicación de tratamientos al siguiente nivel. Centraliza toda la información de tus pacientes en un solo lugar, accesible y seguro.",
            features: [
                "Odontograma digital e interactivo con anatomía detallada.",
                "Registro detallado de hallazgos y evoluciones clínicas.",
                "Carga de radiografías, fotos y documentos adjuntos.",
                "Firma digital de consentimientos informados."
            ],
            benefits: [
                "Elimina el uso de papel en tu clínica.",
                "Mejora la comunicación y confianza con el paciente.",
                "Cumple con todas las normativas de historia clínica legal."
            ]
        },
        {
            slug: "finanzas",
            title: "Finanzas y Reportes",
            desc: "Control exacto de ingresos, egresos y comisiones de doctores con reportes gráficos automáticos.",
            icon: "📊",
            longDesc: "Gestión financiera robusta diseñada para clínicas en crecimiento. Ten claridad absoluta sobre la rentabilidad de tu negocio en tiempo real.",
            features: [
                "Facturación electrónica cumpliendo normativas fiscales.",
                "Control de abonos, saldos y cuentas por cobrar.",
                "Liquidación automática de comisiones para doctores.",
                "Reportes mensuales de flujo de caja y rentabilidad."
            ],
            benefits: [
                "Control financiero absoluto sin errores manuales.",
                "Ahorra horas de trabajo en liquidación de comisiones.",
                "Toma decisiones basadas en datos reales y actualizados."
            ]
        },
        {
            slug: "inventarios",
            title: "Inventarios y Suministros",
            desc: "Control total de materiales, stock y alertas de vencimiento para evitar fugas.",
            icon: "📦",
            longDesc: "No pierdas dinero por materiales vencidos o falta de insumos. Gestiona tus compras y consumos de forma automática integrada con tus tratamientos.",
            features: [
                "Alertas de stock bajo configurables.",
                "Seguimiento de fechas de vencimiento de materiales.",
                "Descarga automática de insumos por procedimiento.",
                "Gestión de proveedores y órdenes de compra."
            ],
            benefits: [
                "Optimiza el uso de tus recursos.",
                "Evita interrupciones por falta de materiales.",
                "Reduce los costos operativos."
            ]
        },
        {
            slug: "portal-pacientes",
            title: "Portal del Paciente",
            desc: "Tus pacientes pueden ver sus citas, facturas y evoluciones desde su propio acceso.",
            icon: "🌐",
            longDesc: "Ofrece un servicio de alta gama permitiendo que tus pacientes autogestionen sus citas, vean sus radiografías y descarguen sus facturas de forma segura.",
            features: [
                "Reserva de citas online en tiempo real.",
                "Visualización de evolución clínica y fotos.",
                "Descarga de facturas y resultados de laboratorio.",
                "Chat de soporte y recordatorios personalizados."
            ],
            benefits: [
                "Mejora drásticamente la experiencia del paciente.",
                "Reduce llamadas telefónicas a recepción.",
                "Fideliza a tus pacientes con servicios digitales."
            ]
        },
        {
            slug: "pagina-web",
            title: "Página Web para tu Clínica",
            desc: "Incluimos un sitio web profesional y moderno para tu clínica, conectado directamente con tu agenda.",
            icon: "🖥️",
            longDesc: "No solo es un software de gestión, también es tu presencia en línea. Tu plan incluye una página web optimizada para Google, donde tus pacientes pueden conocer tus servicios y agendar citas 24/7.",
            features: [
                "Diseño premium responsive (se ve bien en móviles).",
                "Integración de 'Agendar Cita' en tiempo real.",
                "Sección de servicios, equipo médico y sedes.",
                "Optimización SEO para aparecer en búsquedas locales."
            ],
            benefits: [
                "Atrae nuevos pacientes de forma orgánica.",
                "Automatiza el agendamiento sin intervención humana.",
                "Posiciona tu marca como una clínica moderna y digital."
            ]
        }
    ],

    // Testimonials (SaaS focus)
    testimonialsTitle: "Lo que dicen los directores clínicos",
    testimonials: [
        {
            id: 1,
            name: "Dr. Roberto Mendoza",
            role: "Director de Innova Dental",
            text: "Implementar OdontoCloud fue la mejor decisión administrativa que hemos tomado. Pasamos de usar papel a tener el control total de nuestra sucursal de forma digital.",
            avatar: "https://i.pravatar.cc/150?u=roberto"
        },
        {
            id: 2,
            name: "Dra. Lucía Arias",
            role: "Especialista en Estética Dental",
            text: "El odontograma digital interactivo no tiene comparación. Mis pacientes entienden mucho mejor sus presupuestos y la tasa de aceptación de tratamientos subió notablemente.",
            avatar: "https://i.pravatar.cc/150?u=lucia"
        }
    ],

    // Global Contact & CTA
    contactPhone: "3015768935",
    ctaTitle: "¿Listo para transformar tu clínica?",
    ctaText: "Únete a la nueva era de la odontología digital. Sin contratos de permanencia, sin complicaciones.",
    ctaBtnText: "SOLICITAR MI PRUEBA GRATIS",
    primaryColor: "#022a63",
    accentColor: "#fbbf24",

    // Socials
    facebookUrl: "https://facebook.com/odontocloud",
    instagramUrl: "https://instagram.com/odontocloud",

    // Pricing Plans Refinement (Synced with Software Defaults)
    plans: [
        {
            name: "Consultorio",
            price: 79900,
            annualPrice: 799999,
            userLimit: "3 Usuarios",
            coreModule: "Módulo Clínico",
            desc: "Ideal para dentistas independientes y consultorios particulares.",
            features: [
                "Hasta 3 usuarios incluidos (Sin cobro por usuario extra)",
                "Agenda inteligente con confirmación y recordatorios por WhatsApp",
                "Historia clínica digital y Odontograma interactivo",
                "Evolución clínica con Asistente de IA y dictado por Voz",
                "Gestión de múltiples sillones y espacios físicos por doctor",
                "Inventario con semaforización de bajo stock (Verde / Rojo)",
                "Módulo de pagos, presupuestos y recibos de caja",
                "Sin límite de pacientes ni historias clínicas",
                "Consentimiento informado digital con firma",
                "Soporte técnico directo por WhatsApp"
            ],
            isPopular: false,
            recommended: false,
            btnText: "Elegir Consultorio"
        },
        {
            name: "Clínica",
            price: 110000,
            annualPrice: 1100000,
            userLimit: "5 Usuarios",
            coreModule: "Módulo Avanzado + CMS",
            desc: "Para clínicas en crecimiento que necesitan escalar, cumplir la normativa y automatizar su operación.",
            features: [
                "🌐 Sitio Web Corporativo GRATIS incluido (CMS)",
                "Hasta 5 usuarios incluidos (Tarifa Plana Fija)",
                "Todo lo incluido en el Plan Consultorio",
                "Facturación Electrónica DIAN oficial (300 documentos/año)",
                "Generación de RIPS JSON oficial (Resolución 2275 de 2023)",
                "Múltiples sedes y sucursales incluidas GRATIS",
                "Notas crédito y Documento Soporte electrónico DIAN",
                "Inventario avanzado multi-bodega con kardex",
                "Reportes financieros avanzados y control de cartera",
                "Soporte prioritario directo por WhatsApp"
            ],
            recommended: true,
            isPopular: true,
            btnText: "Elegir Clínica"
        },
        {
            name: "Enterprise",
            price: 199000,
            annualPrice: 1990000,
            userLimit: "11 Usuarios",
            coreModule: "Módulo IPS Multi-Sede",
            desc: "Sin límites para redes de clínicas, IPS y cadenas odontológicas.",
            features: [
                "🌐 Sitio Web Corporativo Personalizado con dominio propio",
                "Hasta 11 usuarios activos incluidos",
                "Todo lo incluido en el Plan Clínica",
                "Facturación Electrónica DIAN ampliada (1.000 documentos/año)",
                "Sedes y sucursales ilimitadas",
                "Roles y permisos avanzados (Director, Auditor, Odontólogo)",
                "Módulo de liquidación de comisiones y nómina médica",
                "Reportes consolidados multi-sede y analítica avanzada",
                "Account Manager personal y soporte 24/7 preferencial",
                "Migración asistida de datos desde software anterior"
            ],
            recommended: false,
            isPopular: false,
            btnText: "Elegir Enterprise"
        }
    ]
};
