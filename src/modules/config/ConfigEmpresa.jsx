// src/modules/config/ConfigEmpresa.jsx
// ============================================================
// ⚙️ Datos Básicos de Empresa - OdontoCloud
// Diseño compacto, limpio y estructurado sin desperdicio de espacio.
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
    configureSispro,
    getSisproConfig
} from "../../services/tenantSecretsService";
import { getConfigSection, saveConfigSection } from "../../services/configPersistenceService";
import { uploadOptimizedPublicFile } from "../../services/storageUploadService";
import {
    FiSave,
    FiUpload,
    FiImage,
    FiMapPin,
    FiPhone,
    FiMail,
    FiBriefcase,
    FiFileText,
    FiShield,
    FiCheckCircle,
    FiAlertCircle,
    FiInfo,
    FiLayers
} from "react-icons/fi";
import {
    PROVIDER_TYPES,
    BILLING_OBLIGATIONS,
    PROVIDER_CODE_MODES,
    UVT_REFERENCE_NOTICE,
} from "../rips/v003/services/ripsProviderProfileService";

export default function ConfigEmpresa() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sisproHasPassword, setSisproHasPassword] = useState(false);
    const fileInputRef = useRef(null);

    const [sucursalesList, setSucursalesList] = useState([]);

    // Estado del formulario
    const [formData, setFormData] = useState({
        nit: "",
        razonSocial: "",
        nombreComercial: "",
        direccion: "",
        telefono: "",
        celular: "",
        email: "",
        website: "",
        agendamientoUrl: "",
        regimen: "Responsable de IVA",
        moneda: "COP",
        zonaHoraria: "America/Bogota",
        cuentaContable: "",
        providerType: PROVIDER_TYPES.UNCONFIRMED,
        billingObligation: BILLING_OBLIGATIONS.UNCONFIRMED,
        providerCodeMode: PROVIDER_CODE_MODES.UNIQUE,
        providerCodesByBranch: {},
        administrativeConfirmation: false,
        esIps: false,
        sisproUsuario: "",
        sisproTipoDoc: "CC",
        sisproPassword: "",
        codigoPrestador: "",
        logoUrl: "",
        ciudad: "",
        codigoPostal: ""
    });

    useEffect(() => {
        if (userProfile?.inquilino) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [userProfile]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tRes, cRes, sisproConfig, sRes] = await Promise.all([
                supabase.from("tenants").select("*").eq("id", userProfile.inquilino).maybeSingle(),
                getConfigSection(userProfile.inquilino, "empresa_datos", {}),
                getSisproConfig(userProfile.inquilino).catch(() => null),
                supabase.from("sucursales").select("id, nombre, codigo_sede").eq("tenant_id", userProfile.inquilino)
            ]);

            if (tRes.error) throw tRes.error;
            const data = tRes.data || {};
            const extraConfig = cRes || {};
            const privateSispro = sisproConfig || {};
            const sucs = sRes.data || [];
            setSucursalesList(sucs);

            const pType = extraConfig.providerType || (data.esIps ? PROVIDER_TYPES.IPS : (data.esIps === false ? PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE : PROVIDER_TYPES.UNCONFIRMED));
            const bObligation = extraConfig.billingObligation || (data.billingObligation || (pType === PROVIDER_TYPES.IPS ? BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED : BILLING_OBLIGATIONS.UNCONFIRMED));

            setFormData(prev => ({
                ...prev,
                nit: data.nit || extraConfig.nit || "",
                razonSocial: data.razonSocial || extraConfig.razonSocial || "",
                nombreComercial: data.nombre || data.nombreComercial || extraConfig.nombreComercial || "",
                direccion: data.direccion || data.address || extraConfig.direccion || "",
                telefono: data.telefono || data.phone || extraConfig.telefono || "",
                celular: data.celular || extraConfig.celular || "",
                email: data.email || extraConfig.email || "",
                website: data.website || extraConfig.website || "",
                agendamientoUrl: data.agendamientoUrl || extraConfig.agendamientoUrl || "",
                regimen: data.regimen || extraConfig.regimen || "Responsable de IVA",
                moneda: data.moneda || extraConfig.moneda || "COP",
                zonaHoraria: data.zonaHoraria || extraConfig.zonaHoraria || "America/Bogota",
                cuentaContable: data.cuentaContable || extraConfig.cuentaContable || "",
                providerType: pType,
                billingObligation: bObligation,
                providerCodeMode: extraConfig.providerCodeMode || (extraConfig.providerCodesByBranch ? PROVIDER_CODE_MODES.BY_BRANCH : PROVIDER_CODE_MODES.UNIQUE),
                providerCodesByBranch: extraConfig.providerCodesByBranch || {},
                administrativeConfirmation: Boolean(extraConfig.administrativeConfirmation),
                esIps: pType === PROVIDER_TYPES.IPS,
                sisproUsuario: privateSispro.sisproUsuario || extraConfig.sisproUsuario || "",
                sisproTipoDoc: privateSispro.sisproTipoDoc || extraConfig.sisproTipoDoc || "CC",
                sisproPassword: "",
                codigoPrestador: extraConfig.codigoPrestador || privateSispro.codigoPrestador || "",
                logoUrl: data.logo_url || data.logo || extraConfig.logoUrl || "",
                ciudad: data.ciudad || extraConfig.ciudad || "",
                codigoPostal: data.codigoPostal || extraConfig.codigoPostal || ""
            }));
            setSisproHasPassword(Boolean(privateSispro.hasPassword || extraConfig.sisproPassword));
        } catch (error) {
            console.error("Error cargando datos de empresa:", error);
            toast.error("Error al cargar información");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const {
                sisproUsuario,
                sisproTipoDoc,
                sisproPassword,
                codigoPrestador,
                ...empresaPublicData
            } = formData;

            const isIps = formData.providerType === PROVIDER_TYPES.IPS;

            if (isIps || sisproUsuario) {
                await configureSispro(userProfile.inquilino, {
                    sisproUsuario,
                    sisproTipoDoc,
                    sisproPassword,
                    codigoPrestador: formData.providerCodeMode === PROVIDER_CODE_MODES.UNIQUE ? codigoPrestador : ""
                });
            }

            const tenantPayload = {
                nombre: formData.nombreComercial || formData.razonSocial || "Clínica",
                nit: formData.nit || "",
                telefono: formData.telefono || formData.celular || "",
                direccion: formData.direccion || "",
                ciudad: formData.ciudad || "",
                logo_url: formData.logoUrl || "",
                esIps: isIps,
            };

            const { data: updatedTenant, error: tErr } = await supabase
                .from("tenants")
                .update(tenantPayload)
                .eq("id", userProfile.inquilino)
                .select("id")
                .maybeSingle();
            if (tErr) throw tErr;
            if (!updatedTenant) {
                throw new Error("No fue posible actualizar la clínica con los permisos actuales.");
            }

            await saveConfigSection(
                userProfile.inquilino,
                "empresa_datos",
                {
                    ...empresaPublicData,
                    codigoPrestador,
                    providerType: formData.providerType,
                    billingObligation: formData.billingObligation,
                    providerCodeMode: formData.providerCodeMode,
                    providerCodesByBranch: formData.providerCodesByBranch,
                    administrativeConfirmation: formData.administrativeConfirmation,
                    esIps: isIps,
                }
            );

            // Limpiar caché de sesión de AuthContext para asegurar recarga limpia en F5
            try {
                const uid = userProfile?.id || userProfile?.uid;
                if (uid) {
                    sessionStorage.removeItem(`oc_user_profile_${uid}`);
                }
            } catch (e) {}

            window.dispatchEvent(new CustomEvent("tenant-updated"));
            setSisproHasPassword(Boolean(sisproPassword || sisproHasPassword));
            setFormData(prev => ({ ...prev, sisproPassword: "" }));
            toast.success("Información guardada correctamente");
        } catch (error) {
            console.error("Error guardando empresa:", error);
            toast.error("Error al guardar cambios: " + (error.message || ""));
        } finally {
            setSaving(false);
        }
    };



    const handleLogoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            toast.error("Seleccione una imagen (JPG, PNG, WEBP o SVG)");
            return;
        }

        setUploading(true);
        try {
            const extension = (file.name?.split(".").pop() || "jpg").toLowerCase();
            const uploaded = await uploadOptimizedPublicFile({
                bucket: "public-assets",
                path: `${userProfile.inquilino}/branding/logo-${Date.now()}.${extension}`,
                file,
                profile: "avatar"
            });
            const finalUrl = uploaded.publicUrl;
            if (!finalUrl) throw new Error("Storage no devolvió la URL del logo.");

            setFormData(prev => ({ ...prev, logoUrl: finalUrl }));

            if (userProfile?.inquilino) {
                const { error: tenantError } = await supabase
                    .from("tenants")
                    .update({ logo_url: finalUrl })
                    .eq("id", userProfile.inquilino);
                if (tenantError) throw tenantError;

                const companyConfig = await getConfigSection(
                    userProfile.inquilino,
                    "empresa_datos",
                    {}
                );
                await saveConfigSection(userProfile.inquilino, "empresa_datos", {
                    ...(companyConfig || {}),
                    logoUrl: finalUrl
                });

                try {
                    const uid = userProfile?.id || userProfile?.uid;
                    if (uid) sessionStorage.removeItem(`oc_user_profile_${uid}`);
                } catch {
                    // sessionStorage puede no estar disponible en todos los entornos.
                }

                window.dispatchEvent(new CustomEvent("tenant-updated"));
            }

            toast.success("Logo actualizado correctamente.");
        } catch (error) {
            console.error("Error al procesar el logo:", error);
            toast.error(error.message || "Error al procesar la imagen");
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 font-semibold">Cargando datos básicos...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Header & Bar Acciones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiBriefcase size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Datos Básicos</h1>
                        <p className="text-[12px] text-slate-500">Información legal y contacto de la clínica</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-0 shrink-0"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FiSave size={15} />
                    )}
                    <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
            </div>

            <form onSubmit={handleSave} autoComplete="off" className="space-y-4">
                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                />

                {/* Logo & Identificación */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row items-center gap-6">
                    <div className="relative group cursor-pointer shrink-0" onClick={handleLogoClick}>
                        <div className="w-28 h-28 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden transition-colors group-hover:border-blue-500 relative">
                            {uploading ? (
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] text-blue-600 font-bold">Subiendo...</span>
                                </div>
                            ) : formData.logoUrl ? (
                                <img
                                    src={formData.logoUrl}
                                    alt="Logo"
                                    className="w-full h-full object-contain p-2"
                                    onError={() => setFormData(prev => ({ ...prev, logoUrl: "" }))}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-400">
                                    <FiImage size={24} />
                                    <span className="text-[10px] font-semibold">Subir logo</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
                            <FiUpload size={13} />
                        </div>
                    </div>

                    <div className="flex-1 w-full space-y-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Nombre Comercial *</label>
                            <input
                                type="text"
                                value={formData.nombreComercial}
                                onChange={e => setFormData({ ...formData, nombreComercial: e.target.value })}
                                placeholder="Ej. OdontoCloud Dental Spa"
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 font-semibold outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">NIT / Identificación *</label>
                                <input
                                    type="text"
                                    value={formData.nit}
                                    onChange={e => setFormData({ ...formData, nit: e.target.value })}
                                    placeholder="Ej. 900.123.456-7"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Razón Social</label>
                                <input
                                    type="text"
                                    value={formData.razonSocial}
                                    onChange={e => setFormData({ ...formData, razonSocial: e.target.value })}
                                    placeholder="Ej. Servicios Odontológicos SAS"
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contacto & Ubicación Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Tarjeta Contacto */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FiPhone size={15} />
                            </div>
                            <h3 className="text-[13px] font-bold text-slate-800">Información de Contacto</h3>
                        </div>

                        <div className="space-y-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Teléfono Fijo</label>
                                <input
                                    type="text"
                                    value={formData.telefono}
                                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Celular / WhatsApp</label>
                                <input
                                    type="text"
                                    value={formData.celular}
                                    onChange={e => setFormData({ ...formData, celular: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Correo Electrónico</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Sitio Web</label>
                                <input
                                    type="text"
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta Ubicación & Configuración Legal */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FiMapPin size={15} />
                            </div>
                            <h3 className="text-[13px] font-bold text-slate-800">Ubicación & Configuración</h3>
                        </div>

                        <div className="space-y-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Dirección Principal</label>
                                <input
                                    type="text"
                                    value={formData.direccion}
                                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Ciudad</label>
                                    <input
                                        type="text"
                                        value={formData.ciudad}
                                        onChange={e => setFormData({ ...formData, ciudad: e.target.value })}
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Régimen</label>
                                    <select
                                        value={formData.regimen}
                                        onChange={e => setFormData({ ...formData, regimen: e.target.value })}
                                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="Responsable de IVA">Responsable de IVA</option>
                                        <option value="No Responsable de IVA">No Responsable de IVA</option>
                                        <option value="Régimen Simple">Régimen Simple</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Moneda</label>
                                    <select
                                        value={formData.moneda}
                                        onChange={e => setFormData({ ...formData, moneda: e.target.value })}
                                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="COP">Pesos colombianos (COP)</option>
                                        <option value="USD">Dólares (USD)</option>
                                        <option value="EUR">Euros (EUR)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Zona Horaria</label>
                                    <select
                                        value={formData.zonaHoraria}
                                        onChange={e => setFormData({ ...formData, zonaHoraria: e.target.value })}
                                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="America/Bogota">Colombia (COT)</option>
                                        <option value="America/Mexico_City">México (CST)</option>
                                        <option value="America/New_York">EE.UU. (ET)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                {/* Tarjeta Prestador de Salud & SISPRO (Res. 0948 de 2026) */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiShield size={15} />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-800">Prestador de Salud & Perfil Tributario (RIPS Res. 0948)</h3>
                            <p className="text-[11px] text-slate-400">Configuración del responsable RIPS y obligación de facturación electrónica</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Columna Izquierda: Tipo de Prestador y Obligación */}
                        <div className="space-y-3.5">
                            {/* 1. Tipo de Prestador */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Tipo de Prestador *</label>
                                <select
                                    value={formData.providerType}
                                    onChange={e => {
                                        const pVal = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            providerType: pVal,
                                            esIps: pVal === PROVIDER_TYPES.IPS,
                                            billingObligation: pVal === PROVIDER_TYPES.IPS ? BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED : prev.billingObligation
                                        }));
                                    }}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-medium text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value={PROVIDER_TYPES.IPS}>IPS - Institución Prestadora de Salud</option>
                                    <option value={PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE}>Profesional Independiente</option>
                                    <option value={PROVIDER_TYPES.OTRO}>Otro tipo de entidad</option>
                                    <option value={PROVIDER_TYPES.UNCONFIRMED}>Sin confirmar</option>
                                </select>
                            </div>

                            {/* 2. Obligación de Facturación Electrónica */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Obligación de Facturación Electrónica *</label>
                                <select
                                    value={formData.billingObligation}
                                    onChange={e => setFormData(prev => ({ ...prev, billingObligation: e.target.value }))}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-medium text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value={BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED}>Obligado a facturar electrónicamente (FEV requerida)</option>
                                    <option value={BILLING_OBLIGATIONS.NOT_REQUIRED}>No obligado (E.T. Art. 616-2 / Habilita RIPS sin FEV)</option>
                                    <option value={BILLING_OBLIGATIONS.UNCONFIRMED}>Sin confirmar (Previsualización local)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                                    <FiInfo className="inline mr-1 text-blue-500" size={11} />
                                    {UVT_REFERENCE_NOTICE}
                                </p>
                            </div>

                            {/* Confirmación Administrativa si es No Obligado */}
                            {formData.providerType === PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE && formData.billingObligation === BILLING_OBLIGATIONS.NOT_REQUIRED && (
                                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.administrativeConfirmation}
                                            onChange={e => setFormData(prev => ({ ...prev, administrativeConfirmation: e.target.checked }))}
                                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-[11px] text-amber-900 font-medium leading-tight">
                                            Confirmo administrativamente que este profesional cumple los requisitos tributarios de la DIAN para no estar obligado a emitir factura electrónica.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Cuenta contable & Agendamiento */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Cuenta Contable</label>
                                    <input
                                        type="text"
                                        value={formData.cuentaContable}
                                        onChange={e => setFormData({ ...formData, cuentaContable: e.target.value })}
                                        placeholder="Buscar Item..."
                                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">Agendamiento Online</label>
                                    <input
                                        type="text"
                                        value={formData.agendamientoUrl}
                                        onChange={e => setFormData({ ...formData, agendamientoUrl: e.target.value })}
                                        placeholder="https://..."
                                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Código Prestador y SISPRO Institucional (Si es IPS) */}
                        <div className="space-y-3">
                            {formData.providerType === PROVIDER_TYPES.IPS ? (
                                <div className="space-y-3 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 animate-in fade-in duration-300">
                                    {/* Modalidad de Código Prestador */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700">Código de Prestador Institucional (REPS)</label>
                                        <div className="flex items-center gap-4 text-xs text-slate-700">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="providerCodeMode"
                                                    value={PROVIDER_CODE_MODES.UNIQUE}
                                                    checked={formData.providerCodeMode !== PROVIDER_CODE_MODES.BY_BRANCH}
                                                    onChange={() => setFormData({ ...formData, providerCodeMode: PROVIDER_CODE_MODES.UNIQUE })}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="font-semibold">Código Único</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="providerCodeMode"
                                                    value={PROVIDER_CODE_MODES.BY_BRANCH}
                                                    checked={formData.providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH}
                                                    onChange={() => setFormData({ ...formData, providerCodeMode: PROVIDER_CODE_MODES.BY_BRANCH })}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="font-semibold">Configurar por Sede</span>
                                            </label>
                                        </div>
                                    </div>

                                    {formData.providerCodeMode === PROVIDER_CODE_MODES.UNIQUE ? (
                                        <div className="space-y-1">
                                            <input
                                                type="text"
                                                value={formData.codigoPrestador}
                                                onChange={e => setFormData({ ...formData, codigoPrestador: e.target.value })}
                                                placeholder="Ej. 700010165701 (10 o 12 dígitos)"
                                                className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {(sucursalesList.length > 0 ? sucursalesList : [{ id: "sede_principal", nombre: "Sede Principal" }]).map(suc => (
                                                <div key={suc.id} className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-slate-600 w-32 truncate" title={suc.nombre}>{suc.nombre}</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Código REPS sede"
                                                        value={formData.providerCodesByBranch?.[suc.id] || ""}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                providerCodesByBranch: {
                                                                    ...(prev.providerCodesByBranch || {}),
                                                                    [suc.id]: val
                                                                }
                                                            }));
                                                        }}
                                                        className="flex-1 h-7 px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* SISPRO Institucional */}
                                    <div className="pt-2 border-t border-blue-100/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-slate-700">Integración SISPRO Institucional</label>
                                            {sisproHasPassword ? (
                                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                                    <FiCheckCircle size={10} /> Configurada
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    No configurada
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={formData.sisproUsuario}
                                                onChange={e => setFormData({ ...formData, sisproUsuario: e.target.value })}
                                                placeholder="Usuario SISPRO"
                                                className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                            />
                                            <select
                                                value={formData.sisproTipoDoc}
                                                onChange={e => setFormData({ ...formData, sisproTipoDoc: e.target.value })}
                                                className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none focus:border-blue-500"
                                            >
                                                <option value="NIT">NIT</option>
                                                <option value="CC">Cédula (CC)</option>
                                                <option value="CE">Cédula Ext. (CE)</option>
                                            </select>
                                        </div>
                                        <input
                                            type="password"
                                            value={formData.sisproPassword}
                                            onChange={e => setFormData({ ...formData, sisproPassword: e.target.value })}
                                            placeholder={sisproHasPassword ? "•••••••• (Contraseña guardada - cambiar solo si desea actualizar)" : "Contraseña SISPRO"}
                                            autoComplete="new-password"
                                            className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center space-y-2">
                                    <FiInfo className="mx-auto text-blue-500" size={20} />
                                    <p className="text-[11px] text-slate-600 font-medium">
                                        En modalidad <strong>Profesional Independiente</strong>, los códigos de habilitación prestador y credenciales SISPRO se configuran directamente en el perfil de cada Doctor autorizado (Configuración → Usuarios).
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </form>
        </div>
    );
}
