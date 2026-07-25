import React, { useState, useEffect } from "react";
import { FiSave, FiSettings, FiFileText, FiActivity, FiBox, FiUser, FiZap } from "react-icons/fi";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Compact Switch Component
const CompactSwitch = ({ checked, onChange, label, subtitle }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-100">
        <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-slate-800">{label}</span>
            {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
        </div>
        <div
            onClick={() => onChange(!checked)}
            className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-200 shrink-0 ${checked ? "bg-blue-600" : "bg-slate-200"
                }`}
        >
            <div
                className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-xs ${checked ? "translate-x-4" : "translate-x-[2px]"
                    }`}
            />
        </div>
    </div>
);

// Compact Section Card
const ConfigSection = ({ title, icon: Icon, children }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
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
};

export default function ConfigParametros() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({
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
        general: {
            especialidadOrtodoncia: "Ortodoncia",
            actualizarAgendaInactividad: 10000,
            agendarCitasOnlineDespuesHoras: 24,
            vigenciaPresupuestos: 30,
            textoAyudaPlan: "",
            editarPlanClinico: true,
            manejaCopagos: false,
            usuarioVeDocumentosPropios: false,
            generarReporteOportunidad: true,
            confirmarPacienteContacto: false,
            tiempoEditarPlan: 90,
            permitirEdicionRecetas: false,
            evaluacionPacInasistentes: "",
            validarEspaciosBlanco: true,
            usarLocalStorageReportes: false,
            liquidacionPorSucursal: false,
            asignarPrimerProfesional: false,
            cerrarCajaMediosPago: false,
            avisoResolucionDias: 10,
            avisoResolucionFacturas: 50,
            historiaIgualIdentidad: true,
            filtrarPorCategorias: false,
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
        }
    }, [userProfile]);

    const loadData = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, "tenants", userProfile.inquilino, "config", "parameters");
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const saved = snap.data();
                setData(prev => ({
                    ...prev,
                    facturacion: { ...prev.facturacion, ...(saved.facturacion || {}) },
                    agenda: { ...prev.agenda, ...(saved.agenda || {}) },
                    general: { ...prev.general, ...(saved.general || {}) },
                    inventario: { ...prev.inventario, ...(saved.inventario || {}) },
                    historiaClinica: { ...prev.historiaClinica, ...(saved.historiaClinica || {}) },
                }));
            }
        } catch (error) {
            console.error("Error loading parameters:", error);
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
            const docRef = doc(db, "tenants", userProfile.inquilino, "config", "parameters");
            await setDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.uid
            });
            if (toast?.success) toast.success("Parámetros guardados correctamente");
        } catch (error) {
            console.error("Error saving parameters:", error);
            if (toast?.error) toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const appendToTextarea = (section, key, text) => {
        const currentVal = data[section][key] || "";
        handleChange(section, key, currentVal + " " + text);
    };

    if (loading && !data.updatedAt) {
        return (
            <div className="py-20 text-center text-slate-400 font-medium">
                <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                Cargando parámetros globales...
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiSettings size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Parámetros del Sistema</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Configuración global de facturación, agenda, notificaciones e historia clínica</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FiSave size={15} />
                    )}
                    <span>{saving ? "Guardando..." : "Guardar Configuración"}</span>
                </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* === FACTURACIÓN === */}
                <ConfigSection title="Plantillas de Facturación" icon={FiFileText}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                        {[
                            { k: "plantillaRecibo", label: "Recibo de Caja" },
                            { k: "plantillaNotaDebito", label: "Nota Débito" },
                            { k: "plantillaNotaCredito", label: "Nota Crédito" },
                            { k: "plantillaPresupuesto", label: "Presupuestos / Cotización" },
                            { k: "plantillaFactura", label: "Factura Estándar" },
                            { k: "plantillaFacturaElectronica", label: "Factura Electrónica" },
                            { k: "plantillaOrdenCompra", label: "Orden de Compra" },
                        ].map(field => (
                            <div key={field.k} className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">{field.label}</label>
                                <select
                                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg text-[12px] text-slate-800 outline-none transition-colors"
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
                            subtitle="Permitir guardar planes sin importe comercial"
                            checked={data.facturacion.permitirPlanesCero}
                            onChange={(v) => handleChange("facturacion", "permitirPlanesCero", v)}
                        />
                    </div>
                </ConfigSection>

                {/* === AGENDA === */}
                <ConfigSection title="Agenda & WhatsApp" icon={FiActivity}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Canal de Notificaciones</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "gratis", label: "Cuentas Gratis" },
                                    { id: "api", label: "Business API" },
                                    { id: "business", label: "Woflo API" }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => handleChange("agenda", "tipoWhatsapp", type.id)}
                                        className={`py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${data.agenda.tipoWhatsapp === type.id
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 block">Mensaje de Recordatorio</label>
                            <textarea
                                rows={3}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg text-[12px] text-slate-800 outline-none transition-colors resize-none"
                                value={data.agenda.mensajeWhatsapp}
                                onChange={(e) => handleChange("agenda", "mensajeWhatsapp", e.target.value)}
                            />
                            <div className="flex flex-wrap gap-1 pt-1">
                                {["[PatientName]", "[TenantName]", "[Date]", "[Hour]", "[Link]"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => appendToTextarea("agenda", "mensajeWhatsapp", tag)}
                                        className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded hover:bg-blue-100 border border-blue-100 cursor-pointer"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-1">
                            <CompactSwitch label="Validar Campos Exigidos" subtitle="Requerir datos completos para guardar agendamiento" checked={data.agenda.validarCamposAgenda} onChange={(v) => handleChange("agenda", "validarCamposAgenda", v)} />
                            <CompactSwitch label="Prevenir Citas Pasadas" subtitle="Impedir agendar en horarios anteriores" checked={data.agenda.noCrearCitasPasado} onChange={(v) => handleChange("agenda", "noCrearCitasPasado", v)} />
                        </div>
                    </div>
                </ConfigSection>

                {/* === HISTORIA CLINICA === */}
                <ConfigSection title="Historia Clínica & Firma Digital" icon={FiUser}>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 block">Mensaje de Firma Digital</label>
                            <textarea
                                rows={2}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg text-[12px] text-slate-800 outline-none transition-colors resize-none"
                                value={data.historiaClinica.mensajeWhatsappFirma}
                                onChange={(e) => handleChange("historiaClinica", "mensajeWhatsappFirma", e.target.value)}
                            />
                            <div className="flex flex-wrap gap-1 pt-1">
                                {["[PatientName]", "[TenantName]", "[Link]"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => appendToTextarea("historiaClinica", "mensajeWhatsappFirma", tag)}
                                        className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded hover:bg-blue-100 border border-blue-100 cursor-pointer"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 text-[12px]">
                                <span className="font-semibold text-slate-800">Expiración de Enlace de Firma (minutos)</span>
                                <input
                                    type="number"
                                    className="w-16 h-7 bg-white border border-slate-200 rounded text-center font-bold text-blue-600"
                                    value={data.historiaClinica.tiempoExpiracionFirma}
                                    onChange={(e) => handleChange("historiaClinica", "tiempoExpiracionFirma", parseInt(e.target.value))}
                                />
                            </div>
                            <CompactSwitch label="Bloquear Datos del Paciente" subtitle="Impedir modificar datos demográficos desde HC" checked={data.historiaClinica.noEditarDatosPaciente} onChange={(v) => handleChange("historiaClinica", "noEditarDatosPaciente", v)} />
                        </div>
                    </div>
                </ConfigSection>

                {/* === INVENTARIO === */}
                <ConfigSection title="Inventarios & Facturación" icon={FiBox}>
                    <div className="space-y-2">
                        <CompactSwitch label="Integrar Pagos con Inventario" subtitle="Descontar insumos automáticamente tras registro de pago" checked={data.inventario.integrarPagos} onChange={(v) => handleChange("inventario", "integrarPagos", v)} />
                        <CompactSwitch label="Integrar Recaudos" subtitle="Sincronizar abonos de clientes con existencias" checked={data.inventario.integrarRecaudos} onChange={(v) => handleChange("inventario", "integrarRecaudos", v)} />
                    </div>
                </ConfigSection>

                {/* === GENERAL (Full Width) === */}
                <div className="lg:col-span-2">
                    <ConfigSection title="Configuraciones Operativas Generales" icon={FiZap}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <CompactSwitch label="Editar Plan Clínico" checked={data.general.editarPlanClinico} onChange={(v) => handleChange("general", "editarPlanClinico", v)} />
                            <CompactSwitch label="Maneja Copagos" checked={data.general.manejaCopagos} onChange={(v) => handleChange("general", "manejaCopagos", v)} />
                            <CompactSwitch label="Ver Solo Docs Propios" checked={data.general.usuarioVeDocumentosPropios} onChange={(v) => handleChange("general", "usuarioVeDocumentosPropios", v)} />
                            <CompactSwitch label="Reporte Oportunidad" checked={data.general.generarReporteOportunidad} onChange={(v) => handleChange("general", "generarReporteOportunidad", v)} />
                            <CompactSwitch label="Confirmar Contacto" checked={data.general.confirmarPacienteContacto} onChange={(v) => handleChange("general", "confirmarPacienteContacto", v)} />
                            <CompactSwitch label="Edición de Recetas" checked={data.general.permitirEdicionRecetas} onChange={(v) => handleChange("general", "permitirEdicionRecetas", v)} />
                            <CompactSwitch label="Validar Espacios Blanco" checked={data.general.validarEspaciosBlanco} onChange={(v) => handleChange("general", "validarEspaciosBlanco", v)} />
                            <CompactSwitch label="Liquidación Sucursal" checked={data.general.liquidacionPorSucursal} onChange={(v) => handleChange("general", "liquidacionPorSucursal", v)} />
                            <CompactSwitch label="Primer Profesional" checked={data.general.asignarPrimerProfesional} onChange={(v) => handleChange("general", "asignarPrimerProfesional", v)} />
                            <CompactSwitch label="Cierre Caja x Medios" checked={data.general.cerrarCajaMediosPago} onChange={(v) => handleChange("general", "cerrarCajaMediosPago", v)} />
                            <CompactSwitch label="Historia = Identidad" checked={data.general.historiaIgualIdentidad} onChange={(v) => handleChange("general", "historiaIgualIdentidad", v)} />
                            <CompactSwitch label="Filtrar Categorías" checked={data.general.filtrarPorCategorias} onChange={(v) => handleChange("general", "filtrarPorCategorias", v)} />
                        </div>
                    </ConfigSection>
                </div>
            </div>
        </div>
    );
}
