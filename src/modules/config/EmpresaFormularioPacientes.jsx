import React, { useState, useEffect } from "react";
import { FiSave, FiClipboard, FiInfo } from "react-icons/fi";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Compact iOS Style Toggle Switch Component
const Toggle = ({ checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${checked ? "bg-blue-600" : "bg-slate-200"
            }`}
    >
        <div
            className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${checked ? "translate-x-4" : "translate-x-[2px]"
                }`}
        />
    </div>
);

// Configuration Sections Definition
const SECTIONS = [
    {
        title: "Campos Principales del Paciente",
        fields: [
            { key: "paisNacimiento", label: "País de nacimiento", norma: true },
            { key: "ciudadNacimiento", label: "Ciudad de nacimiento", norma: true },
            { key: "numeroDentadura", label: "Número dentadura" },
            { key: "sexo", label: "Sexo / Género", norma: true },
            { key: "rh", label: "Factor RH" },
            { key: "estadoCivil", label: "Estado civil", norma: true },
            { key: "fechaIngreso", label: "Fecha de ingreso", norma: true },
            { key: "fechaNacimiento", label: "Fecha de nacimiento", norma: true },
            { key: "paisDomicilio", label: "País de domicilio", norma: true },
            { key: "ciudadDomicilio", label: "Ciudad de domicilio", norma: true },
            { key: "barrioDomicilio", label: "Barrio de domicilio", norma: true },
            { key: "lugarResidencia", label: "Lugar de residencia", norma: true },
            { key: "estrato", label: "Estrato socioeconómico" },
            { key: "zonaResidencial", label: "Zona residencial" },
            { key: "esExtranjero", label: "Es extranjero" },
            { key: "permitePublicidad", label: "Permite recibir publicidad" },
            { key: "orientacionSexual", label: "Orientación sexual" },
            { key: "lugarExpedicion", label: "Lugar de expedición del documento" },
        ]
    },
    {
        title: "Datos de Facturación",
        fields: [
            { key: "multiplesResponsables", label: "Múltiples Responsables de Factura" }
        ]
    },
    {
        title: "Información de Contacto",
        fields: [
            { key: "celular", label: "Teléfono celular", norma: true },
            { key: "telefonoDomicilio", label: "Teléfono de domicilio", norma: true },
            { key: "telefonoOficina", label: "Teléfono de oficina" },
            { key: "extension", label: "Extensión telefónica" },
            { key: "correoElectronico", label: "Correo electrónico" },
            { key: "ocupacion", label: "Ocupación / Profesión", norma: true },
        ]
    },
    {
        title: "Datos del Responsable",
        fields: [
            { key: "respNombre", label: "Nombre completo", norma: true },
            { key: "respParentesco", label: "Parentesco", norma: true },
            { key: "respCelular", label: "Teléfono celular", norma: true },
            { key: "respTelefono", label: "Teléfono fijo", norma: true },
            { key: "respCorreo", label: "Correo electrónico" }
        ]
    },
    {
        title: "Datos del Acompañante",
        fields: [
            { key: "acompNombre", label: "Nombre completo", norma: true },
            { key: "acompTelefono", label: "Teléfono de contacto", norma: true }
        ]
    },
    {
        title: "Información de EPS y Aseguramiento",
        fields: [
            { key: "tipoVinculacion", label: "Tipo de vinculación a EPS", norma: true },
            { key: "nombreEps", label: "Nombre de la entidad EPS", norma: true },
            { key: "polizaSalud", label: "Póliza de salud privada" },
            { key: "soat", label: "Aseguradora SOAT" },
            { key: "tipoPaciente", label: "Tipo de paciente" }
        ]
    },
    {
        title: "Mercadeo y Remisión",
        fields: [
            { key: "convenioBeneficio", label: "Convenio beneficio" },
            { key: "convenioPago", label: "Convenio de pago" },
            { key: "comoNosConocio", label: "Cómo nos conoció" },
            { key: "campana", label: "Campaña publicitaria" },
            { key: "remitidoPor", label: "Remitido por" },
            { key: "asesorComercial", label: "Asesor comercial asignado" }
        ]
    }
];

export default function EmpresaFormularioPacientes() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const load = async () => {
            if (!inquilino) return;
            try {
                const docSnap = await getDoc(doc(db, "tenants", inquilino, "config", "formulario_pacientes"));
                if (docSnap.exists()) {
                    setConfig(docSnap.data());
                } else {
                    setConfig({});
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [inquilino]);

    const handleChange = (key, type, val) => {
        let isNorma = false;
        for (const section of SECTIONS) {
            const f = section.fields.find(field => field.key === key);
            if (f) {
                isNorma = !!f.norma;
                break;
            }
        }

        setConfig(prev => {
            const current = prev[key] || { visible: true, required: isNorma };
            return {
                ...prev,
                [key]: {
                    ...current,
                    [type]: val
                }
            };
        });
    };

    const handleSave = async () => {
        if (!inquilino) return;
        setSaving(true);
        try {
            await setDoc(doc(db, "tenants", inquilino, "config", "formulario_pacientes"), config);
            if (toast && toast.success) {
                toast.success("Configuración guardada correctamente");
            } else {
                alert("Configuración guardada correctamente");
            }
        } catch (e) {
            console.error(e);
            if (toast && toast.error) {
                toast.error("Error al guardar la configuración");
            } else {
                alert("Error al guardar: " + e.message);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiClipboard size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Formulario de Pacientes</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de visibilidad y campos requeridos en la ficha clínica</p>
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
                    <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-12 text-center text-slate-400 font-medium">
                        <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                        Cargando configuración del formulario...
                    </div>
                ) : (
                    <div>
                        {/* Table Header */}
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 grid grid-cols-12 items-center text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            <div className="col-span-6">Campo del Formulario</div>
                            <div className="col-span-3 text-center">¿Es Visible?</div>
                            <div className="col-span-3 text-center">¿Es Requerido?</div>
                        </div>

                        <div className="divide-y divide-slate-100 text-[12px]">
                            {SECTIONS.map((section, idx) => (
                                <div key={idx}>
                                    <div className="bg-slate-50/70 px-4 py-2 flex items-center gap-2 border-y border-slate-100">
                                        <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                                        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            {section.title}
                                        </h3>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {section.fields.map((field) => {
                                            const fieldConfig = {
                                                visible: config[field.key]?.visible ?? true,
                                                required: config[field.key]?.required ?? !!field.norma
                                            };
                                            return (
                                                <div key={field.key} className="px-4 py-2.5 grid grid-cols-12 items-center hover:bg-slate-50/80 transition-colors">
                                                    <div className="col-span-6 flex items-center gap-2">
                                                        <span className="font-semibold text-slate-800">
                                                            {field.label}
                                                        </span>
                                                        {field.norma && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-bold border border-rose-100">
                                                                <FiInfo size={10} /> NORMA RIPS
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="col-span-3 flex justify-center">
                                                        <Toggle
                                                            checked={fieldConfig.visible}
                                                            onChange={(val) => handleChange(field.key, "visible", val)}
                                                        />
                                                    </div>

                                                    <div className="col-span-3 flex justify-center">
                                                        <Toggle
                                                            checked={fieldConfig.required}
                                                            onChange={(val) => handleChange(field.key, "required", val)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
