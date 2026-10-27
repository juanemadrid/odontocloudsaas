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

    // Datos corporativos y clínicos
    const [clinicInfo, setClinicInfo] = useState({
        name: "OdontoCloud",
        logo: "",
        nit: "",
        address: "",
        phone: ""
    });
    const [patientInfo, setPatientInfo] = useState(null);
    const [doctorInfo, setDoctorInfo] = useState(null);
    const [patientFirstName, setPatientFirstName] = useState("");
    const [documentSnapshot, setDocumentSnapshot] = useState(null);
    const [documentHash, setDocumentHash] = useState(null);

    // Estados de firma y render
    const [signing, setSigning] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [savedSignatureData, setSavedSignatureData] = useState(null);
    const [tokenBlocked, setTokenBlocked] = useState(false);
    const [tokenExpired, setTokenExpired] = useState(false);

    // Canvas de firma táctil / mouse
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const documentRef = useRef(null);

    // Extraer el token desde hash (#token=...), query (?token=...) o URL completa
    const extractToken = () => {
        try {
            const hash = window.location.hash || "";
            const search = window.location.search || "";
            const href = window.location.href || "";
            const match = hash.match(/token=([a-fA-F0-9]{32,64})/i) ||
                          search.match(/token=([a-fA-F0-9]{32,64})/i) ||
                          href.match(/token=([a-fA-F0-9]{32,64})/i);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    };

    // 1. Extraer el token al montar y precargar la identidad de la clínica
    useEffect(() => {
        const found = extractToken();
        if (found) {
            setRawToken(found);
            // Precargar el logotipo y nombre de la clínica para dar confianza al paciente
            supabase.rpc("get_signature_clinic_info", { p_raw_token: found })
                .then(({ data }) => {
                    if (data?.success) {
                        setClinicInfo({
                            name: data.clinic_name || "OdontoCloud",
                            logo: data.logo_url || "",
                            nit: data.nit || "",
                            address: data.direccion || "",
                            phone: data.telefono || ""
                        });
                    }
                })
                .catch(err => console.warn("Aviso cargando info de la clínica:", err));
        }
    }, []);

    // Configurar Canvas cuando se desbloquee la vista de firma
    useEffect(() => {
        if (!canvasRef.current || signatureSaved || !authVerified) return;
        const canvas = canvasRef.current;
        const setupCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = Math.round(rect.width * dpr);
                canvas.height = Math.round(rect.height * dpr);
                const ctx = canvas.getContext("2d");
                ctx.scale(dpr, dpr);
                ctx.strokeStyle = "#0f172a";
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
            }
        };
        setupCanvas();
        window.addEventListener("resize", setupCanvas);
        return () => window.removeEventListener("resize", setupCanvas);
    }, [authVerified, signatureSaved]);

    // 2. Verificar identidad del paciente (4 últimos dígitos) contra el token
    const handleVerifyAccess = async (e) => {
        if (e) e.preventDefault();
        setAuthError(null);

        const tokenToUse = rawToken || extractToken();
        if (!tokenToUse) {
            setAuthError("No se detectó el token de seguridad en el enlace. Por favor vuelva a abrir el enlace recibido.");
            return;
        }

        const cleanLast4 = last4Input.replace(/\D/g, "");
        if (cleanLast4.length !== 4) {
            setAuthError("Debe ingresar exactamente los 4 últimos dígitos de su documento.");
            return;
        }

        setVerifying(true);
        try {
            const { data, error } = await supabase.rpc("verify_signature_token", {
                p_raw_token: tokenToUse,
                p_last4: cleanLast4
            });

            if (error) {
                console.error("RPC verify_signature_token error:", error);
                setAuthError(`Error de comunicación con el servidor: ${error.message || "Intente más tarde."}`);
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

            // Acceso legítimo: guardar snapshot y enriquecer información
            setPatientFirstName(data.patient_first_name || "Paciente");
            setDocumentSnapshot(data.document_snapshot);
            setDocumentHash(data.document_hash);

            if (data.clinic_info) {
                setClinicInfo(prev => ({
                    ...prev,
                    name: data.clinic_info.name || prev.name,
                    logo: data.clinic_info.logo || prev.logo,
                    nit: data.clinic_info.nit || prev.nit,
                    address: data.clinic_info.address || prev.address,
                    phone: data.clinic_info.phone || prev.phone
                }));
            }
            if (data.patient_info) setPatientInfo(data.patient_info);
            if (data.doctor_info) setDoctorInfo(data.doctor_info);

            setAuthVerified(true);
        } catch (err) {
            console.error("Error verificando token:", err);
            setAuthError("Ocurrió un error al verificar su documento.");
        } finally {
            setVerifying(false);
        }
    };

    // Funciones del Canvas con escala milimétrica exacta
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        let clientX = 0;
        let clientY = 0;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (!canvasRef.current) return;
        if (e.cancelable && e.type.startsWith("touch")) {
            e.preventDefault();
        }
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing || !canvasRef.current) return;
        if (e.cancelable && e.type.startsWith("touch")) {
            e.preventDefault();
        }
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
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        setHasDrawn(false);
    };

    // 3. Enviar firma certificada vía submit_digital_signature
    const handleSaveSignature = async () => {
        if (!hasDrawn || !canvasRef.current) {
            alert("Por favor dibuje su firma manuscrita en el recuadro antes de certificar.");
            return;
        }

        const cleanLast4 = last4Input.replace(/\D/g, "");
        const tokenToUse = rawToken || extractToken();
        if (!tokenToUse) {
            alert("No se detectó el token de firma. Por favor recargue el enlace.");
            return;
        }

        setSigning(true);
        try {
            const canvas = canvasRef.current;
            const patientSignature = canvas.toDataURL("image/png");

            const { data, error } = await supabase.rpc("submit_digital_signature", {
                p_raw_token: tokenToUse,
                p_last4: cleanLast4,
                p_signature_base64: patientSignature
            });

            if (error) {
                console.error("RPC submit_digital_signature error:", error);
                alert(`Error al registrar la firma digital: ${error.message || "Intente nuevamente."}`);
                return;
            }

            if (!data?.success) {
                alert("No se pudo completar la firma: " + (data?.error || "Error no especificado"));
                return;
            }

            setSavedSignatureData(patientSignature);
            setSignatureSaved(true);
            setSavedAt(data?.signed_at || new Date().toISOString());
            alert("✅ ¡Firma registrada exitosamente! Su atención odontológica ha sido formalmente certificada.");
        } catch (err) {
            console.error("Error guardando firma digital:", err);
            alert("Ocurrió un error al registrar la firma. Intente nuevamente.");
        } finally {
            setSigning(false);
        }
    };

    // 4. Descargar PDF limpio del documento clínico (sin botones ni banners)
    const handleDownloadPDF = async () => {
        if (!documentRef.current) return;
        try {
            const canvas = await html2canvas(documentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "letter");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Evolucion_${patientInfo?.name || patientFirstName || "Paciente"}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Error al descargar PDF:", error);
            window.print();
        }
    };

    // 5. Imprimir exclusivamente la hoja clínica limpia usando iframe aislado
    const handlePrint = () => {
        if (!documentRef.current) {
            window.print();
            return;
        }

        let iframe = document.getElementById("oc-print-sign-iframe");
        if (iframe) {
            try { document.body.removeChild(iframe); } catch {}
        }
        iframe = document.createElement("iframe");
        iframe.id = "oc-print-sign-iframe";
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.width = "1024px";
        iframe.style.height = "768px";
        iframe.style.border = "none";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Evolución Clínica - ${clinicInfo.name}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
                    @page { size: letter; margin: 12mm 15mm; }
                    table { width: 100%; border-collapse: collapse; }
                </style>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body>
                ${documentRef.current.outerHTML}
            </body>
            </html>
        `);
        doc.close();

        let printed = false;
        const trigger = () => {
            if (printed) return;
            printed = true;
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error("Error al imprimir iframe:", e);
            }
        };

        iframe.onload = () => setTimeout(trigger, 250);
        setTimeout(trigger, 600);
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

    // Pantalla de Validación de Identidad (Con Logo Oficial de la Clínica)
    if (!authVerified) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 max-w-md w-full space-y-6">
                    
                    {/* Logotipo Oficial y Cabecera de la Clínica */}
                    <div className="text-center space-y-3">
                        {clinicInfo.logo ? (
                            <div className="flex justify-center mb-2">
                                <img
                                    src={clinicInfo.logo}
                                    alt={clinicInfo.name}
                                    className="max-h-16 w-auto object-contain rounded-lg drop-shadow-sm"
                                    crossOrigin="anonymous"
                                />
                            </div>
                        ) : (
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                <FiShield size={28} />
                            </div>
                        )}

                        <div>
                            <h2 className="text-xs font-black uppercase text-indigo-600 tracking-widest">
                                {clinicInfo.name}
                            </h2>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight mt-0.5">
                                Verificación de Identidad
                            </h3>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Para consultar y firmar su evolución clínica emitida por <strong>{clinicInfo.name}</strong>, ingrese los <strong>últimos 4 dígitos</strong> de su documento.
                        </p>
                    </div>

                    <form onSubmit={handleVerifyAccess} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 text-center">
                                Últimos 4 dígitos del documento
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                value={last4Input}
                                onChange={(e) => setLast4Input(e.target.value.replace(/\D/g, ""))}
                                placeholder="Ej: 3494"
                                className="w-full px-4 py-3 text-center text-2xl tracking-widest font-black rounded-2xl border-2 border-slate-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all text-slate-800"
                                autoFocus
                            />
                        </div>

                        {authError && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <FiAlertCircle size={16} className="shrink-0" />
                                <span>{authError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={verifying || last4Input.length !== 4}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            {verifying ? "Verificando..." : "Acceder al Documento"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Pantalla Principal: Hoja Clínica Profesional Idéntica al Sistema
    const doctorSig = doctorInfo?.signature;
    const finalPatientSig = savedSignatureData || documentSnapshot?.patient_signature;

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Banner Superior de Acciones (Oculto en Impresión) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <FiEdit3 size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                Atención para {patientFirstName}
                            </h2>
                            <p className="text-[11px] text-slate-500 font-semibold">
                                {signatureSaved ? "Documento formalmente firmado y certificado." : "Revise su evolución y registre su firma al pie del documento."}
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

                {/* Hoja Clínica Profesional (Capturada para PDF e Impresión) */}
                <div 
                    ref={documentRef} 
                    className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6 text-slate-800"
                >
                    {/* Cabecera Clínica con Logo y Datos */}
                    <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            {clinicInfo.logo ? (
                                <img 
                                    src={clinicInfo.logo} 
                                    alt={clinicInfo.name} 
                                    className="h-12 w-auto max-w-[140px] object-contain rounded"
                                    crossOrigin="anonymous"
                                />
                            ) : (
                                <div className="w-12 h-12 bg-slate-100 rounded-xl border flex items-center justify-center font-black text-indigo-600 text-xs">
                                    {clinicInfo.name.slice(0, 3).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h1 className="text-xs sm:text-sm font-black uppercase text-slate-800 leading-tight">
                                    {clinicInfo.name}
                                </h1>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                    {clinicInfo.nit ? `NIT: ${clinicInfo.nit} · ` : ""}{clinicInfo.address || ""}{clinicInfo.phone ? ` · TEL: ${clinicInfo.phone}` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md border border-indigo-100 uppercase tracking-widest">
                                Evolución
                            </span>
                        </div>
                    </div>

                    {/* Tabla Institucional de Datos del Paciente (Formato OralDrive) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: '9px', color: '#334155', border: '1px solid #cbd5e1' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', width: '20%', backgroundColor: '#f8fafc' }}>Nombre del paciente</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', width: '30%' }}>{patientInfo?.name || patientFirstName}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', width: '12%', backgroundColor: '#f8fafc' }}>Edad</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', width: '13%' }}>{patientInfo?.edad ? `${patientInfo.edad} años` : "—"}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', width: '12%', backgroundColor: '#f8fafc' }}>Nro Historia</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', width: '13%' }}>{patientInfo?.documento || "—"}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Tipo documento</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }}>{patientInfo?.tipo_documento || "Cédula de ciudadanía"}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nro documento</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }} colSpan="3">{patientInfo?.documento || "—"}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Sexo / Género</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }}>{patientInfo?.genero || "Femenino"}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Teléfono</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }} colSpan="3">{patientInfo?.telefono || "—"}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Doctor Tratante</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }}>{doctorInfo?.name || documentSnapshot?.doctor_name || "Profesional"}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Fecha atención</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 7px' }} colSpan="3">
                                    {documentSnapshot?.fecha ? new Date(documentSnapshot.fecha).toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString("es-CO")}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Detalle del Tratamiento y Descripción */}
                    <div className="space-y-3">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Procedimiento Realizado</span>
                            <p className="text-xs font-bold text-slate-800">{documentSnapshot?.procedure || "Atención Odontológica General"}</p>
                        </div>

                        <div>
                            <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Observaciones / Notas Clínicas</span>
                            <div className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-4 rounded-xl border border-slate-200">
                                {documentSnapshot?.description || "Sin observaciones adicionales."}
                            </div>
                        </div>
                    </div>

                    {/* Cuadro de Firmas (Doctor Tratante y Paciente) */}
                    <div className="pt-6 border-t border-dashed border-slate-200 grid grid-cols-2 gap-6 items-end">
                        
                        {/* 1. Bloque de Firma del Doctor */}
                        <div className="text-center">
                            <div className="h-20 flex items-end justify-center pb-1 border-b border-slate-400 mb-2">
                                {doctorSig ? (
                                    <img 
                                        src={doctorSig} 
                                        alt="Firma del Profesional" 
                                        className="max-h-16 max-w-[180px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold italic">Certificado Digitalmente</span>
                                )}
                            </div>
                            <p className="text-[10px] font-black text-slate-800 uppercase">{doctorInfo?.name || documentSnapshot?.doctor_name}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{doctorInfo?.especialidad || "Odontólogo Tratante"}</p>
                            {doctorInfo?.reg_medico && (
                                <p className="text-[8px] text-slate-400">R.P.: {doctorInfo.reg_medico}</p>
                            )}
                        </div>

                        {/* 2. Bloque de Firma del Paciente */}
                        <div className="text-center">
                            <div className="h-20 flex items-end justify-center pb-1 border-b border-slate-400 mb-2">
                                {finalPatientSig ? (
                                    <img 
                                        src={finalPatientSig} 
                                        alt="Firma del Paciente" 
                                        className="max-h-16 max-w-[180px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold italic">Pendiente de firma</span>
                                )}
                            </div>
                            <p className="text-[10px] font-black text-slate-800 uppercase">{patientInfo?.name || patientFirstName}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">Firma del Paciente / Acudiente</p>
                            {savedAt && (
                                <p className="text-[8px] text-slate-400">Firmado el: {new Date(savedAt).toLocaleDateString("es-CO")}</p>
                            )}
                        </div>

                    </div>

                    {documentHash && (
                        <div className="text-[8px] text-slate-400 font-mono text-center pt-2">
                            Sello Digital Criptográfico SHA-256: {documentHash}
                        </div>
                    )}
                </div>

                {/* Recuadro de Captura de Firma (Solo visible si aún no ha firmado) */}
                {!signatureSaved && (
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-4 print:hidden">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-tight">Estampar Firma Manuscrita</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Dibuje su firma con el dedo o puntero táctil en el recuadro blanco para certificar el documento.
                            </p>
                        </div>

                        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white relative h-48 sm:h-56 touch-none shadow-inner">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-full cursor-crosshair touch-none select-none"
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
                                className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-rose-200 cursor-pointer"
                            >
                                Borrar
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveSignature}
                                disabled={signing || !hasDrawn}
                                className="px-8 py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-lime-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
                            >
                                {signing ? "Certificando..." : "Certificar y Firmar"}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
