import React, { useState, useEffect, useRef } from "react";
import supabase from "../../../lib/supabaseClient";
import Button from "../../../components/ui/Button";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { getDoctorSignatureAndData } from "../../../services/doctorSignatureService";

export default function ConsentimientosTab({ paciente }) {
    const { userProfile } = useAuth();
    const [view, setView] = useState("list"); // 'list', 'new'
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    // New Consent State 
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [previewContent, setPreviewContent] = useState("");

    // Canvas
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        if (paciente?.id) loadHistory();
    }, [paciente?.id]);

    useEffect(() => {
        if (view === 'new') loadTemplates();
    }, [view]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from("consentimientos_firmados")
                .select("*")
                .or(`paciente_id.eq.${paciente.id},pacienteId.eq.${paciente.id}`)
                .order("created_at", { ascending: false });
            setHistory(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            const { data } = await supabase.from("config_consentimientos").select("*");
            setTemplates(data || []);
        } catch (e) { console.error(e); }
    };

    const handleTemplateSelect = (e) => {
        const tmplId = e.target.value;
        const tmpl = templates.find(t => t.id === tmplId);
        setSelectedTemplate(tmpl);
        if (tmpl) {
            // Simple replace of placeholders
            let text = tmpl.content || "";
            text = text.replace(/\[PACIENTE\]/g, paciente.nombreCompleto || "EL PACIENTE");
            text = text.replace(/\[DOCUMENTO\]/g, paciente.nroDocumento || "");
            setPreviewContent(text);
        } else {
            setPreviewContent("");
        }
        clearCanvas();
    };

    // Canvas Logic
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
        }
    };

    const handleSave = async () => {
        if (!selectedTemplate) return toast.error("Seleccione una plantilla de consentimiento.");
        if (!hasSignature) return toast.error("El paciente debe firmar antes de guardar.");

        const canvas = canvasRef.current;
        const signatureData = canvas.toDataURL("image/png");

        try {
            const docIdent = paciente?.doctorAsignado || (userProfile?.esDoctor ? userProfile?.nombreCompleto : "");
            const doctorData = await getDoctorSignatureAndData(docIdent, userProfile?.inquilino, userProfile);

            await supabase.from("consentimientos_firmados").insert([{
                paciente_id: paciente.id,
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombreCompleto,
                pacienteDocumento: `${paciente.tipoDocumento || 'C.C.'} ${paciente.nroDocumento || ''}`,
                templateId: selectedTemplate.id,
                templateTitle: selectedTemplate.title,
                contentSnapshot: previewContent,
                signatureData,
                signatureUrl: signatureData,
                doctorNombre: doctorData.nombreCompleto || docIdent || "Odontólogo Tratante",
                doctorFirma: doctorData.firma || null,
                doctorRegistro: doctorData.registroMedico || "",
                doctorEspecialidad: doctorData.especialidad || "",
                isDoctor: doctorData.isDoctor,
                fecha: new Date().toISOString()
            }]);
            toast.success("Consentimiento informado guardado exitosamente.");
            setView("list");
            loadHistory();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar el consentimiento. Intente nuevamente.");
        }
    };

    const handlePrintConsent = async (doc) => {
        const docIdent = doc.doctorNombre || paciente?.doctorAsignado || (userProfile?.esDoctor ? userProfile?.nombreCompleto : "");
        const doctorData = await getDoctorSignatureAndData(docIdent, userProfile?.inquilino, userProfile);
        
        const docFirma = doc.doctorFirma || (doctorData.isDoctor ? doctorData.firma : null);
        const docNom = doc.doctorNombre || doctorData.nombreCompleto || (doctorData.isDoctor ? userProfile?.nombreCompleto : '') || 'Odontólogo Tratante';
        const docReg = doc.doctorRegistro || doctorData.registroMedico || (doctorData.isDoctor ? userProfile?.registroMedico : '');
        const docEsp = doc.doctorEspecialidad || doctorData.especialidad || '';
        const patSig = doc.signatureData || doc.signatureUrl;

        const w = window.open("", "_blank");
        w.document.write(`
            <html>
                <head>
                    <title>Consentimiento Informado - ${doc.templateTitle}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                        body {
                            font-family: 'Inter', system-ui, -apple-system, sans-serif;
                            padding: 40px;
                            color: #1e293b;
                            max-width: 800px;
                            margin: 0 auto;
                            line-height: 1.6;
                        }
                        h1 {
                            font-size: 20px;
                            font-weight: 800;
                            text-align: center;
                            text-transform: uppercase;
                            color: #0f172a;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 15px;
                            margin-bottom: 30px;
                        }
                        .content {
                            white-space: pre-wrap;
                            font-size: 13px;
                            line-height: 1.7;
                            color: #334155;
                            text-align: justify;
                            margin-bottom: 60px;
                        }
                        .signatures-container {
                            display: flex;
                            justify-content: space-between;
                            gap: 40px;
                            margin-top: 40px;
                        }
                        .sig-card {
                            flex: 1;
                            text-align: center;
                        }
                        .sig-space {
                            height: 70px;
                            display: flex;
                            align-items: flex-end;
                            justify-content: center;
                            margin-bottom: 6px;
                        }
                        .sig-img {
                            max-height: 65px;
                            max-width: 200px;
                            object-fit: contain;
                        }
                        .sig-line {
                            border-top: 1.5px solid #64748b;
                            margin-bottom: 6px;
                        }
                        .sig-name {
                            font-weight: 800;
                            font-size: 12px;
                            color: #0f172a;
                            text-transform: uppercase;
                        }
                        .sig-role {
                            font-size: 10px;
                            font-weight: 700;
                            color: #64748b;
                            text-transform: uppercase;
                        }
                        .sig-doc {
                            font-size: 9px;
                            color: #94a3b8;
                            margin-top: 2px;
                        }
                    </style>
                </head>
                <body>
                    <h1>${doc.templateTitle}</h1>
                    <div class="content">${doc.contentSnapshot}</div>
                    
                    <div class="signatures-container">
                        <!-- Firma Paciente -->
                        <div class="sig-card">
                            <div class="sig-space">
                                ${patSig ? `<img src="${patSig}" class="sig-img" />` : ''}
                            </div>
                            <div class="sig-line"></div>
                            <div class="sig-name">${doc.pacienteNombre || paciente.nombreCompleto}</div>
                            <div class="sig-role">Firma del Paciente / Representante</div>
                            <div class="sig-doc">${doc.pacienteDocumento || `${paciente.tipoDocumento || 'C.C.'} ${paciente.nroDocumento || ''}`}</div>
                        </div>

                        <!-- Firma Profesional / Odontólogo -->
                        <div class="sig-card">
                            <div class="sig-space">
                                ${docFirma ? `<img src="${docFirma}" class="sig-img" />` : ''}
                            </div>
                            <div class="sig-line"></div>
                            <div class="sig-name">${docNom}</div>
                            <div class="sig-role">${docEsp ? `${docEsp} — ` : ''}Profesional Tratante</div>
                            ${docReg ? `<div class="sig-doc">TP / Reg. Médico: ${docReg}</div>` : ''}
                        </div>
                    </div>
                </body>
            </html>
        `);
    };

    // Views
    if (view === 'new') {
        return (
            <div className="p-4 bg-white border rounded-lg">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Nuevo Consentimiento</h3>
                    <Button variant="ghost" onClick={() => setView('list')}>Cancelar</Button>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Seleccionar Plantilla</label>
                    <select className="w-full p-2 border rounded" onChange={handleTemplateSelect} defaultValue="">
                        <option value="">-- Seleccione --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                </div>

                {selectedTemplate && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 border rounded text-sm text-justify whitespace-pre-wrap h-96 overflow-y-auto">
                            {previewContent}
                        </div>

                        <div className="flex flex-col">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Firma del Paciente</label>
                            <div className="border border-slate-300 rounded bg-white touch-none">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={200}
                                    className="w-full h-48 cursor-crosshair"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={endDrawing}
                                    onMouseLeave={endDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={endDrawing}
                                />
                            </div>
                            <div className="flex justify-between mt-2">
                                <button onClick={clearCanvas} className="text-xs text-red-500 underline">Borrar Firma</button>
                                <span className="text-xs text-slate-400">Dibuje su firma arriba</span>
                            </div>

                            <div className="mt-8">
                                <Button variant="primary" className="w-full" onClick={handleSave}>
                                    Guardar y Firmar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">Consentimientos Informados</h3>
                <Button variant="primary" size="sm" onClick={() => setView('new')}>+ Nuevo</Button>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Procedimiento</th>
                            <th className="p-3 text-center">Firma Paciente</th>
                            <th className="p-3 text-center">Firma Profesional</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={5} className="p-4 text-center">Cargando...</td></tr> :
                            history.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-400">No hay consentimientos firmados.</td></tr> :
                                history.map(doc => (
                                    <tr key={doc.id} className="border-b hover:bg-slate-50">
                                        <td className="p-3">{doc.createdAt?.seconds ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : (doc.fecha ? new Date(doc.fecha).toLocaleDateString() : "Hoy")}</td>
                                        <td className="p-3 font-medium">{doc.templateTitle}</td>
                                        <td className="p-3 text-center">
                                            {(doc.signatureUrl || doc.signatureData) ? <span className="text-green-600 font-bold text-xs">✅ Firmado</span> : <span className="text-red-500 text-xs">Pendiente</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            {doc.doctorFirma ? <span className="text-green-600 font-bold text-xs">✅ Digital</span> : <span className="text-slate-400 text-xs">{doc.doctorNombre || 'Doctor'}</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                className="text-blue-600 font-bold hover:underline text-xs"
                                                onClick={() => handlePrintConsent(doc)}
                                            >
                                                Ver / Imprimir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
}
