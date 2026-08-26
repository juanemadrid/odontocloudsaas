// src/pages/DigitalSignaturePublicPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { FiCheckCircle, FiDownload, FiPrinter, FiEdit3, FiShield, FiAlertCircle, FiTrash2, FiFileText } from "react-icons/fi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function DigitalSignaturePublicPage() {
    const [searchParams] = useSearchParams();
    const patientId = searchParams.get("id");
    const evoId = searchParams.get("evoId");

    const [loading, setLoading] = useState(true);
    const [patient, setPatient] = useState(null);
    const [evolution, setEvolution] = useState(null);
    const [clinicConfig, setClinicConfig] = useState(null);
    const [signing, setSigning] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(false);

    // Canvas de firma táctil / mouse
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const documentRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            if (!patientId || !evoId) {
                setLoading(false);
                return;
            }

            try {
                // 1. Cargar Paciente
                const { data: pData } = await supabase
                    .from("pacientes")
                    .select("*")
                    .eq("id", patientId)
                    .maybeSingle();
                setPatient(pData);

                // 2. Cargar Evolución
                const { data: eData } = await supabase
                    .from("evoluciones")
                    .select("*")
                    .eq("id", evoId)
                    .maybeSingle();

                if (eData) {
                    let parsed = {};
                    if (eData.tratamiento && typeof eData.tratamiento === "string" && eData.tratamiento.startsWith("{")) {
                        try { parsed = JSON.parse(eData.tratamiento); } catch (e) {}
                    }
                    const fullEvo = {
                        ...eData,
                        ...parsed,
                        id: eData.id,
                        description: eData.comentario || parsed.description || eData.description || "",
                        date: eData.created_at || eData.fecha,
                        profesional: eData.profesional || parsed.profesional || "Odontólogo",
                        doctorSignature: parsed.doctorSignature || eData.doctorSignature,
                        patientSignature: parsed.patientSignature || eData.patientSignature,
                        patientFingerprint: parsed.patientFingerprint || eData.patientFingerprint,
                    };
                    setEvolution(fullEvo);
                    if (fullEvo.patientSignature) {
                        setSignatureSaved(true);
                    }
                }

                // 3. Cargar Datos de la Clínica
                const tenantId = pData?.tenant_id || eData?.tenant_id;
                if (tenantId) {
                    const { data: cData } = await supabase
                        .from("tenants")
                        .select("*")
                        .eq("id", tenantId)
                        .maybeSingle();
                    if (cData) setClinicConfig(cData);
                }
            } catch (err) {
                console.error("Error al cargar datos de evolución pública:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [patientId, evoId]);

    // Configurar Canvas
    useEffect(() => {
        if (!canvasRef.current || signatureSaved) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, [signatureSaved, loading]);

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

    const handleSaveSignature = async () => {
        if (!hasDrawn || !canvasRef.current) {
            alert("Por favor ingrese su firma manuscrita en el recuadro antes de guardar.");
            return;
        }

        setSigning(true);
        try {
            const canvas = canvasRef.current;
            const patientSignature = canvas.toDataURL("image/png");
            const signedAt = new Date().toISOString();

            let parsed = {};
            if (evolution?.tratamiento && typeof evolution.tratamiento === "string" && evolution.tratamiento.startsWith("{")) {
                try { parsed = JSON.parse(evolution.tratamiento); } catch (e) {}
            } else if (typeof evolution?.tratamiento === "object") {
                parsed = { ...evolution.tratamiento };
            }

            const updatedTratamiento = {
                ...parsed,
                patientSignature,
                patientSignedAt: signedAt
            };

            const { error } = await supabase
                .from("evoluciones")
                .update({
                    tratamiento: JSON.stringify(updatedTratamiento)
                })
                .eq("id", evoId);

            if (error) throw error;

            setEvolution(prev => ({
                ...prev,
                patientSignature,
                patientSignedAt: signedAt
            }));
            setSignatureSaved(true);
            alert("✅ ¡Firma registrada exitosamente! Su documento clínico ha sido certificado.");
        } catch (err) {
            console.error("Error guardando firma pública:", err);
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
            pdf.save(`Evolucion_${patient?.nombreCompleto || "Paciente"}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Error al descargar PDF:", error);
            window.print();
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getEdad = () => {
        if (!patient?.fechaNacimiento) return patient?.edad || "N/A";
        try {
            const birth = new Date(patient.fechaNacimiento);
            const diff = Date.now() - birth.getTime();
            const ageDate = new Date(diff);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        } catch {
            return patient?.edad || "N/A";
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cargando documento clínico seguro...</p>
                </div>
            </div>
        );
    }

    if (!patient || !evolution) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md text-center space-y-4">
                    <FiAlertCircle size={40} className="text-rose-500 mx-auto" />
                    <h3 className="text-base font-black text-slate-800">Documento no disponible</h3>
                    <p className="text-xs text-slate-500 font-medium">El enlace de la evolución clínica es inválido o ha expirado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Banner Superior de Estado */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                        {signatureSaved || evolution?.patientSignature ? (
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <FiCheckCircle size={22} />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <FiEdit3 size={22} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                {signatureSaved || evolution?.patientSignature ? "Documento Clínico Certificado" : "Firma Digital de Evolución Clínica"}
                            </h2>
                            <p className="text-[11px] text-slate-500 font-semibold">
                                {signatureSaved || evolution?.patientSignature 
                                    ? "Este documento cuenta con validez y certificación médica digital." 
                                    : "Revise el detalle de su atención odontológica y registre su firma al final."}
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
                            Descargar PDF
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

                {/* Hoja Clínica con Estructura Oficial (Idéntica a OralDrive) */}
                <div ref={documentRef} className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6">
                    
                    {/* Cabecera Clínica */}
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            {clinicConfig?.logo || clinicConfig?.logo_url ? (
                                <img src={clinicConfig.logo || clinicConfig.logo_url} alt="Logo" className="w-14 h-14 object-contain" />
                            ) : (
                                <div className="w-14 h-14 bg-slate-100 rounded-xl border flex items-center justify-center font-black text-indigo-600 text-sm shadow-inner">
                                    ATM
                                </div>
                            )}
                            <div>
                                <h1 className="text-sm font-black uppercase text-slate-800 leading-tight">
                                    {clinicConfig?.nombre_comercial || clinicConfig?.nombre || "ATM Centro del Dolor Orofacial"}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                    NIT: {clinicConfig?.nit || "64576359-3"} · {clinicConfig?.direccion || "Calle 16 #17-68"} · Tel: {clinicConfig?.telefono || "3103583706"}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md border border-indigo-100 uppercase tracking-widest">
                                Evolución Clínica
                            </span>
                        </div>
                    </div>

                    {/* Tabla Oficial de Datos del Paciente (Cuadrícula OralDrive) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: '10px', color: '#334155', border: '1px solid #cbd5e1' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', width: '18%', backgroundColor: '#f8fafc' }}>Nombre del paciente</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', width: '32%' }}>{patient?.nombreCompleto || patient?.nombre}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', width: '15%', backgroundColor: '#f8fafc' }}>Edad</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', width: '15%' }}>{getEdad()}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', width: '10%', backgroundColor: '#f8fafc' }}>Nro Historia</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', width: '10%' }}>{patient?.documento || patient?.cedula || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Tipo documento</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.tipoDocumento || 'Cédula de ciudadanía'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nro de documento</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="3">{patient?.documento || patient?.cedula || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Sexo</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.genero || patient?.sexo || 'Femenino'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Fecha y lugar de nacimiento</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="3">
                                    {patient?.fechaNacimiento ? new Date(patient.fechaNacimiento).toLocaleDateString('es-CO') : '12/04/1996'} · {patient?.lugarNacimiento || 'Colombia - Sincelejo'}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Correo</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.email || patient?.correo || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Ocupación</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.ocupacion || 'Asistente Administrativo'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Fecha impresión</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{new Date().toLocaleDateString('es-CO')}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Teléfonos</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.celular || patient?.telefono || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Estado civil</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="3">{patient?.estadoCivil || 'Soltero'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nombre responsable</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.nombreResponsable || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>EPS</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.nombreEps || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Doctor/Profesional</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{evolution?.profesional || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Parentesco responsable</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.parentesco || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nombre acompañante</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="3">{patient?.nombreAcompanante || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Teléfono responsable</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }}>{patient?.celularResponsable || 'N/A'}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Tel. Acompañante</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="3">{patient?.telefonoAcompanante || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Dirección residencia</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px' }} colSpan="5">{patient?.direccion || patient?.direccionResidencia || 'N/A'}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Separador Evoluciones */}
                    <div className="flex items-center justify-center my-6">
                        <div className="border-t border-dashed border-slate-300 w-full" />
                        <span className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Evoluciones</span>
                        <div className="border-t border-dashed border-slate-300 w-full" />
                    </div>

                    {/* Detalle de la Evolución */}
                    <div className="space-y-3 text-left">
                        <p className="text-xs font-black text-slate-800">
                            {patient?.nombreCompleto || patient?.nombre} ({evolution?.profesional})
                            <span className="font-medium text-slate-400 block mt-0.5 text-[11px]">
                                {new Date(evolution?.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} — {new Date(evolution?.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                        </p>
                        <div className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {evolution?.description || evolution?.comentario || "Sin observaciones adicionales."}
                        </div>

                        {/* Procedimientos */}
                        {(() => {
                            const items = evolution?.plantillaItems ? Object.values(evolution.plantillaItems).filter(v => v?.checked) : [];
                            const planName = evolution?.treatment || '';
                            return items.length > 0 ? items.map((item, i) => {
                                const procName = item.desc || item.procedimiento || item.nombre || '';
                                if (!procName) return null;
                                const line = planName ? `${planName} - ${i + 1}. ${procName.toUpperCase()}` : `${i + 1}. ${procName.toUpperCase()}`;
                                return (
                                    <p key={i} className="text-xs font-bold text-slate-800 mt-1">
                                        {line}
                                    </p>
                                );
                            }) : planName ? (
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">
                                    {planName}
                                </p>
                            ) : null;
                        })()}
                    </div>

                    {/* Sección de Firmas Digitales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                        {/* Firma Doctor */}
                        <div className="text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Profesional Tratante</p>
                            <div className="h-24 flex items-center justify-center border-b border-slate-300">
                                {evolution?.doctorSignature?.signatureImage ? (
                                    <img src={evolution.doctorSignature.signatureImage} alt="Firma Doctor" className="max-h-20 object-contain" />
                                ) : evolution?.doctorSignature?.signature ? (
                                    <span className="text-xs font-serif italic text-slate-700 font-bold">{evolution.doctorSignature.signature}</span>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Pendiente de firma</span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-slate-800">{evolution?.doctorSignature?.signature || evolution?.profesional || "Doctor Tratante"}</p>
                            {evolution?.doctorSignature?.registroMedico && (
                                <p className="text-[10px] text-slate-500 font-semibold">T.P. / Reg: {evolution.doctorSignature.registroMedico}</p>
                            )}
                        </div>

                        {/* Firma Paciente */}
                        <div className="text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Firma del Paciente / Aceptante</p>
                            <div className="h-24 flex items-center justify-center border-b border-slate-300">
                                {evolution?.patientSignature ? (
                                    <img src={evolution.patientSignature} alt="Firma Paciente" className="max-h-20 object-contain" />
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Pendiente de firma</span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-slate-800">{patient?.nombreCompleto || patient?.nombre}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">CC: {patient?.documento || patient?.cedula}</p>
                        </div>
                    </div>

                </div>

                {/* Bloque para Capturar Firma si aún no está firmada (Estilo Idéntico a OralDrive) */}
                {!signatureSaved && !evolution?.patientSignature ? (
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-4">
                        <div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">Firma</h3>
                            <p className="text-xs text-slate-500 font-bold mt-1">Firma del paciente</p>
                        </div>

                        {/* Recuadro Canvas de Firma */}
                        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white relative h-48 sm:h-56 touch-none shadow-inner">
                            <canvas
                                ref={canvasRef}
                                width={700}
                                height={220}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                TouchStart={startDrawing}
                                TouchMove={draw}
                                TouchEnd={stopDrawing}
                                className="w-full h-full cursor-crosshair"
                            />
                            {!hasDrawn && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <p className="text-xs font-semibold text-slate-300 tracking-wider">Dibuje su firma aquí</p>
                                </div>
                            )}
                        </div>

                        {/* Botones Alineados a la Derecha */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClearCanvas}
                                className="px-6 py-2 bg-[#f43f5e] hover:bg-[#e11d48] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                            >
                                Borrar firma
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveSignature}
                                disabled={signing || !hasDrawn}
                                className="px-8 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                                {signing ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3 shadow-xs">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                            <FiCheckCircle size={26} />
                        </div>
                        <h3 className="text-sm font-black text-emerald-800 uppercase tracking-wide">
                            Documento Clínico Firmado y Certificado
                        </h3>
                        <p className="text-xs text-emerald-600 font-semibold max-w-md mx-auto">
                            Su firma ha sido vinculada satisfactoriamente a la historia clínica. Puede descargar su copia en PDF o imprimirla cuando lo desee.
                        </p>
                        <div className="pt-2 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            >
                                <FiDownload size={15} />
                                Descargar Copia en PDF
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
