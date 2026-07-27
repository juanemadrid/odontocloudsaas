import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { formatCurrency, calculateAgeStr } from "../../../utils/formatters";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useAudit } from "../../../hooks/useAudit";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientSchema } from "../schemas/patientSchema";
import { 
    TIPOS_DOCUMENTO, PAISES, PREFIJOS_TELEFONICOS, TIPOS_VINCULACION,
    SEXOS, ESTADOS_CIVILES, ESTRATOS, ZONAS_RESIDENCIALES, PARENTESCOS, MEDIOS_CONOCIMIENTO
} from "../constants/patientConstants";
import { fetchCitiesForCountry, CIUDADES_COLOMBIA } from "../services/geoService";
import SearchableSelect from "../../../components/ui/SearchableSelect";

import { 
    FiUser, FiEdit2, FiTarget, FiCamera, FiClipboard, FiActivity, 
    FiDollarSign, FiUsers, FiX, FiInfo, FiChevronRight, FiAlertCircle,
    FiBriefcase, FiCalendar, FiTrendingUp, FiFileText, FiShield, FiCheck, FiTrash2, FiPlus, FiCpu
} from "react-icons/fi";

// Tabs Imports
import HistoriaClinicaContainer from "./HistoriaClinicaContainer";
import EvolucionesTab from "./EvolucionesTab";
import PresupuestosTab from "./PresupuestosTab";
import FacturacionTab from "./FacturacionTab";
import ConsentimientosTab from "./ConsentimientosTab";
import PatientRxTab from "./PatientRxTab";
import BeneficiariosTab from "./BeneficiariosTab";
import Odontograma from "../../odontograma/Odontograma";
import Periodontograma from "../../odontograma/Periodontograma";
import AseguramientoTab from "./AseguramientoTab";
import MarketingTab from "./MarketingTab";
import ProfesionalesTab from "./ProfesionalesTab";
import SaldoTab from "./SaldoTab";
import PagoTab from "./PagoTab";
import HistoricoPagosTab from "./HistoricoPagosTab";
import HistoricoFacturasTab from "./HistoricoFacturasTab";
import AIInsightsTab from "./AIInsightsTab";
import HistoriaClinicaTab from "./HistoriaClinicaTab";

const FormRow = ({ label, required, children, error, helpText }) => {
    // Clonar el children y agregar clases de error si es necesario
    const childrenWithError = React.Children.map(children, child => {
        if (React.isValidElement(child) && error) {
            // Si es un input, select o textarea, agregar clase de error
            const isFormElement = ['input', 'select', 'textarea'].includes(child.type) || 
                                  child.props?.className?.includes('form-input');
            
            if (isFormElement) {
                const originalClassName = child.props.className || '';
                const errorClassName = 'border-red-500 ring-2 ring-red-100 focus:ring-red-200';
                return React.cloneElement(child, {
                    className: `${originalClassName} ${errorClassName}`,
                    'aria-invalid': 'true',
                    'aria-describedby': error ? `${child.props.name}-error` : undefined
                });
            }
        }
        return child;
    });

    return (
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-2 border-b border-slate-100/60 last:border-0 hover:bg-slate-50/40 transition-colors px-3 md:px-5">
            <label className={"w-full md:w-52 shrink-0 text-[11px] font-bold uppercase tracking-wider md:text-right flex items-center justify-start md:justify-end gap-1 " + (error ? 'text-rose-500' : 'text-slate-500')}>
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="flex-1 w-full max-w-xl relative">
                {childrenWithError}
                {error && <p id={`${error.ref?.name}-error`} className="text-rose-500 text-[10px] font-bold uppercase tracking-wider mt-1">{error.message}</p>}
                {helpText && !error && <p className="text-slate-400 text-[10px] font-medium mt-1 uppercase tracking-widest">{helpText}</p>}
            </div>
        </div>
    );
};

const SectionTitle = ({ title, num }) => (
    <div className="flex items-center gap-3 bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/80">
        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shadow-sm">{num}</div>
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h3>
    </div>
);

const FormDatosPersonales = ({ patient, photoState }) => {
    const { register, watch, setValue, setError, clearErrors, formState: { errors } } = useFormContext();
    const { isCameraActive, fotoPreview, startCamera, stopCamera, takePhoto, onFotoChange, videoRef, canvasRef } = photoState;

    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const checkDocumentDuplication = async (e) => {
        const val = e.target.value?.trim();
        if (!val) return;
        if (patient?.nroDocumento === val) {
            clearErrors("nroDocumento");
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select("id")
                .eq("tenant_id", inquilino)
                .eq("documento", val)
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data && data.id !== patient?.id) {
                setError("nroDocumento", {
                    type: "manual",
                    message: `Ya existe un paciente registrado con el número de documento ${val}`
                });
                toast?.error(`Atención: Ya existe un paciente con el número de documento ${val}`);
            } else {
                clearErrors("nroDocumento");
            }
        } catch (err) {
            console.error("Error checking document duplication:", err);
        }
    };
    const [formConfig, setFormConfig] = React.useState(null);

    React.useEffect(() => {
        if (!inquilino) return;
        const loadFormConfig = async () => {
            try {
                const { configuracionFormularios } = await import("../../../services/supabaseServices");
                const config = await configuracionFormularios.get(inquilino, "formulario_pacientes");
                if (config) {
                    setFormConfig(config);
                }
            } catch (e) {
                console.error("Error loading patient form config from Supabase:", e);
            }
        };
        loadFormConfig();
    }, [inquilino]);

    const isVisible = (key) => {
        if (!formConfig) return true;
        return formConfig[key]?.visible !== false;
    };

    const isRequired = (key, defaultRequired = false) => {
        if (!formConfig) return defaultRequired;
        return formConfig[key]?.required === true;
    };

    const toast = useToast();
    const [barrioList, setBarrioList] = React.useState([]);
    const [loadingBarrios, setLoadingBarrios] = React.useState(false);
    const [showBarrioSuggestions, setShowBarrioSuggestions] = React.useState(false);

    React.useEffect(() => {
        if (!inquilino) return;
        const loadBarrios = async () => {
            setLoadingBarrios(true);
            try {
                const { barriosCatalogo } = await import("../../../services/supabaseServices");
                const barrios = await barriosCatalogo.getByTenant(inquilino);
                const uniqueBarrios = barrios.map(b => b.nombre).filter(Boolean);
                uniqueBarrios.sort((a, b) => a.localeCompare(b));
                setBarrioList(uniqueBarrios);
            } catch (e) {
                console.error("Error loading Barrio catalog from Supabase:", e);
            } finally {
                setLoadingBarrios(false);
            }
        };
        loadBarrios();
    }, [inquilino]);

    const barrioValue = watch("barrio");
    const filteredBarrios = React.useMemo(() => {
        if (!barrioValue || barrioValue.length < 1) return [];
        return barrioList.filter(b => 
            b.toLowerCase().includes(barrioValue.toLowerCase()) && 
            b.toLowerCase() !== barrioValue.toLowerCase()
        ).slice(0, 5);
    }, [barrioValue, barrioList]);

    const handleAgregarBarrio = async (e) => {
        e.preventDefault();
        const barrioInput = watch("barrio");
        if (!barrioInput || !barrioInput.trim()) {
            toast?.error("Por favor, ingrese un nombre de barrio");
            return;
        }

        const normalizedBarrio = barrioInput.trim();
        
        if (barrioList.map(b => b.toLowerCase()).includes(normalizedBarrio.toLowerCase())) {
            toast?.info("Este barrio ya se encuentra registrado");
            return;
        }

        if (!inquilino) {
            toast?.error("Inquilino no identificado");
            return;
        }

        try {
            const { barriosCatalogo } = await import("../../../services/supabaseServices");
            await barriosCatalogo.create(inquilino, normalizedBarrio);
            setBarrioList(prev => [...prev, normalizedBarrio].sort((a, b) => a.localeCompare(b)));
            toast?.success("Barrio agregado al catálogo con éxito");
        } catch (err) {
            console.error("Error saving new barrio to Supabase:", err);
            toast?.error("Error al guardar el barrio en el catálogo");
        }
    };

    const birthDate = watch("fechaNacimiento");
    const age = React.useMemo(() => {
        return calculateAgeStr(birthDate);
    }, [birthDate]);
    const nroDocumentoValue = watch("nroDocumento");
    React.useEffect(() => {
        if (nroDocumentoValue) {
            setValue("nroHistoria", nroDocumentoValue);
        }
    }, [nroDocumentoValue, setValue]);

    const [showPrefijoDrop, setShowPrefijoDrop] = React.useState(false);
    const [prefijoSearch, setPrefijoSearch] = React.useState("");

    React.useEffect(() => {
        if (!showPrefijoDrop) return;
        const handler = () => setShowPrefijoDrop(false);
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showPrefijoDrop]);

    const [ciudadesNacimiento, setCiudadesNacimiento] = React.useState([]);
    const [ciudadesDomicilio, setCiudadesDomicilio] = React.useState([]);
    const [loadingCiudadesNacimiento, setLoadingCiudadesNacimiento] = React.useState(false);
    const [loadingCiudadesDomicilio, setLoadingCiudadesDomicilio] = React.useState(false);

    const initialNacimientoRef = React.useRef(true);
    const initialDomicilioRef = React.useRef(true);

    React.useEffect(() => {
        initialNacimientoRef.current = true;
        initialDomicilioRef.current = true;
    }, [patient?.id]);

    const paisNacimiento = watch("paisNacimiento");
    const paisDomicilio = watch("paisDomicilio");

    React.useEffect(() => {
        if (!paisNacimiento) {
            setCiudadesNacimiento([]);
            setLoadingCiudadesNacimiento(false);
            return;
        }

        if (initialNacimientoRef.current) {
            initialNacimientoRef.current = false;
        } else {
            setValue("ciudadNacimiento", "");
        }

        let isMounted = true;
        const loadCities = async () => {
            setLoadingCiudadesNacimiento(true);
            const cities = await fetchCitiesForCountry(paisNacimiento);
            if (isMounted) {
                setCiudadesNacimiento(cities);
                setLoadingCiudadesNacimiento(false);
            }
        };

        loadCities();
        return () => {
            isMounted = false;
        };
    }, [paisNacimiento, setValue]);

    React.useEffect(() => {
        if (!paisDomicilio) {
            setCiudadesDomicilio([]);
            setLoadingCiudadesDomicilio(false);
            return;
        }

        if (initialDomicilioRef.current) {
            initialDomicilioRef.current = false;
        } else {
            setValue("ciudadDomicilio", "");
        }

        let isMounted = true;
        const loadCities = async () => {
            setLoadingCiudadesDomicilio(true);
            const cities = await fetchCitiesForCountry(paisDomicilio);
            if (isMounted) {
                setCiudadesDomicilio(cities);
                setLoadingCiudadesDomicilio(false);
            }
        };

        loadCities();
        return () => {
            isMounted = false;
        };
    }, [paisDomicilio, setValue]);
    
    return (
        <div className="flex flex-col lg:flex-row gap-10 p-4 md:p-8 animate-fadeIn">
            {/* 1. LEFT COLUMN: FORM FIELDS */}
            <div className="flex-1 min-w-0">
                <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm mb-8 pb-8">
                    <SectionTitle num="1" title="Datos de identificación" />
                    <div className="pl-0 md:pl-4 space-y-1">
                        <FormRow label="Tipo de documento" required={isRequired("tipoDocumento", true)} error={errors.tipoDocumento}>
                            <select {...register("tipoDocumento")} className="form-input text-sm w-full md:w-64">
                                <option value="">Seleccione...</option>
                                {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </FormRow>
                        <FormRow label="Nro. de documento" required={isRequired("nroDocumento", true)} error={errors.nroDocumento}>
                            <input 
                                {...register("nroDocumento")} 
                                onBlur={(e) => {
                                    register("nroDocumento").onBlur(e);
                                    checkDocumentDuplication(e);
                                }}
                                className="form-input text-sm w-full md:w-64" 
                                placeholder="Nro. documento" 
                            />
                        </FormRow>
                        <FormRow label="Número de Historia">
                            <input {...register("nroHistoria")} className="form-input text-sm w-full md:w-64" placeholder="Nro. historia" />
                        </FormRow>
                        <FormRow label="Fecha de ingreso">
                            <div className="relative w-full md:w-64">
                                <input {...register("fechaIngreso")} readOnly className="form-input text-sm w-full bg-slate-50/50 cursor-not-allowed" />
                                <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            </div>
                        </FormRow>
                        <FormRow label="Nombres" required={isRequired("nombres", true)} error={errors.nombres}>
                            <input {...register("nombres")} autoComplete="new-password" className="form-input text-sm w-full" placeholder="Nombres" />
                        </FormRow>
                        <FormRow label="Apellidos" required={isRequired("apellidos", true)} error={errors.apellidos}>
                            <input {...register("apellidos")} autoComplete="new-password" className="form-input text-sm w-full" placeholder="Apellidos" />
                        </FormRow>
                        <FormRow label="Nombre completo">
                            <input value={watch("nombreCompleto") || ""} readOnly className="form-input text-sm w-full bg-slate-50 text-slate-600 font-bold border-transparent" />
                        </FormRow>
                        <FormRow label="Sexo" required={isRequired("sexo", true)} error={errors.sexo}>
                            <select {...register("sexo")} className="form-input text-sm w-full md:w-64">
                                <option value="">Seleccione...</option>
                                {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </FormRow>
                        <FormRow label="Estado civil" required={isRequired("estadoCivil", true)} error={errors.estadoCivil}>
                            <select {...register("estadoCivil")} className="form-input text-sm w-full md:w-64">
                                <option value="">Seleccione...</option>
                                {ESTADOS_CIVILES.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                            </select>
                        </FormRow>
                    </div>

                    <SectionTitle num="2" title="Datos de contacto & Ubicación" />
                    <div className="pl-0 md:pl-4 space-y-1">
                        <FormRow label="País de nacimiento" required={isRequired("paisNacimiento", true)} error={errors.paisNacimiento}>
                            <SearchableSelect 
                                value={watch("paisNacimiento")}
                                onChange={(val) => setValue("paisNacimiento", val, { shouldDirty: true })}
                                options={PAISES.map(p => typeof p === "object" ? p.pais : p)}
                                placeholder="Seleccione..."
                            />
                        </FormRow>
                        <FormRow label="Ciudad de nacimiento">
                            {!paisNacimiento ? (
                                <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                    <option value="">Seleccione primero un país...</option>
                                </select>
                            ) : loadingCiudadesNacimiento ? (
                                <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                    <option value="">Cargando ciudades...</option>
                                </select>
                            ) : ciudadesNacimiento.length > 0 ? (
                                <SearchableSelect 
                                    value={watch("ciudadNacimiento")}
                                    onChange={(val) => setValue("ciudadNacimiento", val, { shouldDirty: true })}
                                    options={ciudadesNacimiento}
                                    placeholder="Seleccione..."
                                    disabled={!paisNacimiento}
                                    disabledPlaceholder="Seleccione primero un país..."
                                    loading={loadingCiudadesNacimiento}
                                    loadingPlaceholder="Cargando ciudades..."
                                />
                            ) : (
                                <input 
                                    type="text" 
                                    {...register("ciudadNacimiento")} 
                                    className="form-input text-sm w-full md:w-64 font-medium" 
                                    placeholder="Escriba la ciudad" 
                                />
                            )}
                        </FormRow>
                        <FormRow label="Fecha de Nacimiento" required={isRequired("fechaNacimiento", true)} error={errors.fechaNacimiento}>
                            <div className="flex gap-4">
                                <input type="date" {...register("fechaNacimiento")} className="form-input text-sm w-full md:w-48" />
                                <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 font-bold flex items-center shadow-inner">
                                    Edad: {age || "---"}
                                </div>
                            </div>
                        </FormRow>

                        <FormRow label="País de domicilio" required={isRequired("paisDomicilio", true)} error={errors.paisDomicilio}>
                            <SearchableSelect 
                                value={watch("paisDomicilio")}
                                onChange={(val) => setValue("paisDomicilio", val, { shouldDirty: true })}
                                options={PAISES.map(p => typeof p === "object" ? p.pais : p)}
                                placeholder="Seleccione..."
                            />
                        </FormRow>
                        <FormRow label="Ciudad de domicilio" required={isRequired("ciudadDomicilio", true)} error={errors.ciudadDomicilio}>
                            {!paisDomicilio ? (
                                <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                    <option value="">Seleccione primero un país...</option>
                                </select>
                            ) : loadingCiudadesDomicilio ? (
                                <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                    <option value="">Cargando ciudades...</option>
                                </select>
                            ) : ciudadesDomicilio.length > 0 ? (
                                <SearchableSelect 
                                    value={watch("ciudadDomicilio")}
                                    onChange={(val) => setValue("ciudadDomicilio", val, { shouldDirty: true })}
                                    options={ciudadesDomicilio}
                                    placeholder="Seleccione..."
                                    disabled={!paisDomicilio}
                                    disabledPlaceholder="Seleccione primero un país..."
                                    loading={loadingCiudadesDomicilio}
                                    loadingPlaceholder="Cargando ciudades..."
                                />
                            ) : (
                                <input 
                                    type="text" 
                                    {...register("ciudadDomicilio")} 
                                    className="form-input text-sm w-full md:w-64 font-medium" 
                                    placeholder="Escriba la ciudad" 
                                />
                            )}
                        </FormRow>
                        <FormRow label="Barrio" required={isRequired("barrioDomicilio", true)} error={errors.barrio}>
                            <div className="flex gap-2">
                                <div className="relative flex-1 max-w-[16rem]">
                                    <input 
                                        {...register("barrio")} 
                                        onFocus={() => setShowBarrioSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowBarrioSuggestions(false), 200)}
                                        className="form-input text-sm w-full"
                                        placeholder="Barrio"
                                    />
                                    {showBarrioSuggestions && filteredBarrios.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden py-1">
                                            {filteredBarrios.map(b => (
                                                <button key={b} type="button" onMouseDown={() => setValue("barrio", b, { shouldDirty: true })} className="w-full px-4 py-2 text-left text-[13px] hover:bg-slate-50 text-slate-700">
                                                    {b}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={handleAgregarBarrio} className="w-10 h-10 shrink-0 bg-[#8CC63F] text-white rounded-xl flex items-center justify-center hover:bg-[#7bb335] transition-colors shadow-md shadow-[#8CC63F]/20" title="Agregar barrio al catálogo">
                                    <FiPlus size={20} />
                                </button>
                            </div>
                        </FormRow>
                        <FormRow label="Lugar de residencia" required={isRequired("lugarResidencia", true)} error={errors.lugarResidencia}>
                            <input {...register("lugarResidencia")} className="form-input text-sm w-full" placeholder="Dirección completa" />
                        </FormRow>

                        <FormRow label="Configuración Domicilio">
                            <div className="flex gap-4 items-center">
                                <select {...register("estrato")} className="form-input text-sm w-32">
                                    <option value="">Estrato</option>
                                    {ESTRATOS.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                                <select {...register("zonaResidencial")} className="form-input text-sm w-40">
                                    <option value="">Zona Residencial</option>
                                    {ZONAS_RESIDENCIALES.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                        </FormRow>
                        <FormRow label="Celular" required={isRequired("celular", true)} error={errors.celular}>
                            <div className="flex items-center gap-0 w-full max-w-sm">
                                {/* Prefijo compacto con dropdown de búsqueda */}
                                <div className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => { setShowPrefijoDrop(v => !v); setPrefijoSearch(""); }}
                                        className="h-9 px-2.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 transition-colors whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    >
                                        {watch("prefijoCelular") || "+57"}
                                        <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                    <input type="hidden" {...register("prefijoCelular")} />
                                    {showPrefijoDrop && (
                                        <div
                                            className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
                                            style={{ minWidth: "200px" }}
                                            onMouseDown={e => e.stopPropagation()}
                                        >
                                            <div className="px-2 pt-2 pb-1 border-b border-slate-100">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={prefijoSearch}
                                                    onChange={e => setPrefijoSearch(e.target.value)}
                                                    placeholder="Buscar país o prefijo..."
                                                    className="w-full h-7 px-2 text-[11px] font-bold border border-slate-200 rounded-md outline-none focus:border-blue-400 bg-slate-50"
                                                />
                                            </div>
                                            <div className="max-h-52 overflow-y-auto custom-scrollbar">
                                                {PREFIJOS_TELEFONICOS
                                                    .filter(p =>
                                                        !prefijoSearch ||
                                                        p.pais.toLowerCase().includes(prefijoSearch.toLowerCase()) ||
                                                        p.prefijo.includes(prefijoSearch)
                                                    )
                                                    .map(p => (
                                                        <button
                                                            key={`${p.pais}-${p.prefijo}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setValue("prefijoCelular", p.prefijo);
                                                                setShowPrefijoDrop(false);
                                                            }}
                                                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                        >
                                                            <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-700">{p.pais}</span>
                                                            <span className="text-[11px] font-black text-slate-800 group-hover:text-blue-700 ml-2">{p.prefijo}</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Input del número */}
                                <input
                                    {...register("celular")}
                                    autoComplete="off"
                                    className="form-input text-sm flex-1 rounded-l-none border-l-0 focus:z-10"
                                    placeholder="Número de celular"
                                    onFocus={() => setShowPrefijoDrop(false)}
                                />
                            </div>
                        </FormRow>

                        <FormRow label="Correo Electrónico" required={isRequired("correoElectronico", true)} error={errors.email}>
                            <input {...register("email")} className="form-input text-sm w-full" placeholder="Correo" />
                        </FormRow>
                        <FormRow label="Ocupación" required={isRequired("ocupacion", true)} error={errors.ocupacion}>
                            <input {...register("ocupacion")} className="form-input text-sm w-full md:w-64" placeholder="Ocupación" />
                        </FormRow>

                        <FormRow label="Opciones Adicionales">
                            <div className="flex gap-8 items-center py-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input type="checkbox" {...register("esExtranjero")} className="sr-only" />
                                        <div className={`w-8 h-5 rounded-full transition-all ${watch("esExtranjero") ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${watch("esExtranjero") ? 'translate-x-3' : ''}`} />
                                    </div>
                                    <span className="text-[13px] font-semibold text-slate-600">¿Es extranjero?</span>
                                </label>
                            </div>
                        </FormRow>
                    </div>
                </div>

                {/* Section 3: Responsable y Acompañante */}
                {(isVisible("respNombre") || isVisible("respParentesco") || isVisible("respCelular") || isVisible("respTelefono") || isVisible("respCorreo") || isVisible("acompNombre") || isVisible("acompTelefono")) && (
                    <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm mb-8 pb-8">
                        <SectionTitle num="3" title="Responsable y Acompañante" />
                        <div className="pl-0 md:pl-4 space-y-1">
                            {isVisible("respNombre") && (
                                <FormRow label="Nombre Responsable" error={errors.nombreResponsable}>
                                    <input {...register("nombreResponsable")} className="form-input text-sm w-full font-medium" placeholder="Nombre completo del responsable" />
                                </FormRow>
                            )}
                            {isVisible("respParentesco") && (
                                <FormRow label="Parentesco">
                                    <select {...register("parentesco")} className="form-input text-sm w-full md:w-64">
                                        <option value="">Seleccione...</option>
                                        {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </FormRow>
                            )}
                            {isVisible("respCelular") && (
                                <FormRow label="Celular Responsable" error={errors.celularResponsable}>
                                    <input {...register("celularResponsable")} className="form-input text-sm w-full md:w-64 font-medium" placeholder="Celular" />
                                </FormRow>
                            )}
                            {isVisible("respTelefono") && (
                                <FormRow label="Teléfono Responsable" error={errors.telefonoResponsable}>
                                    <input {...register("telefonoResponsable")} className="form-input text-sm w-full md:w-64 font-medium" placeholder="Teléfono" />
                                </FormRow>
                            )}
                            {isVisible("respCorreo") && (
                                <FormRow label="Correo Responsable" error={errors.emailResponsable}>
                                    <input {...register("emailResponsable")} className="form-input text-sm w-full font-medium" placeholder="Correo electrónico del responsable" />
                                </FormRow>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* 2. RIGHT COLUMN: PHOTO & STATUS */}
            <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-8 self-start">
                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col items-center">
                    <div className="w-48 h-48 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden mb-6 group relative">
                        {isCameraActive ? (
                            <div className="flex flex-col items-center justify-center text-emerald-600 bg-emerald-50 w-full h-full">
                                <FiCamera size={32} className="animate-pulse mb-1" />
                                <span className="text-[10px] font-bold uppercase">Cámara activa</span>
                            </div>
                        ) : fotoPreview ? (
                            <>
                                <img src={fotoPreview} className="w-full h-full object-cover" alt="Preview" />
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                                    <button type="button" onClick={startCamera} className="p-2.5 bg-white/20 text-white rounded-full hover:bg-[#8CC63F]"><FiCamera size={18} /></button>
                                    <button type="button" onClick={() => onFotoChange(null)} className="p-2.5 bg-white/20 text-white rounded-full hover:bg-rose-500"><FiTrash2 size={18} /></button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-4">
                                <FiCamera size={40} className="text-slate-300 mx-auto mb-3" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Sin foto</p>
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => onFotoChange(e.target.files[0])} />
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    
                    <button type="button" onClick={startCamera} className="w-full py-3 bg-[#8CC63F] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#8CC63F]/10 hover:bg-[#7bb335] transition-all flex items-center justify-center gap-2 mb-8">
                        <FiCamera size={14} /> Tomar foto
                    </button>

                    {/* MODAL CÁMARA */}
                    {isCameraActive && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-100 flex flex-col items-center p-5 space-y-4">
                                <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <FiCamera size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Capturar Foto de Paciente</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Centra el rostro en la guía</p>
                                        </div>
                                    </div>
                                    <button type="button" onClick={stopCamera} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                        <FiX size={18} />
                                    </button>
                                </div>

                                <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                                    <video 
                                        ref={videoRef} 
                                        className="w-full h-full object-cover" 
                                        autoPlay 
                                        playsInline 
                                    />
                                    {/* Guía ovalada para centrar el rostro */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-48 h-60 rounded-[50%] border-2 border-white/40 border-dashed shadow-2xl"></div>
                                    </div>
                                </div>

                                <div className="w-full flex items-center justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={stopCamera}
                                        className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={takePhoto}
                                        className="px-4 py-2 text-xs font-bold text-white bg-[#8CC63F] hover:bg-[#7bb335] rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <FiCamera size={14} /> CAPTURAR FOTO
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="w-full space-y-3">
                        <div className="w-full py-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2">
                            <FiActivity size={12} /> Paciente Registrado
                        </div>
                    </div>
                </div>
                
                <div className="border border-rose-200 bg-rose-50 rounded-2xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 text-rose-600 font-bold mb-3 text-[11px] uppercase tracking-widest"><FiAlertCircle /> ALERTAS MÉDICAS</label>
                    <textarea 
                        {...register("alertas")} 
                        className="w-full h-24 p-4 border border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 text-sm text-slate-800 bg-white" 
                        placeholder="Escribe alergias o condiciones..."
                    />
                </div>
            </div>
        </div>
    );
};

const FormAseguramiento = ({ conveniosList = [] }) => {
    const { register, watch, setValue, formState: { errors } } = useFormContext();
    const [epsList, setEpsList] = useState([]);
    const { userProfile } = useAuth();
    const toast = useToast();

    useEffect(() => {
        if(userProfile?.inquilino) {
            const loadEps = async () => {
                try {
                    const { epsCatalogo } = await import("../../../services/supabaseServices");
                    const eps = await epsCatalogo.getByTenant(userProfile.inquilino);
                    const uniqueEps = eps.map(e => e.nombre).filter(Boolean);
                    uniqueEps.sort((a, b) => a.localeCompare(b));
                    setEpsList(uniqueEps);
                } catch (e) {
                    console.error("Error loading EPS catalog from Supabase:", e);
                }
            };
            loadEps();
        }
    }, [userProfile?.inquilino]);

    const epsValue = watch("nombreEps");
    const filteredEps = epsList.filter(e => e.toLowerCase().includes((epsValue||"").toLowerCase())).slice(0,5);
    const [showEps, setShowEps] = useState(false);

    const handleAgregarEps = async (e) => {
        e.preventDefault();
        const epsInput = watch("nombreEps");
        if (!epsInput || !epsInput.trim()) {
            toast?.error("Por favor, ingrese un nombre de EPS");
            return;
        }

        const normalizedEps = epsInput.trim();
        
        if (epsList.map(e => e.toLowerCase()).includes(normalizedEps.toLowerCase())) {
            toast?.info("Esta EPS ya se encuentra registrada");
            return;
        }

        if (!userProfile?.inquilino) {
            toast?.error("Inquilino no identificado");
            return;
        }

        try {
            const { epsCatalogo } = await import("../../../services/supabaseServices");
            await epsCatalogo.create(userProfile.inquilino, normalizedEps);
            setEpsList(prev => [...prev, normalizedEps].sort((a, b) => a.localeCompare(b)));
            toast?.success("EPS agregada al catálogo con éxito");
        } catch (err) {
            console.error("Error saving new EPS to Supabase:", err);
            toast?.error("Error al guardar la EPS en el catálogo");
        }
    };

    return (
        <div className="p-3 md:p-6 animate-fadeIn max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-4">
                <div className="flex items-center gap-3 bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/80">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shadow-sm">
                        <FiShield size={13} />
                    </div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Aseguramiento & EPS</h3>
                </div>
                <div className="py-2 space-y-0.5">
                    <FormRow label="Tipo de vinculación" required={isRequired("tipoVinculacion", true)} error={errors.tipoVinculacion}>
                        <select {...register("tipoVinculacion")} className="form-input text-xs w-full md:w-64 rounded-xl border-slate-200 h-9">
                            <option value="">Seleccione...</option>
                            {TIPOS_VINCULACION.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FormRow>
                    <FormRow label="Nombre de la EPS" required={isRequired("nombreEps", true)} error={errors.nombreEps}>
                        <div className="flex gap-2">
                            <div className="relative flex-1 max-w-[16rem]">
                                <input 
                                    {...register("nombreEps")} 
                                    onFocus={() => setShowEps(true)}
                                    onBlur={() => setTimeout(() => setShowEps(false), 200)}
                                    className="form-input text-xs w-full rounded-xl border-slate-200 h-9"
                                    placeholder="Nombre de la EPS"
                                />
                                {showEps && filteredEps.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1">
                                        {filteredEps.map(eps => (
                                            <button key={eps} type="button" onMouseDown={() => setValue("nombreEps", eps)} className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 text-slate-700 font-medium">
                                                {eps}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleAgregarEps} className="w-9 h-9 shrink-0 bg-[#8CC63F] text-white rounded-xl flex items-center justify-center hover:bg-[#7bb335] transition-colors shadow-md shadow-[#8CC63F]/20" title="Agregar EPS al catálogo">
                                <FiPlus size={18} />
                            </button>
                        </div>
                    </FormRow>
                    <FormRow label="Póliza de salud">
                        <input {...register("polizaSalud")} className="form-input text-xs w-full md:w-80 rounded-xl border-slate-200 h-9" placeholder="Póliza de salud del paciente" />
                    </FormRow>
                </div>
            </div>
        </div>
    );
};

const FormMarketing = ({ pacientesRemision = [], profesionales = [], conveniosList = [] }) => {
    const { register, watch, setValue } = useFormContext();

    const remitidoPorType = watch("remitidoPorType");
    const initialRemitidoRef = React.useRef(true);
    useEffect(() => {
        if (initialRemitidoRef.current) {
            initialRemitidoRef.current = false;
        } else {
            setValue("remitidoPorValue", "");
        }
    }, [remitidoPorType, setValue]);

    const asesorComercialType = watch("asesorComercialType");
    const initialAsesorRef = React.useRef(true);
    useEffect(() => {
        if (initialAsesorRef.current) {
            initialAsesorRef.current = false;
        } else {
            setValue("asesorComercialValue", "");
        }
    }, [asesorComercialType, setValue]);

    return (
        <div className="p-4 md:p-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm pb-32">
                <SectionTitle num="4" title="Estrategia de Mercadeo" />
                <div className="pl-0 md:pl-4 space-y-1">
                    <FormRow label="Convenio beneficio">
                        <SearchableSelect
                            value={watch("convenioBeneficio")}
                            onChange={(val) => setValue("convenioBeneficio", val === "Ninguno" ? "" : val, { shouldDirty: true })}
                            options={["Ninguno", ...conveniosList]}
                            placeholder="Seleccione..."
                            className="w-full md:w-64"
                        />
                    </FormRow>

                    <FormRow label="Convenio de pago">
                        <input {...register("convenioPago")} className="form-input text-sm w-full md:w-64" placeholder="Convenio de pago paciente" />
                    </FormRow>

                    <FormRow label="Cómo nos conoció">
                        <select {...register("comoConocio")} className="form-input text-sm w-full md:w-64">
                            <option value="">Seleccione...</option>
                            {MEDIOS_CONOCIMIENTO.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </FormRow>

                    <FormRow label="Campaña">
                        <input {...register("campania")} className="form-input text-sm w-full" placeholder="Campaña relacionada con el paciente" />
                    </FormRow>

                    <FormRow label="Remitido por">
                        <div className="flex flex-col gap-3 w-full">
                            {/* Segmented Control / Selector de tipo de remisión */}
                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setValue("remitidoPorType", "Usuario")}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                        remitidoPorType === "Usuario"
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Usuario
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setValue("remitidoPorType", "Paciente")}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                        remitidoPorType === "Paciente"
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Paciente
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setValue("remitidoPorType", "Libre")}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                        remitidoPorType === "Libre"
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Libre
                                </button>
                            </div>

                            {/* Campo de valor de remisión */}
                            <div className="flex gap-2">
                                {remitidoPorType === "Usuario" && (
                                    <SearchableSelect 
                                        value={watch("remitidoPorValue")}
                                        onChange={(val) => setValue("remitidoPorValue", val, { shouldDirty: true })}
                                        options={profesionales.map(p => p.displayName)}
                                        placeholder="Seleccione un doctor..."
                                        className="w-full md:w-96"
                                    />
                                )}
                                {remitidoPorType === "Paciente" && (
                                    <SearchableSelect 
                                        value={watch("remitidoPorValue")}
                                        onChange={(val) => setValue("remitidoPorValue", val, { shouldDirty: true })}
                                        options={pacientesRemision.map(p => p.nombreCompleto || `${p.nombre || ""} ${p.apellido || ""}`.trim())}
                                        placeholder="Seleccione un paciente..."
                                        className="w-full md:w-96"
                                    />
                                )}
                                {remitidoPorType === "Libre" && (
                                    <input
                                        {...register("remitidoPorValue")}
                                        className="form-input text-sm w-full md:w-96"
                                        placeholder="Nombre de la persona que refiere"
                                    />
                                )}
                            </div>
                        </div>
                    </FormRow>

                    <FormRow label="Asesor comercial">
                        <div className="flex flex-col gap-3 w-full">
                            {/* Segmented Control / Selector de tipo de asesor */}
                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setValue("asesorComercialType", "Usuario")}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                        asesorComercialType === "Usuario"
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Usuario
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setValue("asesorComercialType", "Libre")}
                                    className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                        asesorComercialType === "Libre"
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Libre
                                </button>
                            </div>

                            {/* Campo de valor de asesor */}
                            <div className="flex gap-2">
                                {asesorComercialType === "Usuario" && (
                                    <SearchableSelect 
                                        value={watch("asesorComercialValue")}
                                        onChange={(val) => setValue("asesorComercialValue", val, { shouldDirty: true })}
                                        options={profesionales.map(p => p.displayName)}
                                        placeholder="Seleccione un asesor..."
                                        className="w-full md:w-96"
                                    />
                                )}
                                {asesorComercialType === "Libre" && (
                                    <input
                                        {...register("asesorComercialValue")}
                                        className="form-input text-sm w-full md:w-96"
                                        placeholder="Nombre del asesor comercial"
                                    />
                                )}
                            </div>
                        </div>
                    </FormRow>

                    <FormRow label="Permite Publicidad">
                        <label className="flex items-center gap-3 cursor-pointer group py-2">
                             <div className="relative">
                                 <input type="checkbox" {...register("permitePublicidad")} className="sr-only" />
                                 <div className={`w-8 h-5 rounded-full transition-all ${watch("permitePublicidad") ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                 <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${watch("permitePublicidad") ? 'translate-x-3' : ''}`} />
                             </div>
                        </label>
                    </FormRow>
                </div>
            </div>
        </div>
    );
};

const SidebarButton = ({ label, active, onClick, icon: Icon, badge }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full group px-3 py-1.5 rounded-lg transition-all flex items-center justify-between border-l-[3px] ${
            active
                ? "bg-indigo-50/50 border-indigo-600 text-indigo-700 shadow-sm"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
    >
        <div className="flex items-center gap-2.5">
            <span className={`transition-transform duration-300 ${active ? "scale-105" : "group-hover:scale-105"}`}>
                <Icon size={14} className={active ? "text-indigo-600" : "text-slate-400"} />
            </span>
            <span className={`text-[10px] font-black uppercase tracking-tight ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
        </div>
        {badge && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-full uppercase">
                {badge}
            </span>
        )}
    </button>
);

const SidebarSectionTitle = ({ children }) => (
    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 mt-5 px-3 border-b border-slate-50 pb-1.5">
        {children}
    </div>
);

const normalizeTipoDocumento = (tipo) => {
    if (!tipo) return "";
    const mapping = {
        "CC": "Cédula de ciudadanía",
        "TI": "Tarjeta de identidad",
        "RC": "Registro civil de nacimiento",
        "CE": "Cédula de extranjería",
        "PA": "Pasaporte",
        "PE": "Permiso por protección temporal",
        "PEP": "PEP"
    };
    return mapping[tipo] || tipo;
};

export default function PatientDetails({ initialData, onClose, onDelete }) {
    const [patient, setPatient] = useState(initialData || null);
    const { logAction } = useAudit();
    const [searchParams, setSearchParams] = useSearchParams();

    // Default to "presu" (Presupuestos & planes) if the URL path ends with "/planes"
    const pathEndsWithPlanes = window.location.pathname.toLowerCase().endsWith("/planes");
    const queryTab = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(queryTab || (pathEndsWithPlanes ? "presu" : "datos"));
    
    useEffect(() => {
        const currentTab = searchParams.get("tab");
        if (currentTab && currentTab !== activeTab) {
            setActiveTab(currentTab);
        }
    }, [searchParams]);

    const [showWarningModal, setShowWarningModal] = useState(false);

    const isPatientIncomplete = useMemo(() => {
        if (!patient) return true;

        // Si ya fue guardado y marcado explícitamente como completo
        if (patient.registroCompleto === true || patient.registro_completo === true) {
            const hasDoc = Boolean(patient.nroDocumento || patient.documento);
            const hasNom = Boolean(patient.nombres);
            const hasApe = Boolean(patient.apellidos);
            if (hasDoc && hasNom && hasApe) return false;
        }

        // Verificar campos obligatorios exigidos por la ficha clínica
        const doc = (patient.nroDocumento || patient.documento || "").toString().trim();
        const nom = (patient.nombres || "").toString().trim();
        const ape = (patient.apellidos || "").toString().trim();
        const fn = (patient.fechaNacimiento || patient.fecha_nacimiento || "").toString().trim();
        const sex = (patient.sexo || patient.genero || "").toString().trim();
        const ec = (patient.estadoCivil || patient.estado_civil || "").toString().trim();
        const pn = (patient.paisNacimiento || patient.pais_nacimiento || "").toString().trim();
        const pd = (patient.paisDomicilio || patient.pais_domicilio || "").toString().trim();
        const cd = (patient.ciudadDomicilio || patient.ciudad_domicilio || "").toString().trim();
        const bar = (patient.barrio || "").toString().trim();
        const dir = (patient.lugarResidencia || patient.lugar_residencia || patient.direccion || "").toString().trim();
        const cel = (patient.celular || patient.telefono || "").toString().trim();
        const em = (patient.email || patient.correo || "").toString().trim();
        const oc = (patient.ocupacion || "").toString().trim();

        // Si falta alguno de los datos clave de datos personales
        if (!doc || !nom || !ape || !fn || !sex || !ec || !pn || !pd || !cd || !bar || !dir || !cel || !em || !oc) {
            return true;
        }

        return false;
    }, [patient]);

    useEffect(() => {
        if (isPatientIncomplete) {
            if (activeTab !== "datos") {
                setActiveTab("datos");
                const currentParams = {};
                for (const [key, value] of searchParams.entries()) {
                    currentParams[key] = value;
                }
                currentParams.tab = "datos";
                setSearchParams(currentParams);
            }
        }
    }, [patient?.id, isPatientIncomplete, activeTab, searchParams, setSearchParams]);

    const [financials, setFinancials] = useState(null);
    const { userProfile } = useAuth();
    const toast = useToast();

    const [pacientesRemision, setPacientesRemision] = useState([]);
    const [profesionales, setProfesionales] = useState([]);
    const [conveniosList, setConveniosList] = useState([]);
    const inquilino = userProfile?.inquilino;

    useEffect(() => {
        if (!inquilino) return;
        const loadRemisionCatalogs = async () => {
            try {
                // Load patients from Supabase
                const { data: pacientesData, error: pacientesError } = await supabase
                    .from("pacientes")
                    .select("id, nombres, apellidos, documento")
                    .eq("tenant_id", inquilino);

                if (pacientesError) throw pacientesError;

                const pacientes = (pacientesData || []).map(d => ({
                    id: d.id,
                    nombres: d.nombres,
                    apellidos: d.apellidos,
                    nombreCompleto: `${d.nombres || ""} ${d.apellidos || ""}`.trim() || d.documento
                })).sort((a, b) => (a.nombreCompleto || "").localeCompare(b.nombreCompleto || ""));
                setPacientesRemision(pacientes);

                // Load professionals from Supabase
                const { profesionalesService } = await import("../../../services/supabaseServices");
                const doctors = await profesionalesService.getByTenant(inquilino);
                const doctorsFormatted = doctors.map(d => ({ 
                    id: d.id, 
                    ...d, 
                    displayName: d.nombre_completo || d.nombre 
                })).sort((a, b) => a.displayName.localeCompare(b.displayName));
                setProfesionales(doctorsFormatted);

                // TODO: Migrate convenios to Supabase when ready
                // For now, set empty array to avoid Firestore dependency
                setConveniosList([]);
                console.log("💡 Convenios temporalmente vacío - pendiente migración a Supabase");
            } catch (e) {
                console.error("Error loading remision catalogs from Supabase:", e);
            }
        };
        loadRemisionCatalogs();
    }, [inquilino]);

    const buildDefaultValues = (data = {}) => ({
        prefijoCelular: "+57",
        paisNacimiento: data.paisNacimiento || data.pais_nacimiento || "Colombia",
        paisDomicilio: data.paisDomicilio || data.pais_domicilio || "Colombia",
        ciudadDomicilio: data.ciudadDomicilio || data.ciudad_domicilio || "",
        ciudadNacimiento: data.ciudadNacimiento || data.ciudad_nacimiento || "",
        barrio: data.barrio || "",
        lugarResidencia: data.lugarResidencia || data.lugar_residencia || data.direccion || "",
        zonaResidencial: data.zonaResidencial || data.zona_residencial || data.zona || "Urbana",
        sexo: data.sexo || data.genero || "",
        estadoCivil: data.estadoCivil || data.estado_civil || "",
        ocupacion: data.ocupacion || "",
        email: data.email || data.correo || "",
        estrato: data.estrato || "",
        ...data,
        tipoDocumento: normalizeTipoDocumento(data.tipoDocumento || data.tipo_documento),
        nroDocumento: data.nroDocumento || data.documento || "",
        nombres: data.nombres || "",
        apellidos: data.apellidos || "",
        celular: data.celular || data.telefono || "",
        fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || "",
        remitidoPorType: data.remitidoPorType || "Libre",
        asesorComercialType: data.asesorComercialType || "Libre",
        esExtranjero: data.esExtranjero || false,
        permitePublicidad: data.permitePublicidad ?? true,
        fechaIngreso: data.fechaIngreso || (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })()
    });

    // RHF Form
    const methods = useForm({
        resolver: zodResolver(patientSchema),
        defaultValues: buildDefaultValues(initialData)
    });

    const isEditableTab = ['datos', 'mark', 'eps'].includes(activeTab);

    const [pendingTab, setPendingTab] = useState(null);
    const [pendingClose, setPendingClose] = useState(false);
    const [showEpsWarning, setShowEpsWarning] = useState(false);

    const handleTabChange = (newTab) => {
        if (isPatientIncomplete && newTab !== "datos") {
            setShowWarningModal(true);
            return;
        }
        if (isEditableTab && methods.formState.isDirty) {
            setPendingTab(newTab);
            return;
        }

        // Update URL search parameters
        const currentParams = {};
        for (const [key, value] of searchParams.entries()) {
            currentParams[key] = value;
        }
        if (currentParams.tab !== newTab) {
            currentParams.tab = newTab;
            setSearchParams(currentParams);
        }

        if (activeTab === newTab) {
            setActiveTab("");
            setTimeout(() => setActiveTab(newTab), 0);
        } else {
            setActiveTab(newTab);
        }
    };

    const handleClose = () => {
        const epsNombre = methods.getValues("nombreEps");
        const epsVinculacion = methods.getValues("tipoVinculacion");
        const isEpsMissing = !epsNombre || !epsVinculacion;

        if (isEpsMissing) {
            setShowEpsWarning(true);
            return;
        }

        if (methods.formState.isDirty) {
            setPendingClose(true);
            return;
        }
        onClose();
    };

    // Sync unsaved changes flag with global window object and handle page exit
    useEffect(() => {
        const isDirty = methods.formState.isDirty;
        window.hasUnsavedChanges = isDirty;

        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.hasUnsavedChanges = false;
        };
    }, [methods.formState.isDirty]);

    // Make sure we update if initialData changes or loads directly
    useEffect(() => {
        if (initialData) {
            setPatient(initialData);
            if (!methods.formState.isDirty) {
                methods.reset(buildDefaultValues(initialData));
            }
        }
    }, [initialData, methods]);

    useEffect(() => {
        if (!initialData?.id) return;
        
        console.log("🔍 PatientDetails - Cargando paciente ID:", initialData.id);
        
        let isMounted = true;
        
        // Cargar SOLO desde Supabase (fuente única de datos de pacientes)
        const loadPatientData = async () => {
            try {
                console.log("📡 Cargando desde Supabase...");
                const { getPatientById } = await import("../../../services/patientService");
                const supabaseData = await getPatientById(initialData.id);
                
                if (supabaseData && isMounted) {
                    console.log("✅ Paciente cargado desde Supabase:", supabaseData);
                    setPatient(supabaseData);
                    if (!methods.formState.isDirty) {
                        methods.reset(buildDefaultValues(supabaseData));
                    }
                } else {
                    console.warn("⚠️ No se encontró paciente con ID:", initialData.id);
                }
            } catch (err) {
                console.error("❌ Error cargando paciente:", err);
            }
        };
        
        loadPatientData();
        
        // Cleanup
        return () => {
            isMounted = false;
        };
    }, [initialData?.id]);

    useEffect(() => {
        if (!patient?.id) return;
        
        // Listen to changes in the pagos collection in real-time to auto-update credit/balances
        // TODO: Implementar real-time subscriptions de Supabase cuando sea necesario
        import("../../../services/billingService").then(({ getPatientFinancials }) => {
            getPatientFinancials(patient.id, userProfile?.inquilino).then(setFinancials);
        }).catch((e) => {
            console.error("Error cargando finanzas del paciente:", e);
        });
    }, [patient?.id, userProfile?.inquilino]);

    // Compute active realized debt (items marked as done but not paid) in real-time
    const [realizedDebt, setRealizedDebt] = useState(0);
    const [realtimePlans, setRealtimePlans] = useState([]);
    const [realtimePayments, setRealtimePayments] = useState([]);
    const [realtimeEvos, setRealtimeEvos] = useState([]);

    useEffect(() => {
        if (!patient?.id) return;

        // TODO: Migrar a Supabase real-time subscriptions cuando se implementen
        // Por ahora, cargar datos una sola vez
        const loadData = async () => {
            try {
                // Cargar planes de tratamiento desde Supabase
                const { data: plans } = await supabase
                    .from("treatment_plans")
                    .select("*")
                    .eq("paciente_id", patient.id);
                
                setRealtimePlans(plans || []);

                // Cargar pagos desde Supabase
                const { data: payments } = await supabase
                    .from("pagos")
                    .select("*")
                    .eq("paciente_id", patient.id)
                    .neq("estado", "anulado");
                
                setRealtimePayments(payments || []);

                // Cargar evoluciones desde Supabase
                const { data: evolutions } = await supabase
                    .from("evoluciones")
                    .select("*")
                    .eq("paciente_id", patient.id);
                
                setRealtimeEvos(evolutions || []);

            } catch (error) {
                console.error("Error loading patient data:", error);
            }
        };

        loadData();
    }, [patient?.id]);

    useEffect(() => {
        let totalDebt = 0;
        realtimePlans.forEach(plan => {
            const planPayments = realtimePayments.filter(p => p.planId === plan.id);
            const planEvos = realtimeEvos.filter(e => e.planId === plan.id);
            const paidMap = {};
            (plan.items || []).forEach(it => { paidMap[it.id] = 0; });
            planPayments.forEach(p => {
                if (p.itemPayments && p.itemPayments.length > 0) {
                    p.itemPayments.forEach(ip => { 
                        if (paidMap[ip.itemId] !== undefined) paidMap[ip.itemId] += Number(ip.monto || 0); 
                    });
                }
            });
            (plan.items || []).forEach(item => {
                // Compatibilidad: registros nuevos usan `realizado`, antiguos usaban `checked`
                const realized = planEvos.some(e =>
                    e.plantillaItems?.[item.id]?.realizado === true ||
                    (e.plantillaItems?.[item.id]?.realizado === undefined && e.plantillaItems?.[item.id]?.checked === true)
                );
                if (!realized) return;
                const cost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
                const paid = paidMap[item.id] || 0;
                const debt = Math.max(0, cost - paid);
                totalDebt += debt;
            });
        });
        setRealizedDebt(totalDebt);
    }, [realtimePlans, realtimePayments, realtimeEvos]);

    // Cámara Handlers
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [fotoPreview, setFotoPreview] = useState("");
    const [fotoFile, setFotoFile] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (patient && !fotoPreview && patient.fotoUrl) {
            setFotoPreview(patient.fotoUrl);
        }
    }, [patient, fotoPreview]);

    const startCamera = async () => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("El acceso a la cámara requiere una conexión segura (HTTPS o localhost) o un navegador compatible.");
            return;
        }

        const constraintConfigs = [
            { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
            { video: { facingMode: "user" } },
            { video: true }
        ];

        let stream = null;
        let lastError = null;

        for (const constraints of constraintConfigs) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (err) {
                lastError = err;
            }
        }

        if (stream) {
            setCameraStream(stream);
            setIsCameraActive(true);
        } else {
            console.error("Error accessing camera:", lastError);
            let msg = "No se pudo acceder a la cámara. Verifica los permisos de tu navegador.";
            if (lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError") {
                msg = "Permiso de cámara denegado. Haz clic en el icono del candado en la barra de navegación para permitir el acceso.";
            } else if (lastError?.name === "NotFoundError" || lastError?.name === "DevicesNotFoundError") {
                msg = "No se encontró ninguna cámara conectada a este dispositivo.";
            } else if (lastError?.name === "NotReadableError" || lastError?.name === "TrackStartError") {
                msg = "La cámara está siendo usada por otra aplicación (ej: Zoom, Meet, Teams). Ciérrala e inténtalo de nuevo.";
            } else if (lastError?.name === "OverconstrainedError") {
                msg = "La cámara no admite la resolución o configuración solicitada.";
            }
            toast.error(msg);
        }
    };
    useEffect(() => {
        if (isCameraActive && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
        }
    }, [isCameraActive, cameraStream]);

    const stopCamera = () => {
        if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); }
        setIsCameraActive(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
            canvas.toBlob(blob => {
                if (blob) {
                    setFotoFile(new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" }));
                    setFotoPreview(URL.createObjectURL(blob));
                    toast.success("Foto capturada correctamente.");
                }
                stopCamera();
            }, "image/jpeg", 0.9);
        }
    };
    const onFotoChange = file => {
        setFotoFile(file||null);
        if(!file) { setFotoPreview(""); methods.setValue("fotoUrl", ""); }
        else {
            const reader = new FileReader();
            reader.onload = e => setFotoPreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const submitForm = async (data) => {
        try {
            import("../../../services/patientService").then(async ({ createOrUpdatePatient }) => {
                try {
                    const finalPayload = {
                        ...data,
                        edad: calculateAgeStr(data.fechaNacimiento),
                        registroCompleto: true
                    };

                    if (data.barrio && userProfile?.inquilino) {
                        try {
                            const { barriosCatalogo } = await import("../../../services/supabaseServices");
                            const barrios = await barriosCatalogo.getByTenant(userProfile.inquilino);
                            const barExists = barrios.some(b => b.nombre?.trim().toLowerCase() === data.barrio.trim().toLowerCase());
                            if (!barExists) {
                                await barriosCatalogo.create(userProfile.inquilino, data.barrio.trim());
                                console.log("✅ Barrio agregado automáticamente al catálogo de Supabase");
                            }
                        } catch (e) {
                            console.error("Error auto-saving barrio to Supabase:", e);
                        }
                    }

                    const saved = await createOrUpdatePatient(userProfile.inquilino, finalPayload, false, fotoFile);
                    
                    // Actualizar el estado local con los datos guardados SIN recargar desde BD
                    // (evita sobrescribir con datos desactualizados de la BD)
                    setPatient(prev => ({
                        ...prev,
                        ...finalPayload,
                        id: saved.id || patient.id,
                        registroCompleto: true,
                        registro_completo: true
                    }));

                    // Resetear el formulario con los valores guardados
                    methods.reset(buildDefaultValues({
                        ...finalPayload,
                        id: saved.id || patient.id,
                        registroCompleto: true
                    }));

                    // Audit log
                    await logAction(patient?.id || data.nroDocumento, "UPDATE_PATIENT", {
                        nombre: finalPayload.nombreCompleto || `${finalPayload.nombres} ${finalPayload.apellidos}`,
                        documento: finalPayload.nroDocumento
                    });

                    toast.success("Información del paciente actualizada y guardada con éxito");
                    setShowWarningModal(false);
                } catch(e) {
                    toast.error("Hubo un error al guardar");
                }
            });
        } catch(e) {
            toast.error("Hubo un error al guardar");
        }
    };

    // For EPS / Marketing tabs: bypass Zod validation and merge only the changed fields
    const handlePartialSave = async () => {
        const allValues = methods.getValues();
        try {
            import("../../../services/patientService").then(async ({ createOrUpdatePatient }) => {
                try {
                    const finalPayload = {
                        ...allValues,
                        edad: calculateAgeStr(allValues.fechaNacimiento)
                    };

                    if (allValues.nombreEps && userProfile?.inquilino) {
                        try {
                            const { epsCatalogo } = await import("../../../services/supabaseServices");
                            const epsList = await epsCatalogo.getByTenant(userProfile.inquilino);
                            const epsExists = epsList.some(e => e.nombre?.trim().toLowerCase() === allValues.nombreEps.trim().toLowerCase());
                            if (!epsExists) {
                                await epsCatalogo.create(userProfile.inquilino, allValues.nombreEps.trim());
                                console.log("✅ EPS agregada automáticamente al catálogo de Supabase");
                            }
                        } catch (e) {
                            console.error("Error auto-saving EPS to Supabase:", e);
                        }
                    }

                    const saved = await createOrUpdatePatient(userProfile.inquilino, finalPayload, false, fotoFile);
                    
                    // Actualizar el estado local con los datos guardados SIN recargar desde BD
                    setPatient(prev => ({
                        ...prev,
                        ...finalPayload,
                        id: saved.id || patient.id
                    }));

                    // Resetear el formulario con los valores guardados
                    methods.reset(buildDefaultValues({
                        ...finalPayload,
                        id: saved.id || patient.id
                    }));
                    
                    // Audit log
                    await logAction(patient?.id || allValues.nroDocumento, "UPDATE_PATIENT", {
                        nombre: finalPayload.nombreCompleto || `${finalPayload.nombres} ${finalPayload.apellidos}`,
                        documento: finalPayload.nroDocumento,
                        parcial: true
                    });

                    toast.success("Información guardada correctamente ✅");
                } catch(e) {
                    console.error("Error saving partial form:", e);
                    toast.error("Hubo un error al guardar");
                }
            });
        } catch(e) {
            toast.error("Hubo un error al guardar");
        }
    };

    const nombres = methods.watch("nombres");
    const apellidos = methods.watch("apellidos");
    useEffect(() => {
        if (nombres || apellidos) methods.setValue("nombreCompleto", `${nombres || ""} ${apellidos || ""}`.trim());
    }, [nombres, apellidos, methods]);

    if (!patient) return (<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40"><div className="bg-white p-8 rounded-2xl"><p>Cargando datos del paciente...</p></div></div>);

    const isFullHeightTab = ['odonto', 'perio', 'presu', 'hc', 'ai_insights'].includes(activeTab);

    const getPageTitle = () => {
        if (activeTab === 'eps') return 'Edición Eps paciente';
        if (activeTab === 'mark') return 'Edición Marketing paciente';
        if (activeTab === 'pro') return 'Profesionales';
        return 'Edición Información Paciente';
    };

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col animate-fadeIn overflow-hidden">
                {/* 1. THE COMPACT HUD (Header) */}
                <div className="bg-white px-4 md:px-6 py-2.5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20 shadow-[0_2px_15px_-5px_rgba(0,0,0,0.05)] relative">
                    <div className="flex items-center gap-4">
                        <div className="relative group shrink-0">
                            {fotoPreview ? <img src={fotoPreview} alt="Foto" className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-50 shadow-sm" /> : <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg ring-2 ring-slate-50 shadow-md">{(patient.nombreCompleto || "P")[0]}</div>}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none">{methods.watch("nombreCompleto") || "Cargando..."}</h3>
                            </div>
                            <div className="flex items-center gap-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1"><FiInfo className="text-indigo-600" /> {patient.tipoDocumento} {patient.nroDocumento}</span>
                                <span>ID: <span className="text-slate-600">#{patient.nroHistoria || "S/N"}</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleClose} className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-all active:scale-95 shadow-md shadow-slate-200" title="Cerrar expediente">
                            <FiX size={16} />
                        </button>
                    </div>
                </div>

                {patient.registroCompleto === false && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4 animate-pulse shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-md">
                                <FiAlertCircle size={14} />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-amber-800 text-[11px] font-black uppercase tracking-wider">Registro Incompleto</span>
                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                    Este paciente fue registrado desde la agenda y tiene datos pendientes por completar.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab("datos")}
                            className="px-4 py-1.5 bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-700 active:scale-95 transition-all shadow-md shadow-amber-600/10 shrink-0"
                        >
                            Completar Ficha Paciente
                        </button>
                    </div>
                )}

                {/* 2. STUDIO WORKSPACE (Sidebar + Content) */}
                <FormProvider {...methods}>
                    <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                        {/* SIDEBAR */}
                        <aside className="w-full lg:w-60 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 overflow-x-auto lg:overflow-y-auto p-3 flex flex-row lg:flex-col shrink-0 custom-scrollbar-hidden lg:custom-scrollbar scrollbar-hide">
                            <SidebarSectionTitle>Información General</SidebarSectionTitle>
                            <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
                                <SidebarButton icon={FiUser} label="Datos personales" active={activeTab === "datos"} onClick={() => handleTabChange("datos")} />
                                <SidebarButton icon={FiTrendingUp} label="Marketing" active={activeTab === "mark"} onClick={() => handleTabChange("mark")} />
                                <SidebarButton icon={FiShield} label="EPS" active={activeTab === "eps"} onClick={() => handleTabChange("eps")} />
                                <SidebarButton icon={FiUsers} label="Beneficiarios convenio" active={activeTab === "conv"} onClick={() => handleTabChange("conv")} />
                                <SidebarButton icon={FiBriefcase} label="Profesionales" active={activeTab === "pro"} onClick={() => handleTabChange("pro")} />
                                <SidebarButton icon={FiCamera} label="Rx / Imágenes / Doc" active={activeTab === "rx"} onClick={() => handleTabChange("rx")} />
                            </div>

                            <SidebarSectionTitle>Historia Clínica</SidebarSectionTitle>
                            <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
                                <SidebarButton icon={FiClipboard} label="Doc. Clínicos" active={activeTab === "hc"} onClick={() => handleTabChange("hc")} />
                                <SidebarButton icon={FiActivity} label="Odontogramas" active={activeTab === "odonto"} onClick={() => handleTabChange("odonto")} />
                                <SidebarButton icon={FiActivity} label="Periodontogramas" active={activeTab === "perio"} onClick={() => handleTabChange("perio")} />
                                <SidebarButton icon={FiFileText} label="Presupuestos & planes" active={activeTab === "presu"} onClick={() => handleTabChange("presu")} />
                                <SidebarButton icon={FiActivity} label="Evoluciones & Remis" active={activeTab === "evo"} onClick={() => handleTabChange("evo")} />
                            </div>

                            <SidebarSectionTitle>Inteligencia Artificial</SidebarSectionTitle>
                            <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
                                <SidebarButton icon={FiCpu} label="Copiloto IA Insights" active={activeTab === "ai_insights"} onClick={() => handleTabChange("ai_insights")} />
                            </div>

                            <SidebarSectionTitle>Facturación</SidebarSectionTitle>
                            <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
                                <SidebarButton 
                                    icon={FiDollarSign} 
                                    label="Saldo a favor" 
                                    active={activeTab === "saldo"} 
                                    onClick={() => handleTabChange("saldo")} 
                                    badge={financials?.totals?.totalSaldosAFavor > 0 ? `$${formatCurrency(financials.totals.totalSaldosAFavor)}` : "$ 0"} 
                                />
                                <SidebarButton icon={FiDollarSign} label="Realizar pago" active={activeTab === "pago"} onClick={() => handleTabChange("pago")} />
                                {realizedDebt > 0 && !isPatientIncomplete && (
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('pago')}
                                        className="w-full mt-1 mb-1 px-3 py-2 rounded-xl bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-2 animate-pulse hover:animate-none hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 active:scale-95"
                                    >
                                        <FiAlertCircle size={14} className="shrink-0" />
                                        <span>Deuda activa: ${realizedDebt.toLocaleString('es-CO')}</span>
                                    </button>
                                )}
                                <SidebarButton icon={FiDollarSign} label="Histórico pagos" active={activeTab === "hist_pago"} onClick={() => handleTabChange("hist_pago")} />
                                <SidebarButton icon={FiFileText} label="Histórico facturas" active={activeTab === "hist_fact"} onClick={() => handleTabChange("hist_fact")} />
                            </div>
                        </aside>

                        {/* WORKSPACE CONTENT */}
                        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-white relative overflow-hidden">
                            {isEditableTab ? (
                                <form 
                                    autoComplete="off"
                                    onSubmit={methods.handleSubmit(submitForm, (errors) => {
                                        console.warn("Form validation errors:", errors);
                                        
                                        // Construir mensaje con los campos faltantes
                                        const missingFields = Object.keys(errors).map(key => {
                                            const fieldLabels = {
                                                tipoDocumento: "Tipo de Documento",
                                                nroDocumento: "Número de Documento",
                                                nombres: "Nombres",
                                                apellidos: "Apellidos",
                                                fechaNacimiento: "Fecha de Nacimiento",
                                                sexo: "Sexo",
                                                estadoCivil: "Estado Civil",
                                                paisNacimiento: "País de Nacimiento",
                                                paisDomicilio: "País de Domicilio",
                                                ciudadDomicilio: "Ciudad de Domicilio",
                                                barrio: "Barrio",
                                                lugarResidencia: "Lugar de Residencia",
                                                celular: "Celular",
                                                email: "Correo Electrónico",
                                                ocupacion: "Ocupación"
                                            };
                                            return fieldLabels[key] || key;
                                        });
                                        
                                        // Hacer scroll al primer campo con error
                                        const firstErrorKey = Object.keys(errors)[0];
                                        const firstErrorElement = document.querySelector(`[name="${firstErrorKey}"]`);
                                        if (firstErrorElement) {
                                            firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
                                            firstErrorElement.focus();
                                        }
                                        
                                        // Mostrar mensaje con los campos faltantes
                                        if (missingFields.length === 1) {
                                            toast.error(`Campo obligatorio faltante: ${missingFields[0]}`);
                                        } else if (missingFields.length <= 3) {
                                            toast.error(`Campos obligatorios faltantes: ${missingFields.join(", ")}`);
                                        } else {
                                            toast.error(`Por favor completa los ${missingFields.length} campos obligatorios marcados en rojo.`);
                                        }
                                    })} 
                                    className="h-full flex flex-col"
                                >
                                    <div className="px-10 py-4 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 flex flex-col md:flex-row justify-between items-center sticky top-0 z-10">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">{getPageTitle()}</h3>
                                            <span className="text-slate-300">/</span>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                <FiUser size={12} className="text-slate-400" />
                                                <span>Pacientes</span>
                                                <span className="text-slate-300 lowercase mx-1">-</span>
                                                <span className="text-slate-500 lowercase">{getPageTitle()}</span>
                                            </div>
                                        </div>
                                        {/* Use partial save (no Zod validation) for eps/mark; full submit for datos */}
                                        {activeTab === 'datos' ? (
                                            <button type="submit" className="px-8 py-2 bg-[#8CC63F] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] active:scale-95 transition-all flex items-center gap-2">
                                                <FiCheck size={14} /> Guardar
                                            </button>
                                        ) : (
                                            <button type="button" onClick={handlePartialSave} className="px-8 py-2 bg-[#8CC63F] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] active:scale-95 transition-all flex items-center gap-2">
                                                <FiCheck size={14} /> Guardar
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
                                        {activeTab === "datos" && <FormDatosPersonales patient={patient} photoState={{isCameraActive, fotoPreview, startCamera, stopCamera, takePhoto, onFotoChange, videoRef, canvasRef}} />}
                                        {activeTab === "mark" && <FormMarketing pacientesRemision={pacientesRemision} profesionales={profesionales} conveniosList={conveniosList} />}
                                        {activeTab === "eps" && <FormAseguramiento conveniosList={conveniosList} />}
                                    </div>
                                </form>
                            ) : (
                                <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isFullHeightTab ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar animate-fadeIn p-2'}`}>
                                    {activeTab === "rx" && <PatientRxTab patient={patient} onUpdate={setPatient} />}
                                    {activeTab === "evo" && <EvolucionesTab patient={patient} />}
                                    {activeTab === "conv" && <BeneficiariosTab patient={patient} onUpdate={setPatient} onSwitchTab={setActiveTab} />}
                                    {activeTab === "pro" && <ProfesionalesTab patient={patient} onUpdate={setPatient} />}
                                    {activeTab === "fact" && <FacturacionTab patient={patient} />}
                                    
                                    {activeTab === "hc" && <HistoriaClinicaContainer patient={patient} />}
                                    {activeTab === "odonto" && <Odontograma embeddedPatient={patient} />}
                                    {activeTab === "perio" && <Periodontograma embeddedPatient={patient} />}
                                    {activeTab === "presu" && <PresupuestosTab patient={patient} />}
                                    {activeTab === "ai_insights" && <AIInsightsTab patient={patient} />}

                                    {/* Elite Billing Section */}
                                    {activeTab === "saldo" && <SaldoTab patient={patient} />}
                                    {activeTab === "pago" && <PagoTab patient={patient} />}
                                    {activeTab === "hist_pago" && <HistoricoPagosTab patientId={patient.id} />}
                                    {activeTab === "hist_fact" && <HistoricoFacturasTab patientId={patient.id} patient={patient} />}
                                    
                                    {["citas", "fact"].includes(activeTab) && (
                                        <div className="flex flex-col items-center justify-center min-h-[400px] p-10 text-center opacity-40">
                                            <FiActivity size={48} className="mb-4 text-slate-400" />
                                            <h5 className="text-[14px] font-black text-slate-600 uppercase tracking-widest">Módulo en Sincronización</h5>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Esta sección está siendo integrada con el motor Elite</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </main>
                    </div>
                    {showWarningModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            {/* Alert Icon inside soft circles */}
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6 shadow-inner">
                                <FiAlertCircle size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                Datos de Paciente Incompletos
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Para navegar en este módulo es necesario completar los datos obligatorios del paciente. ¿Deseas completarlos ahora o prefieres omitir y salir al menú?
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab("datos");
                                        setShowWarningModal(false);
                                    }}
                                    className="w-full py-3 bg-[#8CC63F] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Completar Datos Ahora
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowWarningModal(false);
                                        onClose();
                                    }}
                                    className="w-full py-3 bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Omitir / Salir al Menú
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {pendingTab && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <FiAlertCircle size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Descartar Cambios?
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Tienes cambios sin guardar en esta pestaña. Si cambias de pestaña ahora, perderás todas las modificaciones realizadas.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        methods.reset();
                                        setActiveTab(pendingTab);
                                        setPendingTab(null);
                                    }}
                                    className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Descartar Cambios
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setPendingTab(null)}
                                    className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Seguir Editando
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {pendingClose && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <FiAlertCircle size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Cerrar Expediente?
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Tienes cambios sin guardar. Si cierras el expediente ahora, perderás todas las modificaciones realizadas.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        methods.reset();
                                        setPendingClose(false);
                                        onClose();
                                    }}
                                    className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Descartar y Cerrar
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setPendingClose(false)}
                                    className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Seguir Editando
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showEpsWarning && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            {/* Icon inside soft circle */}
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <FiShield size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                Datos de EPS Pendientes
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Este paciente no tiene registrados los datos de EPS (Tipo de vinculación y Nombre de la EPS), los cuales son obligatorios para habilitar la facturación y el reporte de RIPS.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEpsWarning(false);
                                        setActiveTab("eps");
                                    }}
                                    className="w-full py-3 bg-[#8CC63F] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Completar EPS Ahora
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEpsWarning(false);
                                        if (methods.formState.isDirty) {
                                            setPendingClose(true);
                                        } else {
                                            onClose();
                                        }
                                    }}
                                    className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Salir de Todos Modos
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </FormProvider>
        </div>
    );
}


