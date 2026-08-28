import React, { useState, useRef, useEffect } from "react";
import { FiX, FiUpload, FiTrash2, FiUser, FiPenTool, FiSave, FiPhone, FiCreditCard } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";
import { toast } from "sonner";

export default function UserProfileModal({ isOpen, onClose }) {
    const { user, userProfile, setUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const [nombre, setNombre] = useState(userProfile?.nombre || "");
    const [apellido, setApellido] = useState(userProfile?.apellido || "");
    const [telefono, setTelefono] = useState(userProfile?.telefono || userProfile?.telefonoMovil || "");
    const [registroMedico, setRegistroMedico] = useState(userProfile?.registroMedico || userProfile?.tarjetaProfesional || "");
    const [fotoPerfil, setFotoPerfil] = useState(userProfile?.fotoPerfil || userProfile?.photoURL || "");
    const [firmaElectronica, setFirmaElectronica] = useState(userProfile?.firmaElectronica || userProfile?.firma || "");

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const fileInputRef = useRef(null);
    const photoInputRef = useRef(null);

    // Initialize form with existing user data
    useEffect(() => {
        if (!isOpen) return;

        const initForm = async () => {
            const userId = userProfile?.uid || userProfile?.id || user?.uid || user?.id;
            const inquilino = userProfile?.inquilino || userProfile?.tenantId;

            let loadedFirma = userProfile?.firmaElectronica || userProfile?.firma || "";
            let loadedReg = userProfile?.registroMedico || userProfile?.tarjetaProfesional || "";
            let loadedNom = userProfile?.nombre || "";
            let loadedApe = userProfile?.apellido || "";
            let loadedTel = userProfile?.telefono || userProfile?.telefonoMovil || "";
            let loadedFoto = userProfile?.fotoPerfil || userProfile?.photoURL || "";

            if (!loadedNom && userProfile?.full_name) {
                const parts = userProfile.full_name.split(" ");
                loadedNom = parts[0] || "";
                loadedApe = parts.slice(1).join(" ") || "";
            }

            // Consulta de respaldo
            if (userId && inquilino) {
                try {
                    const { data: detail } = await supabase.rpc("get_my_tenant_doctor_record", {
                        p_identifier: userId
                    });
                    if (detail?.firma || detail?.firmaElectronica) loadedFirma = detail.firma || detail.firmaElectronica;
                    if (detail?.registroMedico || detail?.tarjetaProfesional) loadedReg = detail.registroMedico || detail.tarjetaProfesional;
                    if (detail?.nombre) loadedNom = detail.nombre;
                    if (detail?.apellido) loadedApe = detail.apellido;
                    if (detail?.telefonoMovil || detail?.telefono) loadedTel = detail.telefonoMovil || detail.telefono;
                    if (detail?.fotoPerfil) loadedFoto = detail.fotoPerfil;
                } catch (e) {}
            }

            setNombre(loadedNom);
            setApellido(loadedApe);
            setTelefono(loadedTel);
            setRegistroMedico(loadedReg);
            setFotoPerfil(loadedFoto);
            setFirmaElectronica(loadedFirma);

            setTimeout(() => {
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (loadedFirma) {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.src = loadedFirma;
                    }
                }
            }, 80);
        };

        initForm();
    }, [isOpen, userProfile, user]);

    if (!isOpen) return null;

    // Canvas drawing handlers
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            setFirmaElectronica(canvas.toDataURL("image/png"));
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFirmaElectronica("");
    };

    const handleImportPhoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setFotoPerfil(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleImportSignature = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            setFirmaElectronica(dataUrl);

            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = dataUrl;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const userId = userProfile?.uid || userProfile?.id || user?.uid || user?.id;
            const inquilino = userProfile?.inquilino || userProfile?.tenantId;
            const fullName = [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");

            let currentSignature = firmaElectronica;
            const canvas = canvasRef.current;
            if (canvas && isDrawing) {
                currentSignature = canvas.toDataURL("image/png");
            }

            const updatePayload = {
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                full_name: fullName,
                nombre_completo: fullName,
                telefono: telefono.trim(),
                telefonoMovil: telefono.trim(),
                registroMedico: registroMedico.trim(),
                tarjetaProfesional: registroMedico.trim(),
                registro_medico: registroMedico.trim(),
                fotoPerfil: fotoPerfil,
                photoURL: fotoPerfil,
                firma: currentSignature,
                firmaElectronica: currentSignature,
                firma_url: currentSignature,
                updated_at: new Date().toISOString()
            };

            if (userId) {
                try {
                    await supabase.from("profiles").update({
                        full_name: fullName,
                        telefono: telefono.trim(),
                        registro_medico: registroMedico.trim(),
                        apellido: apellido.trim()
                    }).eq("id", userId);
                } catch (e) {}

                if (inquilino) {
                    try {
                        const { error: detailError } = await supabase.rpc("update_my_user_detail", {
                            p_patch: updatePayload
                        });
                        if (detailError) throw detailError;
                    } catch (e) {}
                }
            }

            if (typeof setUserProfile === "function") {
                setUserProfile(prev => ({ ...prev, ...updatePayload }));
            }

            toast.success("Perfil actualizado con éxito");
            onClose();
        } catch (err) {
            console.error("Error al guardar perfil:", err);
            toast.error("Error al guardar perfil.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-scaleIn flex flex-col">
                
                {/* Header Compacto y Moderno */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                            <FiUser size={15} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wide">Perfil de usuario</h2>
                            <p className="text-[10px] text-blue-100">Identidad, firma digital y registro profesional</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
                    >
                        <FiX size={17} />
                    </button>
                </div>

                {/* Form Body Compacto */}
                <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
                    
                    {/* Foto + Datos Básicos Grid */}
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                            {fotoPerfil ? (
                                <img src={fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                            ) : (
                                <FiUser size={22} className="text-slate-300" />
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                ref={photoInputRef}
                                onChange={handleImportPhoto}
                                accept="image/*"
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1.5 transition-all shadow-xs"
                            >
                                <FiUpload size={12} /> Cargar foto
                            </button>
                            {fotoPerfil && (
                                <button
                                    type="button"
                                    onClick={() => setFotoPerfil("")}
                                    className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-all border border-rose-200/60"
                                >
                                    <FiTrash2 size={12} /> Quitar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Campos en Grid de 2 Columnas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                required
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Nombre"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Apellido
                            </label>
                            <input
                                type="text"
                                required
                                value={apellido}
                                onChange={(e) => setApellido(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Apellido"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Teléfono Móvil
                            </label>
                            <input
                                type="text"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="312 000 0000"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Registro Médico / TP
                            </label>
                            <input
                                type="text"
                                value={registroMedico}
                                onChange={(e) => setRegistroMedico(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Nro de Registro"
                            />
                        </div>
                    </div>

                    {/* Firma Electrónica Compacta */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <FiPenTool className="text-blue-600" size={12} /> Firma electrónica
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImportSignature}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                                >
                                    Importar imagen
                                </button>
                                <button
                                    type="button"
                                    onClick={clearCanvas}
                                    className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>

                        <div className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                width={460}
                                height={110}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-[110px] cursor-crosshair bg-white"
                            />
                        </div>
                    </div>

                    {/* Footer con botones */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <FiSave size={13} />
                            {loading ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
