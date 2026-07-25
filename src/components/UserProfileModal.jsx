import React, { useState, useRef, useEffect } from "react";
import { FiX, FiCheck, FiUpload, FiTrash2, FiUser, FiPenTool, FiLock, FiShield, FiSave } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseConfig";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

const FingerprintIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
        <path d="M14 13.12c0 2.38 0 3.88-.26 4.88" />
        <path d="M18 11a6 6 0 0 0-11.95-1" />
        <path d="M2 12a10 10 0 0 1 18-6" />
        <path d="M22 12a10 10 0 0 1-20 0" />
        <path d="M6 12a6 6 0 0 1 11.26-2.92" />
        <path d="M16 16c0 1.5-.26 3-.76 4.5" />
    </svg>
);

export default function UserProfileModal({ isOpen, onClose }) {
    const { user, userProfile, setUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const [nombre, setNombre] = useState(userProfile?.nombre || "");
    const [apellido, setApellido] = useState(userProfile?.apellido || "");
    const [telefono, setTelefono] = useState(userProfile?.telefono || userProfile?.telefonoMovil || "");
    const [registroMedico, setRegistroMedico] = useState(userProfile?.registroMedico || userProfile?.tarjetaProfesional || "");
    const [fotoPerfil, setFotoPerfil] = useState(userProfile?.fotoPerfil || userProfile?.photoURL || "");
    const [firmaElectronica, setFirmaElectronica] = useState(userProfile?.firmaElectronica || userProfile?.firma || "");
    const [huellaDigital, setHuellaDigital] = useState(userProfile?.huellaDigital || "");

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const fileInputRef = useRef(null);
    const photoInputRef = useRef(null);

    // Initialize Canvas with existing signature if present
    useEffect(() => {
        if (!isOpen) return;
        setNombre(userProfile?.nombre || "");
        setApellido(userProfile?.apellido || "");
        setTelefono(userProfile?.telefono || userProfile?.telefonoMovil || "");
        setRegistroMedico(userProfile?.registroMedico || userProfile?.tarjetaProfesional || "");
        setFotoPerfil(userProfile?.fotoPerfil || userProfile?.photoURL || "");
        setFirmaElectronica(userProfile?.firmaElectronica || userProfile?.firma || "");
        setHuellaDigital(userProfile?.huellaDigital || "");

        setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (userProfile?.firmaElectronica || userProfile?.firma) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    };
                    img.src = userProfile.firmaElectronica || userProfile.firma;
                }
            }
        }, 100);
    }, [isOpen, userProfile]);

    if (!isOpen) return null;

    // Drawing handlers
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
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (canvasRef.current) {
                setFirmaElectronica(canvasRef.current.toDataURL("image/png"));
            }
        }
    };

    const handleClearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setFirmaElectronica("");
    };

    const handleImportSignature = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const imgData = evt.target.result;
            setFirmaElectronica(imgData);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = imgData;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImportPhoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            setFotoPerfil(evt.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSimulateFingerprint = () => {
        // Fingerprint SVG mock representation
        const FINGERPRINT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563eb" width="100" height="100"><path d="M12,2A10,10,0,0,0,2,12a9.88,9.88,0,0,0,2.15,6.13.5.5,0,0,0,.79-.62A8.9,8.9,0,0,1,3,12,9,9,0,0,1,12,3a9.05,9.05,0,0,1,6.33,2.67.5.5,0,0,0,.7.71A10,10,0,0,0,12,2ZM6,12a6,6,0,0,1,6-6,6.07,6.07,0,0,1,4.24,1.76.5.5,0,1,0,.7-.7A7,7,0,0,0,12,5a7,7,0,0,0-7,7,7.1,7.1,0,0,0,.54,2.71.5.5,0,1,0,.92-.38A6,6,0,0,1,6,12Zm9.26,2.22a.5.5,0,0,0-.71.7A3.91,3.91,0,0,1,12,16a4,4,0,0,1-4-4,4,4,0,0,1,1.17-2.83.5.5,0,0,0-.7-.71A5,5,0,0,0,7,12a5,5,0,0,0,5,5,4.92,4.92,0,0,0,3.54-1.46A.5.5,0,0,0,15.26,14.22ZM12,8a4,4,0,0,0-4,4,4.07,4.07,0,0,0,.56,2.06.5.5,0,1,0,.88-.47A3,3,0,0,1,9,12a3,3,0,0,1,3-3,3,3,0,0,1,2.12.88.5.5,0,1,0,.71-.7A4,4,0,0,0,12,8Zm0,10a6,6,0,0,0,4.24-1.76.5.5,0,1,0-.7-.7A5,5,0,0,1,12,17a5,5,0,0,1-3.54-1.46.5.5,0,1,0-.7.7A6,6,0,0,0,12,18Zm5.74-8.83a.5.5,0,0,0-.71.7A8,8,0,0,1,12,21a7.92,7.92,0,0,1-5.66-2.34.5.5,0,0,0-.7.71A9,9,0,0,0,12,22,9,9,0,0,0,19.27,14,9.09,9.09,0,0,0,17.74,9.17Z"/></svg>`;
        setHuellaDigital(FINGERPRINT_SVG);
        toast.success("Huella digital capturada correctamente.");
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const currentSignature = firmaElectronica || "";
            const fullName = `${nombre} ${apellido}`.trim();

            const updatePayload = {
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                nombreCompleto: fullName || userProfile?.displayName || userProfile?.email,
                displayName: fullName || userProfile?.displayName,
                telefono: telefono.trim(),
                registroMedico: registroMedico.trim(),
                tarjetaProfesional: registroMedico.trim(),
                fotoPerfil: fotoPerfil || "",
                firmaElectronica: currentSignature,
                firma: currentSignature,
                huellaDigital: huellaDigital || "",
                updatedAt: new Date().toISOString()
            };

            const userId = userProfile?.uid || user?.uid;
            if (userId) {
                const userDocRef = doc(db, "usuarios", userId);
                await updateDoc(userDocRef, updatePayload).catch(async () => {
                    // Fallback to setDoc with merge
                    const { setDoc } = await import("firebase/firestore");
                    await setDoc(userDocRef, updatePayload, { merge: true });
                });
            }

            // Sync local Auth state
            if (typeof setUserProfile === "function") {
                setUserProfile(prev => ({
                    ...prev,
                    ...updatePayload
                }));
            }

            toast.success("Perfil de usuario guardado con éxito.");
            onClose();
        } catch (error) {
            console.error("Error al guardar perfil de usuario:", error);
            toast.error("Error al guardar perfil. Intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header Modal */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-lg">
                            <FiUser size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-wider">Perfil de usuario</h2>
                            <p className="text-[10px] text-blue-100 font-medium">Configuración de identidad, firma electrónica y credenciales</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Section 1: User Photo / Logo */}
                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest block mb-3">
                            Carga un logo / Foto de perfil
                        </label>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0 relative group">
                                {fotoPerfil ? (
                                    <img src={fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                                ) : (
                                    <FiUser size={32} className="text-slate-300" />
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <FiUpload size={13} /> Cargar foto
                                </button>
                                {fotoPerfil && (
                                    <button
                                        type="button"
                                        onClick={() => setFotoPerfil("")}
                                        className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all border border-rose-200/60"
                                    >
                                        <FiTrash2 size={13} /> Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Personal & Professional Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Nombre del usuario"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Apellido
                            </label>
                            <input
                                type="text"
                                value={apellido}
                                onChange={(e) => setApellido(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Apellido del usuario"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Teléfono Movil
                            </label>
                            <input
                                type="text"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Teléfono de contacto"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Registro Médico / TP
                            </label>
                            <input
                                type="text"
                                value={registroMedico}
                                onChange={(e) => setRegistroMedico(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500"
                                placeholder="Nro de Registro Profesional"
                            />
                        </div>
                    </div>

                    {/* Section 3: Firma Electrónica (Drawing Canvas + Import) */}
                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <FiPenTool className="text-blue-600" /> Firma electrónica
                            </label>
                            <span className="text-[10px] font-bold text-slate-400">
                                Dibuje sobre el recuadro o importe una imagen
                            </span>
                        </div>

                        <div className="relative bg-white rounded-2xl border-2 border-slate-200 shadow-inner overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                width={550}
                                height={180}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-[180px] cursor-crosshair touch-none bg-white"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleClearSignature}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all border border-rose-200/60"
                                >
                                    <FiTrash2 size={13} /> Borrar firma
                                </button>

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
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all border border-slate-200"
                                >
                                    <FiUpload size={13} /> Importar firma
                                </button>
                            </div>

                            {firmaElectronica && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
                                    <FiCheck size={12} /> Firma Registrada
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Section 4: Huella Digital */}
                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100 space-y-3">
                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                            <FingerprintIcon className="text-blue-600" /> Huella digital
                        </label>

                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                {huellaDigital ? (
                                    <img src={huellaDigital} alt="Huella" className="w-16 h-16 object-contain" />
                                ) : (
                                    <FingerprintIcon size={40} className="text-slate-200" />
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={handleSimulateFingerprint}
                                    className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <FingerprintIcon size={14} /> Agregar huella
                                </button>
                                {huellaDigital && (
                                    <button
                                        type="button"
                                        onClick={() => setHuellaDigital("")}
                                        className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all border border-rose-200/60"
                                    >
                                        <FiTrash2 size={13} /> Borrar huella
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-[11px] uppercase tracking-wider transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-lime-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <FiSave size={14} /> {loading ? "Guardando..." : "Guardar"}
                    </button>
                </div>

            </div>
        </div>
    );
}
