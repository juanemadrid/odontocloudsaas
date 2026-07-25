// src/modules/config/ConfigEmpresa.jsx
// ============================================================
// ⚙️ Datos Básicos de Empresa - OdontoCloud
// Diseño compacto, limpio y estructurado sin desperdicio de espacio.
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { FiSave, FiUpload, FiImage, FiMapPin, FiPhone, FiMail, FiBriefcase, FiFileText } from "react-icons/fi";
import { uploadImage } from "../../services/FirebaseStorageService";

export default function ConfigEmpresa() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

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
            const docRef = doc(db, "tenants", userProfile.inquilino);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setFormData(prev => ({
                    ...prev,
                    nit: data.nit || "",
                    razonSocial: data.razonSocial || "",
                    nombreComercial: data.name || data.nombreComercial || "",
                    direccion: data.address || data.direccion || "",
                    telefono: data.phone || data.telefono || "",
                    celular: data.celular || "",
                    email: data.email || "",
                    website: data.website || "",
                    agendamientoUrl: data.agendamientoUrl || "",
                    regimen: data.regimen || "Responsable de IVA",
                    moneda: data.moneda || "COP",
                    zonaHoraria: data.zonaHoraria || "America/Bogota",
                    cuentaContable: data.cuentaContable || "",
                    esIps: data.esIps || false,
                    sisproUsuario: data.sisproUsuario || "",
                    sisproTipoDoc: data.sisproTipoDoc || "CC",
                    sisproPassword: data.sisproPassword || "",
                    codigoPrestador: data.codigoPrestador || "",
                    logoUrl: data.logo || "",
                    ciudad: data.ciudad || "",
                    codigoPostal: data.codigoPostal || ""
                }));
            }
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
            const docRef = doc(db, "tenants", userProfile.inquilino);
            await setDoc(docRef, {
                ...formData,
                name: formData.nombreComercial,
                address: formData.direccion,
                phone: formData.telefono,
                logo: formData.logoUrl,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.uid
            }, { merge: true });

            toast.success("Información guardada correctamente");
        } catch (error) {
            console.error("Error guardando empresa:", error);
            toast.error("Error al guardar cambios");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error("Seleccione una imagen (JPG, PNG o WEBP)");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("La imagen es demasiado grande (máx 2MB)");
            return;
        }

        setUploading(true);
        try {
            const logoPath = `tenants/${userProfile.inquilino}/logo_${Date.now()}`;
            const downloadUrl = await uploadImage(file, logoPath);
            setFormData(prev => ({ ...prev, logoUrl: downloadUrl }));
            toast.success("Logo cargado temporalmente. Guarde cambios para confirmar.");
        } catch (error) {
            toast.error(error.message);
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

            <form onSubmit={handleSave} className="space-y-4">
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
                                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
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

                {/* Tarjeta SISPRO & Adicional */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiFileText size={15} />
                        </div>
                        <h3 className="text-[13px] font-bold text-slate-800">Configuración Adicional & SISPRO</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Agendamiento Online</label>
                                <input
                                    type="text"
                                    value={formData.agendamientoUrl}
                                    onChange={e => setFormData({ ...formData, agendamientoUrl: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Cuenta Contable</label>
                                <input
                                    type="text"
                                    value={formData.cuentaContable}
                                    onChange={e => setFormData({ ...formData, cuentaContable: e.target.value })}
                                    placeholder="Buscar Item..."
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                                <span className="text-[12px] font-semibold text-slate-700">¿Es una institución prestadora de salud (IPS)?</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.esIps}
                                        onChange={(e) => setFormData(prev => ({ ...prev, esIps: e.target.checked }))}
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Campos SISPRO (Condicionales si es IPS) */}
                        {formData.esIps ? (
                            <div className="space-y-2.5 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 animate-in fade-in duration-300">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600">Usuario SISPRO ⓘ</label>
                                        <input
                                            type="text"
                                            value={formData.sisproUsuario}
                                            onChange={e => setFormData({ ...formData, sisproUsuario: e.target.value })}
                                            placeholder="Número de documento"
                                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600">Tipo Doc. SISPRO</label>
                                        <select
                                            value={formData.sisproTipoDoc}
                                            onChange={e => setFormData({ ...formData, sisproTipoDoc: e.target.value })}
                                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="CC">Cédula de Ciudadanía</option>
                                            <option value="NIT">NIT</option>
                                            <option value="CE">Cédula de Extranjería</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600">Contraseña SISPRO ⓘ</label>
                                        <input
                                            type="password"
                                            value={formData.sisproPassword}
                                            onChange={e => setFormData({ ...formData, sisproPassword: e.target.value })}
                                            placeholder="**********"
                                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600">Código de Prestador ⓘ</label>
                                        <input
                                            type="text"
                                            value={formData.codigoPrestador}
                                            onChange={e => setFormData({ ...formData, codigoPrestador: e.target.value })}
                                            placeholder="Ej. 7000101657"
                                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
                                <span className="text-[11px] text-slate-400 font-medium">
                                    Active el conmutador IPS para habilitar los campos de integración SISPRO.
                                </span>
                            </div>
                        )}
                    </div>
                </div>

            </form>
        </div>
    );
}
