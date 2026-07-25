import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import UniversalTable from "../../components/UniversalTable";

/* 
  Standard Fields Definition 
  These are fields that are "hardcoded" in the system logic (Pacientes.jsx) 
  but the user might want to hide or make optional.
*/
const STANDARD_FIELDS = [
    { group: "Identificación", key: "tipoDocumento", label: "Tipo de Documento" },
    { group: "Identificación", key: "nroDocumento", label: "Número de Documento" },
    { group: "Identificación", key: "nombres", label: "Nombres" },
    { group: "Identificación", key: "apellidos", label: "Apellidos" },
    { group: "Identificación", key: "fechaNacimiento", label: "Fecha de Nacimiento" },
    { group: "Identificación", key: "sexo", label: "Sexo / Género" },
    { group: "Identificación", key: "estadoCivil", label: "Estado Civil" },
    { group: "Identificación", key: "ocupacion", label: "Ocupación" },

    { group: "Contacto", key: "celular", label: "Celular" },
    { group: "Contacto", key: "email", label: "Correo Electrónico" },
    { group: "Contacto", key: "direccion", label: "Dirección de Residencia" },
    { group: "Contacto", key: "ciudad", label: "Ciudad / Departamento" },

    { group: "Acompañante / Responsable", key: "nombreResponsable", label: "Nombre Responsable" },
    { group: "Acompañante / Responsable", key: "telefonoResponsable", label: "Teléfono Responsable" },
    { group: "Acompañante / Responsable", key: "parentesco", label: "Parentesco" },

    { group: "Anamesis / Salud", key: "motivoConsulta", label: "Motivo de Consulta" },
    { group: "Anamesis / Salud", key: "antecedentes", label: "Antecedentes Médicos" },
    { group: "Anamesis / Salud", key: "alergias", label: "Alergias" },
    { group: "Anamesis / Salud", key: "medicamentos", label: "Medicamentos Actuales" },

    { group: "Administrativo", key: "eps", label: "EPS / Aseguradora" },
    { group: "Administrativo", key: "tipoVinculacion", label: "Tipo Vinculación" },
    { group: "Administrativo", key: "comoConocio", label: "Cómo nos conoció (Marketing)" },
];

export default function ConfigFormularioPacientes() {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("standard"); // standard | custom

    // Load standard config from Firestore
    useEffect(() => {
        const load = async () => {
            try {
                const ref = doc(db, "config_global", "pacientes_form");
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setConfig(snap.data());
                } else {
                    // Initialize with defaults if empty
                    const defaults = {};
                    STANDARD_FIELDS.forEach(f => {
                        defaults[f.key] = { visible: true, required: ["nombres", "celular"].includes(f.key) };
                    });
                    setConfig(defaults);
                }
            } catch (e) {
                console.error("Error loading patient config:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleToggle = (key, prop) => {
        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [prop]: !prev[key]?.[prop]
            }
        }));
    };

    const saveConfig = async () => {
        try {
            await setDoc(doc(db, "config_global", "pacientes_form"), config);
            alert("Configuración estándar guardada correctamente.");
        } catch (e) {
            console.error(e);
            alert("Error al guardar.");
        }
    };

    // Group fields for display
    const groupedFields = STANDARD_FIELDS.reduce((acc, field) => {
        if (!acc[field.group]) acc[field.group] = [];
        acc[field.group].push(field);
        return acc;
    }, {});

    return (
        <div className="card animation-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Formulario de Pacientes</h3>
                    <p className="text-sm text-slate-500">Define qué datos se solicitan y cuáles son obligatorios.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`btn ${activeTab === "standard" ? "blue" : "white"}`}
                        onClick={() => setActiveTab("standard")}
                    >
                        Campos Estándar
                    </button>
                    <button
                        className={`btn ${activeTab === "custom" ? "blue" : "white"}`}
                        onClick={() => setActiveTab("custom")}
                    >
                        Campos Personalizados
                    </button>
                </div>
            </div>

            {activeTab === "standard" && (
                <div>
                    {loading ? (
                        <p className="p-4 text-center text-slate-400">Cargando configuración...</p>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedFields).map(([groupName, fields]) => (
                                <div key={groupName} className="border rounded-lg p-4 bg-slate-50">
                                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">{groupName}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {fields.map(f => {
                                            const state = config[f.key] || { visible: true, required: false };
                                            return (
                                                <div key={f.key} className="bg-white p-3 rounded border shadow-sm flex flex-col gap-2">
                                                    <span className="font-medium text-sm text-slate-800">{f.label}</span>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!state.visible}
                                                                onChange={() => handleToggle(f.key, "visible")}
                                                                className="form-checkbox text-blue-600 rounded"
                                                            />
                                                            <span className="text-xs text-slate-600">Visible</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!state.required}
                                                                onChange={() => handleToggle(f.key, "required")}
                                                                disabled={!state.visible}
                                                                className="form-checkbox text-red-500 rounded"
                                                            />
                                                            <span className={`text-xs ${!state.visible ? 'text-slate-300' : 'text-slate-600'}`}>Obligatorio</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-end pt-4">
                                <button onClick={saveConfig} className="btn blue px-8 py-2">
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "custom" && (
                <div className="mt-4">
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6 text-sm text-yellow-800">
                        <strong>Nota:</strong> Los campos personalizados aparecerán en la pestaña "Información Adicional" de la ficha del paciente.
                    </div>
                    <UniversalTable
                        collectionName="config_formulario_de_pacientes"
                        title="Lista de Campos Personalizados"
                        schema={[
                            { key: "campo", label: "Etiqueta del Campo" },
                            { key: "tipo", label: "Tipo de Dato (Texto, Número, Fecha...)" }, // Podríamos mejorarlo a Select en el futuro
                            { key: "obligatorio", label: "Obligatorio", type: "boolean" }
                        ]}
                    />
                </div>
            )}
        </div>
    );
}
