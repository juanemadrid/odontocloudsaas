import React, { useState, useEffect, useMemo } from "react";
import { 
    FiSave, FiSettings, FiFileText, FiActivity, FiBox, FiUser, FiZap, 
    FiHelpCircle, FiSearch, FiCheck, FiSliders, FiCalendar
} from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getSpecialties } from "../../services/resourceService";

// Sleek OralDrive-style Toggle Switch (Slender height, elegant proportion with checkmark)
const OralDriveSwitch = ({ checked, onChange, id }) => (
    <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 shrink-0 p-0.5 border-0 outline-none focus:ring-2 focus:ring-blue-300 ${
            checked ? "bg-blue-600 shadow-xs" : "bg-slate-200 hover:bg-slate-300"
        }`}
    >
        <div
            className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm flex items-center justify-center ${
                checked ? "translate-x-6" : "translate-x-0"
            }`}
        >
            {checked && <FiCheck size={11} className="text-blue-600 stroke-[3]" />}
        </div>
    </button>
);

// Tooltip helper component
const TooltipInfo = ({ text }) => {
    if (!text) return null;
    return (
        <div className="relative group inline-flex items-center ml-1.5 cursor-help">
            <span className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-400 flex items-center justify-center text-[10px] font-bold transition-colors">
                ?
            </span>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-900 text-white text-[11px] leading-snug rounded-xl shadow-xl z-50 pointer-events-none text-center">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
        </div>
    );
};

// Compact Switch Component for other tabs
const CompactSwitch = ({ checked, onChange, label, subtitle }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-100">
        <div className="flex flex-col pr-2">
            <span className="text-[12px] font-semibold text-slate-800">{label}</span>
            {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
        </div>
        <OralDriveSwitch checked={checked} onChange={onChange} />
    </div>
);

// Compact Section Card
const ConfigSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Icon size={14} />
            </div>
            <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
        </div>
        <div className="p-4 space-y-4">
            {children}
        </div>
    </div>
);

export default function ConfigParametros() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [searchFilter, setSearchFilter] = useState("");
    const [specialtiesList, setSpecialtiesList] = useState([]);

    const [data, setData] = useState({
        general: {
            especialidadOrtodoncia: "Ortodoncia",
            actualizarAgendaInactividad: 10000,
            agendarCitasOnlineDespuesHoras: 24,
            vigenciaPresupuestos: 30,
            textoAyudaPlan: "",
            editarPlanClinico: false,
            manejaCopagos: false,
            usuarioVeDocumentosPropios: false,
            generarReporteOportunidad: false,
            confirmarPacienteContacto: false,
            tiempoEditarPlan: 60,
            permitirEdicionRecetas: false,
            evaluacionPacInasistentes: "",
            validarEspaciosBlanco: false,
            usarLocalStorageReportes: false,
            liquidacionPorSucursal: false,
            asignarPrimerProfesional: false,
            cerrarCajaMediosPago: false,
            avisoResolucionDias: 10,
            avisoResolucionFacturas: 50,
            historiaIgualIdentidad: false,
            filtrarPorCategorias: false,
            interoperabilidadIHCE: false,
        },
        facturacion: {
            plantillaRecibo: "Recibo caja carta",
            plantillaNotaDebito: "Nota débito carta",
            plantillaNotaCredito: "Nota crédito carta",
            plantillaPresupuesto: "Cotización carta",
            plantillaFactura: "Factura media carta",
            plantillaFacturaElectronica: "Factura media carta",
            plantillaOrdenCompra: "Orden de compra",
            plantillaEgresos: "Egresos",
            plantillaFacturaCompra: "Factura carta",
            permitirPlanesCero: false,
        },
        agenda: {
            tipoWhatsapp: "gratis",
            mensajeWhatsapp: "Cordial saludo [PatientName], por favor confirme su asistencia a la cita en [TenantName]. Día: [Date], Hora: [Hour]. ESCRIBENOS PARA CONFIRMAR O INGRESA EN EL SIGUIENTE LINK: [Link]",
            validarCamposAgenda: false,
            noCrearCitasPasado: false,
            duracionAgendaRapida: 30,
        },
        inventario: {
            integrarPagos: false,
            integrarRecaudos: false,
        },
        historiaClinica: {
            mensajeWhatsappFirma: "[PatientName], te contactamos de la clínica [TenantName]. Para firmar su documento clínico utilice el siguiente link: [Link]",
            tiempoExpiracionFirma: 60,
            noEditarDatosPaciente: false,
        }
    });

    useEffect(() => {
        if (userProfile?.inquilino) {
            loadData();
            loadSpecialties();
        }
    }, [userProfile]);

    const loadSpecialties = async () => {
        try {
            const list = await getSpecialties(userProfile.inquilino);
            setSpecialtiesList(list || []);
        } catch (e) {
            console.warn("Error cargando especialidades:", e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: tenant, error } = await supabase
                .from("tenants")
                .select("parametros")
                .eq("id", userProfile.inquilino)
                .single();
            
            if (error) throw error;
            if (tenant?.parametros) {
                const saved = typeof tenant.parametros === "string" 
                    ? JSON.parse(tenant.parametros) 
                    : tenant.parametros;
                setData(prev => ({
                    ...prev,
                    general: { ...prev.general, ...(saved.general || {}) },
                    facturacion: { ...prev.facturacion, ...(saved.facturacion || {}) },
                    agenda: { ...prev.agenda, ...(saved.agenda || {}) },
                    inventario: { ...prev.inventario, ...(saved.inventario || {}) },
                    historiaClinica: { ...prev.historiaClinica, ...(saved.historiaClinica || {}) },
                }));
            }
        } catch (error) {
            console.error("Error al cargar parámetros:", error);
            if (toast?.error) toast.error("Error al cargar parámetros");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (section, key, value) => {
        setData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Preservar llaves existentes en tenants.parametros (como fechas de vencimiento de suscripción)
            const { data: currentTenant } = await supabase
                .from("tenants")
                .select("parametros")
                .eq("id", userProfile.inquilino)
                .maybeSingle();

            const existingParams = (currentTenant?.parametros && typeof currentTenant.parametros === "object")
                ? currentTenant.parametros
                : {};

            const mergedParams = {
                ...existingParams,
                general: data.general,
                facturacion: data.facturacion,
                agenda: data.agenda,
                inventario: data.inventario,
                historiaClinica: data.historiaClinica,
                updatedAt: new Date().toISOString()
            };

            const { error } = await supabase
                .from("tenants")
                .update({ parametros: mergedParams })
                .eq("id", userProfile.inquilino);

            if (error) throw error;
            window.dispatchEvent(new CustomEvent("tenant-parametros-updated", { detail: mergedParams }));
            if (toast?.success) toast.success("Parámetros por empresa guardados correctamente");
        } catch (error) {
            console.error("Error al guardar parámetros:", error);
            if (toast?.error) toast.error("Error al guardar parámetros: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const appendToTextarea = (section, key, text) => {
        const currentVal = data[section][key] || "";
        handleChange(section, key, currentVal + " " + text);
    };

    // All 23 OralDrive General Parameters Definitions
    const generalParametersList = useMemo(() => [
        {
            key: "especialidadOrtodoncia",
            label: "Especialidad con evoluciones de ortodoncia",
            tooltip: "Selecciona la especialidad médica que tendrá activado el formato clínico de evoluciones de ortodoncia.",
            type: "select",
            options: [
                "Ortodoncia",
                "Odontología General",
                "Endodoncia",
                "Periodoncia",
                "Rehabilitación Oral",
                "Cirugía Oral y Maxilofacial",
                "Odontopediatría",
                "Implantología",
                ...(specialtiesList.map(s => s.nombre || s.name).filter(Boolean))
            ].filter((v, i, a) => a.indexOf(v) === i)
        },
        {
            key: "actualizarAgendaInactividad",
            label: "Actualizar agenda inactividad(Min) *",
            tooltip: "Tiempo en minutos de inactividad del usuario tras el cual la agenda se recarga automáticamente.",
            type: "number",
            placeholder: "10000"
        },
        {
            key: "agendarCitasOnlineDespuesHoras",
            label: "Agendar citas online después(Horas) *",
            tooltip: "Tiempo de anticipación mínimo en horas para permitir el agendamiento de citas en línea por parte de pacientes.",
            type: "number",
            placeholder: "24"
        },
        {
            key: "vigenciaPresupuestos",
            label: "Vigencia presupuestos *",
            tooltip: "Vigencia en días calendario de los presupuestos y cotizaciones entregados a los pacientes.",
            type: "number",
            placeholder: "30"
        },
        {
            key: "textoAyudaPlan",
            label: "Texto de ayuda para observaciones en plan de tratamiento",
            tooltip: "Texto guía predeterminado que se muestra en las observaciones de los planes de tratamiento.",
            type: "text",
            placeholder: "Ej: Válido por 30 días calendario..."
        },
        {
            key: "editarPlanClinico",
            label: "Editar plan de tratamiento clínico?",
            tooltip: "Permite a los profesionales autorizados editar los planes de tratamiento clínicos ya guardados.",
            type: "switch"
        },
        {
            key: "manejaCopagos",
            label: "Maneja copagos",
            tooltip: "Habilita la gestión y cobro de copagos y cuotas moderadoras en la clínica.",
            type: "switch"
        },
        {
            key: "usuarioVeDocumentosPropios",
            label: "Solo ver documentos propios del profesional",
            tooltip: "Restringe el acceso para que cada profesional visualice únicamente las historias clínicas y documentos creados por él mismo.",
            type: "switch"
        },
        {
            key: "generarReporteOportunidad",
            label: "Generar reporte de oportunidad de citas",
            tooltip: "Habilita el cálculo del indicador de oportunidad en la asignación de citas para auditorías de salud.",
            type: "switch"
        },
        {
            key: "confirmarPacienteContacto",
            label: "Confirmar paciente correcto",
            tooltip: "Solicita una confirmación visual de los datos del paciente antes de realizar atenciones o crear documentos.",
            type: "switch"
        },
        {
            key: "tiempoEditarPlan",
            label: "Tiempo en minutos para editar un plan de tratamiento clínico",
            tooltip: "Ventana de tiempo en minutos permitida para realizar ediciones en un plan de tratamiento después de haberlo guardado.",
            type: "number",
            placeholder: "60"
        },
        {
            key: "permitirEdicionRecetas",
            label: "Permitir edición de recetas?",
            tooltip: "Permite la modificación o edición de recetas y fórmulas médicas ya emitidas.",
            type: "switch"
        },
        {
            key: "evaluacionPacInasistentes",
            label: "Evolución Pac. inasistentes a cita",
            tooltip: "Nota de evolución automática que se registrará en la historia clínica cuando el paciente no se presente a la cita.",
            type: "text",
            placeholder: "Ej: El paciente no asiste a la consulta programada."
        },
        {
            key: "validarEspaciosBlanco",
            label: "Validar espacios en blanco consulta médica?",
            tooltip: "Impide guardar consultas médicas o notas clínicas si existen campos obligatorios vacíos.",
            type: "switch"
        },
        {
            key: "usarLocalStorageReportes",
            label: "Utilizar local storage en reportes",
            tooltip: "Optimiza la velocidad de carga de reportes pesados almacenando datos temporales en el almacenamiento local del navegador.",
            type: "switch"
        },
        {
            key: "liquidacionPorSucursal",
            label: "Liquidación por sucursal",
            tooltip: "Realiza la liquidación financiera y de comisiones médicas de forma independiente por cada sede o sucursal.",
            type: "switch"
        },
        {
            key: "asignarPrimerProfesional",
            label: "Asignar primer profesional desde agenda",
            tooltip: "Asigna automáticamente al primer profesional odontólogo disponible al crear una cita directa en la agenda.",
            type: "switch"
        },
        {
            key: "cerrarCajaMediosPago",
            label: "Cerrar caja con medios de pago",
            tooltip: "Exige desglosar los ingresos por cada método de pago (efectivo, datáfono, transferencia) al realizar el cierre de caja.",
            type: "switch"
        },
        {
            key: "avisoResolucionDias",
            label: "Aviso previo resolución facturación (Días)",
            tooltip: "Días de anticipación para notificar la proximidad del vencimiento de la resolución de facturación DIAN.",
            type: "number",
            placeholder: "10"
        },
        {
            key: "avisoResolucionFacturas",
            label: "Aviso previo resolución facturación (# Facturas)",
            tooltip: "Número de facturas restantes en el rango autorizado para emitir la alerta de numeración próxima a agotarse.",
            type: "number",
            placeholder: "50"
        },
        {
            key: "historiaIgualIdentidad",
            label: "# Historia = # Doc. Identidad",
            tooltip: "Establece el número de documento de identidad del paciente como el número único de su historia clínica.",
            type: "switch"
        },
        {
            key: "filtrarPorCategorias",
            label: "Filtrar por categorías",
            tooltip: "Permite categorizar y filtrar procedimientos clínicos y aranceles en las búsquedas del sistema.",
            type: "switch"
        },
        {
            key: "interoperabilidadIHCE",
            label: "Interoperabilidad (IHCE)",
            tooltip: "Habilita los parámetros y protocolos de interoperabilidad para la Historia Clínica Electrónica nacional.",
            type: "switch"
        }
    ], [specialtiesList]);

    // Filtered items based on search query
    const filteredGeneralList = useMemo(() => {
        if (!searchFilter.trim()) return generalParametersList;
        const q = searchFilter.toLowerCase();
        return generalParametersList.filter(item => 
            item.label.toLowerCase().includes(q) || 
            (item.tooltip && item.tooltip.toLowerCase().includes(q))
        );
    }, [generalParametersList, searchFilter]);

    if (loading) {
        return (
            <div className="py-24 text-center text-slate-400 font-medium">
                <div className="w-7 h-7 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                Cargando parámetros por empresa...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header Toolbar matching OralDrive header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
                        <FiSliders size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Parámetros por Empresa</h1>
                        <p className="text-xs text-slate-500 font-medium">Configuración operativa, clínica y de seguridad de la clínica</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all cursor-pointer border-0 disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FiSave size={16} />
                    )}
                    <span>{saving ? "Guardando..." : "Guardar Parámetros"}</span>
                </button>
            </div>

            {/* Navigation Tabs - Compact, no horizontal scrollbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
                {[
                    { id: "general", label: "General", icon: FiSliders },
                    { id: "facturacion", label: "Facturación", icon: FiFileText },
                    { id: "agenda", label: "Agenda", icon: FiActivity },
                    { id: "historiaClinica", label: "Historia Clínica", icon: FiUser },
                    { id: "inventario", label: "Inventario", icon: FiBox },
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all cursor-pointer border-b-2 ${
                                isActive 
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg" 
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }`}
                        >
                            <Icon size={13} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* === TAB 1: GENERAL (ORALDRIVE 1:1 REPLICA) === */}
            {activeTab === "general" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                    {/* Section Header */}
                    <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-base font-black text-slate-800 tracking-tight">General</h2>
                        
                        {/* Quick Search */}
                        <div className="relative w-full sm:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input
                                type="text"
                                placeholder="Filtrar parámetro..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            />
                        </div>
                    </div>

                    {/* Parameters Table / Rows */}
                    <div className="divide-y divide-slate-100">
                        {filteredGeneralList.map((param) => {
                            const val = data.general[param.key];
                            return (
                                <div 
                                    key={param.key} 
                                    className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 hover:bg-slate-50/70 transition-colors"
                                >
                                    {/* Left Label + Tooltip: Aligned right on desktop to sit right next to control */}
                                    <div className="w-full md:w-[46%] flex items-center justify-start md:justify-end text-left md:text-right gap-1.5 shrink-0">
                                        <span className="text-xs font-semibold text-slate-700 leading-snug">
                                            {param.label}
                                        </span>
                                        <TooltipInfo text={param.tooltip} />
                                    </div>

                                    {/* Right Control: Aligned left right beside the label */}
                                    <div className="w-full md:w-[54%] flex items-center justify-start">
                                        {param.type === "switch" && (
                                            <OralDriveSwitch
                                                id={param.key}
                                                checked={Boolean(val)}
                                                onChange={(newVal) => handleChange("general", param.key, newVal)}
                                            />
                                        )}

                                        {param.type === "number" && (
                                            <input
                                                type="number"
                                                className="w-full max-w-[280px] h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                value={val ?? ""}
                                                placeholder={param.placeholder}
                                                onChange={(e) => handleChange("general", param.key, e.target.value === "" ? "" : Number(e.target.value))}
                                            />
                                        )}

                                        {param.type === "text" && (
                                            <input
                                                type="text"
                                                className="w-full max-w-sm h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                value={val || ""}
                                                placeholder={param.placeholder}
                                                onChange={(e) => handleChange("general", param.key, e.target.value)}
                                            />
                                        )}

                                        {param.type === "select" && (
                                            <select
                                                className="w-full max-w-[280px] h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                                                value={val || "Ortodoncia"}
                                                onChange={(e) => handleChange("general", param.key, e.target.value)}
                                            >
                                                {param.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredGeneralList.length === 0 && (
                            <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                No se encontraron parámetros que coincidan con "{searchFilter}".
                            </div>
                        )}
                    </div>

                    {/* Bottom Save Reminder */}
                    <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer border-0 disabled:opacity-50"
                        >
                            <FiSave size={15} />
                            <span>{saving ? "Guardando cambios..." : "Guardar Parámetros"}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* === TAB 2: FACTURACIÓN === */}
            {activeTab === "facturacion" && (
                <ConfigSection title="Plantillas y Opciones de Facturación" icon={FiFileText}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {[
                            { k: "plantillaRecibo", label: "Recibo de Caja" },
                            { k: "plantillaNotaDebito", label: "Nota Débito" },
                            { k: "plantillaNotaCredito", label: "Nota Crédito" },
                            { k: "plantillaPresupuesto", label: "Presupuestos / Cotización" },
                            { k: "plantillaFactura", label: "Factura Estándar" },
                            { k: "plantillaFacturaElectronica", label: "Factura Electrónica" },
                            { k: "plantillaOrdenCompra", label: "Orden de Compra" },
                        ].map(field => (
                            <div key={field.k} className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600">{field.label}</label>
                                <select
                                    className="w-full h-9 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs text-slate-800 outline-none transition-colors"
                                    value={data.facturacion[field.k]}
                                    onChange={(e) => handleChange("facturacion", field.k, e.target.value)}
                                >
                                    <option value="Recibo caja carta">Recibo caja carta</option>
                                    <option value="Nota débito carta">Nota débito carta</option>
                                    <option value="Factura media carta">Factura media carta</option>
                                    <option value="Factura carta">Factura carta</option>
                                    <option value="Cotización carta">Cotización carta</option>
                                    <option value="Orden de compra">Orden de compra</option>
                                    <option value="Egresos">Egresos</option>
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="pt-2">
                        <CompactSwitch
                            label="Tratamientos en Valor $0"
                            subtitle="Permitir registrar planes de tratamiento o procedimientos sin importe comercial"
                            checked={data.facturacion.permitirPlanesCero}
                            onChange={(v) => handleChange("facturacion", "permitirPlanesCero", v)}
                        />
                    </div>
                </ConfigSection>
            )}

            {/* === TAB 3: AGENDA & NOTIFICACIONES === */}
            {activeTab === "agenda" && (
                <ConfigSection title="Agenda & Notificaciones WhatsApp" icon={FiActivity}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-2">Canal de Notificaciones</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: "gratis", label: "Cuentas Gratis (Web)" },
                                    { id: "api", label: "Business API (Oficial)" },
                                    { id: "business", label: "Woflo API" }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => handleChange("agenda", "tipoWhatsapp", type.id)}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                            data.agenda.tipoWhatsapp === type.id
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 block">Mensaje de Recordatorio de Cita</label>
                            <textarea
                                rows={3}
                                className="w-full p-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs text-slate-800 outline-none transition-colors resize-none"
                                value={data.agenda.mensajeWhatsapp}
                                onChange={(e) => handleChange("agenda", "mensajeWhatsapp", e.target.value)}
                            />
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {["[PatientName]", "[TenantName]", "[Date]", "[Hour]", "[Link]"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => appendToTextarea("agenda", "mensajeWhatsapp", tag)}
                                        className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 border border-blue-100 cursor-pointer"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <CompactSwitch 
                                label="Validar Campos Exigidos en Agenda" 
                                subtitle="Requerir datos completos de paciente y motivo para confirmar la cita" 
                                checked={data.agenda.validarCamposAgenda} 
                                onChange={(v) => handleChange("agenda", "validarCamposAgenda", v)} 
                            />
                            <CompactSwitch 
                                label="Prevenir Citas en el Pasado" 
                                subtitle="Impedir la creación o traslado de citas en fechas u horarios ya transcurridos" 
                                checked={data.agenda.noCrearCitasPasado} 
                                onChange={(v) => handleChange("agenda", "noCrearCitasPasado", v)} 
                            />
                        </div>
                    </div>
                </ConfigSection>
            )}

            {/* === TAB 4: HISTORIA CLÍNICA & FIRMA === */}
            {activeTab === "historiaClinica" && (
                <ConfigSection title="Historia Clínica & Firma Digital" icon={FiUser}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 block">Mensaje para Solicitud de Firma Digital</label>
                            <textarea
                                rows={2}
                                className="w-full p-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs text-slate-800 outline-none transition-colors resize-none"
                                value={data.historiaClinica.mensajeWhatsappFirma}
                                onChange={(e) => handleChange("historiaClinica", "mensajeWhatsappFirma", e.target.value)}
                            />
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {["[PatientName]", "[TenantName]", "[Link]"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => appendToTextarea("historiaClinica", "mensajeWhatsappFirma", tag)}
                                        className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 border border-blue-100 cursor-pointer"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                <div>
                                    <p className="font-bold text-slate-800">Expiración de Enlace de Firma</p>
                                    <p className="text-[10px] text-slate-500">Tiempo de validez en minutos del token de firma enviado por WhatsApp</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        className="w-20 h-8 bg-white border border-slate-200 rounded-lg text-center font-bold text-blue-600 outline-none focus:border-blue-500 text-xs"
                                        value={data.historiaClinica.tiempoExpiracionFirma}
                                        onChange={(e) => handleChange("historiaClinica", "tiempoExpiracionFirma", parseInt(e.target.value) || 60)}
                                    />
                                    <span className="text-[11px] text-slate-400 font-semibold">min</span>
                                </div>
                            </div>

                            <CompactSwitch 
                                label="Bloquear Datos del Paciente en HC" 
                                subtitle="Impedir a doctores modificar teléfono, documento o dirección desde el módulo clínico" 
                                checked={data.historiaClinica.noEditarDatosPaciente} 
                                onChange={(v) => handleChange("historiaClinica", "noEditarDatosPaciente", v)} 
                            />
                        </div>
                    </div>
                </ConfigSection>
            )}

            {/* === TAB 5: INVENTARIO === */}
            {activeTab === "inventario" && (
                <ConfigSection title="Inventarios & Facturación" icon={FiBox}>
                    <div className="space-y-3">
                        <CompactSwitch 
                            label="Integrar Pagos con Inventario" 
                            subtitle="Descontar insumos odontológicos automáticamente tras registrar un recibo de pago" 
                            checked={data.inventario.integrarPagos} 
                            onChange={(v) => handleChange("inventario", "integrarPagos", v)} 
                        />
                        <CompactSwitch 
                            label="Integrar Recaudos" 
                            subtitle="Sincronizar abonos y saldos de pacientes con el kárdex de existencias" 
                            checked={data.inventario.integrarRecaudos} 
                            onChange={(v) => handleChange("inventario", "integrarRecaudos", v)} 
                        />
                    </div>
                </ConfigSection>
            )}
        </div>
    );
}
