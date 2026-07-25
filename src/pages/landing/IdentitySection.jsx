import React from 'react';

export default function IdentitySection({ config }) {
    const styles = {
        primary: config?.primaryColor || '#022a63',
        accent: config?.accentColor || '#10b981'
    };

    const isMaster = config?.isMaster;

    const mission = config?.identityMission || (isMaster
        ? "Nuestra misión es empoderar a los profesionales de la salud dental a través de herramientas tecnológicas intuitivas que eliminen la fricción administrativa y mejoren el cuidado del paciente."
        : "Somos una Institución Prestadora de Servicios de Salud comprometida con el bienestar de nuestros usuarios, brindando atención integral con excelencia clínica.");

    const vision = config?.identityVision || (isMaster
        ? "Para 2026, consolidarnos como el ecosistema digital más robusto para clínicas dentales en Latinoamérica, integrando inteligencia artificial en la gestión operativa."
        : "Para el año 2026 seremos referentes nacionales en la prestación de servicios de salud integrales, reconocidos por nuestra calidad y calidez humana.");

    // Default values if config.identityValues is empty
    const defaultClinicalValues = [
        { title: 'Humanización', icon: '🫂' },
        { title: 'Calidad', icon: '🏆' },
        { title: 'Seguridad', icon: '🛡️' },
        { title: 'Compromiso', icon: '🤝' },
        { title: 'Integridad', icon: '💎' }
    ];

    const defaultSaaSValues = [
        { title: 'Nube 24/7', icon: '☁️' },
        { title: 'Seguridad Bancaria', icon: '🛡️' },
        { title: 'Innovación Constante', icon: '🚀' },
        { title: 'Soporte Cercano', icon: '📞' },
        { title: 'Backup Automático', icon: '🔄' }
    ];

    const values = (config?.identityValues && config.identityValues.length > 0)
        ? config.identityValues
        : (isMaster ? defaultSaaSValues : defaultClinicalValues);

    const team = config?.doctors || [];

    return (
        <div id="identity" className="fade-in relative bg-white">
            {/* HERO SECTION OF IDENTITY */}
            <section className="viva-hero relative flex items-center justify-center bg-cover bg-center bg-no-repeat"
                style={{
                    height: '400px',
                    backgroundImage: `url(${config?.identityHeroImage || (isMaster ? 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1920&auto=format&fit=crop' : 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1920&auto=format&fit=crop')})`
                }}>
                <div className="absolute inset-0 bg-white/60"></div>
                <div className="container mx-auto px-6 relative z-10 text-center">
                    <h1 className="text-4xl md:text-6xl font-display font-bold inline-block px-8 py-3 rounded-full bg-white/90 shadow-lg backdrop-blur-sm mb-4"
                        style={{ color: styles.primary }}>
                        {config?.identityTitle || (isMaster ? "La Revolución Digital" : "Nuestra Identidad")}
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-700 bg-white/90 p-4 rounded-xl max-w-3xl mx-auto shadow-md backdrop-blur-sm">
                        {config?.identitySubtitle || (isMaster ? "Cientos de clínicas ya optimizan su operación con OdontoCloud." : "Excelencia humana y tecnológica al servicio de tu bienestar.")}
                    </p>
                </div>
            </section>

            {/* MISSION / VISION CARDS */}
            <section className="container mx-auto px-6 -mt-16 relative z-20 mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl text-left border-t-8" style={{ borderColor: styles.accent }}>
                        <div className="w-16 h-16 flex items-center justify-center text-3xl bg-slate-50 rounded-full mb-6">🎯</div>
                        <h2 className="text-3xl font-bold mb-4" style={{ color: styles.primary }}>Misión</h2>
                        <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
                            {mission}
                        </p>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl text-left border-t-8" style={{ borderColor: styles.primary }}>
                        <div className="w-16 h-16 flex items-center justify-center text-3xl bg-slate-50 rounded-full mb-6">👁️</div>
                        <h2 className="text-3xl font-bold mb-4" style={{ color: styles.primary }}>Visión</h2>
                        <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
                            {vision}
                        </p>
                    </div>
                </div>
            </section>

            {/* VALUES */}
            <section className="py-20 bg-slate-50">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-12" style={{ color: styles.primary }}>Nuestros Valores</h2>
                    <div className="flex flex-wrap justify-center gap-6">
                        {values.map((val, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 w-full sm:w-64 flex flex-col items-center">
                                <div className="text-4xl mb-4" style={{ color: styles.accent }}>{val.icon || '★'}</div>
                                <h4 className="text-xl font-bold" style={{ color: styles.primary }}>{val.title}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TEAM GRID - Hidden for SaaS Master Page */}
            {!config?.isMaster && (
                <section className="py-20 bg-white">
                    <div className="container mx-auto px-6">
                        <h2 className="text-4xl font-bold mb-12 text-center" style={{ color: styles.primary }}>Nuestros Especialistas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {team.map((doc, i) => (
                                <div key={i} className="bg-slate-50 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group">
                                    <div className="h-80 overflow-hidden bg-slate-200 relative">
                                        {doc.img ? (
                                            <img src={doc.img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={doc.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-6xl">👨‍⚕️</div>
                                        )}
                                    </div>
                                    <div className="p-8">
                                        <h3 className="text-2xl font-bold mb-2" style={{ color: styles.primary }}>{doc.name}</h3>
                                        <p className="font-semibold uppercase tracking-wider text-sm" style={{ color: styles.accent }}>{doc.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
