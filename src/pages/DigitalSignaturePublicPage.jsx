// src/pages/DigitalSignaturePublicPage.jsx
import React, { useState, useEffect, useRef } from "react";
import supabase from "../lib/supabaseClient";
import { FiCheckCircle, FiDownload, FiPrinter, FiEdit3, FiShield, FiAlertCircle, FiLock } from "react-icons/fi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function DigitalSignaturePublicPage() {
    // Estado del flujo seguro de verificación
    const [rawToken, setRawToken] = useState(null);
    const [last4Input, setLast4Input] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [authVerified, setAuthVerified] = useState(false);
    const [remainingAttempts, setRemainingAttempts] = useState(null);
    const [authError, setAuthError] = useState(null);

    // Datos protegidos devueltos por verify_signature_token
    const [patientFirstName, setPatientFirstName] = useState("");
    const [documentSnapshot, setDocumentSnapshot] = useState(null);
    const [documentHash, setDocumentHash] = useState(null);

    // Estados de firma y render
    const [signing, setSigning] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [tokenBlocked, setTokenBlocked] = useState(false);
    const [tokenExpired, setTokenExpired] = useState(false);

    // Canvas de firma táctil / mouse
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const documentRef = useRef(null);

    // 1. Extraer el token exclusivamente desde el fragmento (#token=...)
    useEffect(() => {
        const hash = window.location.hash || "";
        const match = hash.match(/token=([a-fA-F0-9]+)/);
        if (match && match[1]) {
            setRawToken(match[1]);
        }
    }, []);

    // Configurar Canvas cuando se desbloquee la vista de firma
    useEffect(() => {
        if (!canvasRef.current || signatureSaved || !authVerified) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, [authVerified, signatureSaved]);

    // 2. Verificar identidad del paciente (4 últimos dígitos) contra el token
    const handleVerifyAccess = async (e) => {
        if (e) e.preventDefault();
        setAuthError(null);
        const cleanLast4 = last4Input.replace(/\D/g, "");
        if (cleanLast4.length !== 4) {
            setAuthError("Debe ingresar exactamente los 4 últimos dígitos de su documento.");
            return;
        }

        setVerifying(true);
        try {
            const { data, error } = await supabase.rpc("verify_signature_token", {
                p_raw_token: rawToken,
                p_last4: cleanLast4
            });

            if (error) {
                setAuthError("Error de comunicación con el servidor. Intente más tarde.");
                return;
            }

            if (!data?.success) {
                if (data?.error === "TOKEN_BLOCKED") {
                    setTokenBlocked(true);
                } else if (data?.error === "TOKEN_EXPIRED_OR_REVOKED") {
                    setTokenExpired(true);
                } else if (data?.error === "ALREADY_SIGNED") {
                    setSignatureSaved(true);
                    setSavedAt(data?.signed_at);
                } else if (data?.error === "AUTH_FAILED") {
                    setRemainingAttempts(data?.remaining_attempts);
                    setAuthError(`Los 4 dígitos no coinciden. Intentos restantes: ${data?.remaining_attempts ?? 0}`);
                } else {
                    setAuthError("El enlace no es válido o no se encontró la solicitud.");
                }
                return;
            }

            // Acceso legítimo: guardar snapshot y habilitar firma
            setPatientFirstName(data.patient_first_name || "Paciente");
            setDocumentSnapshot(data.document_snapshot);
            setDocumentHash(data.document_hash);
            setAuthVerified(true);
        } catch (err) {
            console.error("Error verificando token:", err);
            setAuthError("Ocurrió un error al verificar su documento.");
        } finally {
            setVerifying(false);
        }
    };

    // Funciones del Canvas
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (!canvasRef.current) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing || !canvasRef.current) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleClearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    // 3. Enviar firma certificada vía submit_digital_signature
    const handleSaveSignature = async () => {
        if (!hasDrawn || !canvasRef.current) {
            alert("Por favor ingrese su firma manuscrita en el recuadro antes de guardar.");
            return;
        }

        const cleanLast4 = last4Input.replace(/\D/g, "");
        setSigning(true);
        try {
            const canvas = canvasRef.current;
            const patientSignature = canvas.toDataURL("image/png");

            const { data, error } = await supabase.rpc("submit_digital_signature", {
                p_raw_token: rawToken,
                p_last4: cleanLast4,
                p_signature_base64: patientSignature
            });

            if (error) {
                alert("Error al registrar la firma digital. Intente nuevamente.");
                return;
            }

            if (!data?.success) {
                alert("No se pudo completar la firma: " + (data?.error || "Error no especificado"));
                return;
            }

            setSignatureSaved(true);
            setSavedAt(data?.signed_at);
            alert("✅ ¡Firma registrada exitosamente! Su documento clínico ha sido certificado.");
        } catch (err) {
            console.error("Error guardando firma digital:", err);
            alert("Ocurrió un error al registrar la firma. Intente nuevamente.");
        } finally {
            setSigning(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!documentRef.current) return;
        try {
            const canvas = await html2canvas(documentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Certificado_Evolucion_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Error al descargar PDF:", error);
            window.print();
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Pantalla si no hay token en el enlace
    if (!rawToken) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md text-center space-y-4">
                    <FiAlertCircle size={40} className="text-rose-500 mx-auto" />
                    <h3 className="text-base font-black text-slate-800">Enlace Incompleto o Inválido</h3>
                    <p className="text-xs text-slate-500 font-medium">No se detectó un identificador de firma válido en la dirección web.</p>
                </div>
            </div>
        );
    }

    // Pantalla si el token fue bloqueado por superar los 5 intentos
    if (tokenBlocked) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md text-center space-y-4">
                    <FiLock size={40} className="text-rose-600 mx-auto" />
                    <h3 className="text-base font-black text-slate-800">Enlace Bloqueado por Seguridad</h3>
                    <p className="text-xs text-slate-600 font-medium">
                        Se superó el número máximo de intentos permitidos (5). Comuníquese con la clínica odontológica para solicitar un nuevo enlace de firma.
                    </p>
                </div>
            </div>
        );
    }

    // Pantalla si el token expiró (más de 24 horas) o fue revocado
    if (tokenExpired) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md text-center space-y-4">
                    <FiAlertCircle size={40} className="text-amber-500 mx-auto" />
                    <h3 className="text-base font-black text-slate-800">Enlace Expirado o Reemplazado</h3>
                    <p className="text-xs text-slate-600 font-medium">
                        Este enlace de firma ha caducado o fue sustituido por una nueva solicitud. Por favor contacte a su clínica para renovarlo.
                    </p>
                </div>
            </div>
        );
    }

    // Pantalla si ya fue firmado previamente
    if (signatureSaved) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-emerald-100 max-w-md text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                        <FiCheckCircle size={28} />
                    </div>
                    <h3 className="text-base font-black text-slate-800">Documento Ya Firmado y Certificado</h3>
                    <p className="text-xs text-slate-600 font-medium">
                        Esta atención odontológica ya cuenta con firma digital registrada{savedAt ? ` el ${new Date(savedAt).toLocaleString("es-CO")}` : ""}.
                    </p>
                    <p className="text-[11px] text-slate-400">Por privacidad y seguridad médica, el documento ya no puede modificarse ni reabrirse para firma remota.</p>
                </div>
            </div>
        );
    }

    // Pantalla de Validación de Identidad (Antes de mostrar datos clínicos)
    if (!authVerified) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                            <FiShield size={24} />
                        </div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Verificación de Identidad</h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Para proteger su privacidad y visualizar su evolución clínica, ingrese los <strong>últimos 4 dígitos</strong> de su documento de identidad.
                        </p>
                    </div>

                    <form onSubmit={handleVerifyAccess} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-600 tracking-wider mb-1">
                                Últimos 4 dígitos del documento
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                value={last4Input}
                                onChange={(e) => setLast4Input(e.target.value.replace(/\D/g, ""))}
                                placeholder="Ej: 5678"
                                className="w-full px-4 py-3 text-center text-lg tracking-widest font-black rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                autoFocus
                            />
                        </div>

                        {authError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <FiAlertCircle size={16} className="shrink-0" />
                                <span>{authError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={verifying || last4Input.length !== 4}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md active:scale-95"
                        >
                            {verifying ? "Verificando..." : "Acceder al Documento"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Vista Principal: Documento Clínico Verificado listo para firmar
    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Banner de Bienvenida y Estado */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <FiEdit3 size={22} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                Hola, {patientFirstName}
                            </h2>
                            <p className="text-[11px] text-slate-500 font-semibold">
                                Revise los detalles de su atención odontológica y registre su firma al final.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownloadPDF}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                            <FiDownload size={14} />
                            PDF
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <FiPrinter size={14} />
                            Imprimir
                        </button>
                    </div>
                </div>

                {/* Hoja Clínico del Snapshot Firmado */}
                <div ref={documentRef} className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6">
                    
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <div>
                            <h1 className="text-sm font-black uppercase text-slate-800 leading-tight">
                                Certificación de Atención Odontológica
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                OdontoCloud · Historia Clínica Digital
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md border border-indigo-100 uppercase tracking-widest">
                                Evolución
                            </span>
                        </div>
                    </div>

                    {/* Detalle del Snapshot Clínico Sellado */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Fecha de Atención</span>
                                <span className="font-bold text-slate-700">
                                    {documentSnapshot?.fecha ? new Date(documentSnapshot.fecha).toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' }) : "Fecha no especificada"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Profesional Tratante</span>
                                <span className="font-bold text-slate-700">{documentSnapshot?.doctor_name || "Profesional Asignado"}</span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="block text-[10px] font-black uppercase text-slate-400">Procedimiento Clínico</span>
                                <span className="font-bold text-slate-800">{documentSnapshot?.procedure || "Atención Odontológica"}</span>
                            </div>
                        </div>

                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Descripción / Observaciones Clínicas</span>
                            <div className="text-xs text-slate-700 leading-relaxed font-semibold bg-white p-4 rounded-xl border border-slate-200">
                                {documentSnapshot?.description || "Sin observaciones adicionales."}
                            </div>
                        </div>

                        {documentHash && (
                            <div className="text-[9px] text-slate-400 font-mono break-all bg-slate-50 p-2 rounded border border-slate-100">
                                Sello Criptográfico SHA-256: {documentHash}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recuadro de Captura de Firma */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-4">
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Firma Digital del Paciente</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Dibuje su firma con el dedo o puntero para certificar la atención recibida.
                        </p>
                    </div>

                    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white relative h-48 sm:h-56 touch-none shadow-inner">
                        <canvas
                            ref={canvasRef}
                            width={700}
                            height={220}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-full cursor-crosshair"
                        />
                        {!hasDrawn && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <p className="text-xs font-semibold text-slate-300 tracking-wider">Dibuje su firma manuscrita aquí</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClearCanvas}
                            className="px-6 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-rose-200 cursor-pointer"
                        >
                            Borrar
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveSignature}
                            disabled={signing || !hasDrawn}
                            className="px-8 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            {signing ? "Certificando..." : "Certificar y Firmar"}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
