import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import Button from "../../../components/ui/Button";
import { toast } from "sonner";

export default function ConsentimientosTab({ paciente }) {
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
            const q = query(
                collection(db, "consentimientos_firmados"),
                where("pacienteId", "==", paciente.id),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            const snap = await getDocs(collection(db, "config_consentimientos"));
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
            await addDoc(collection(db, "consentimientos_firmados"), {
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombreCompleto,
                templateId: selectedTemplate.id,
                templateTitle: selectedTemplate.title,
                contentSnapshot: previewContent,
                signatureUrl: signatureData,
                createdAt: serverTimestamp()
            });
            toast.success("Consentimiento informado guardado exitosamente.");
            setView("list");
            loadHistory();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar el consentimiento. Intente nuevamente.");
        }
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
                            <th className="p-3 text-center">Firma</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={4} className="p-4 text-center">Cargando...</td></tr> :
                            history.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-400">No hay consentimientos firmados.</td></tr> :
                                history.map(doc => (
                                    <tr key={doc.id} className="border-b hover:bg-slate-50">
                                        <td className="p-3">{doc.createdAt?.seconds ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : "Hoy"}</td>
                                        <td className="p-3 font-medium">{doc.templateTitle}</td>
                                        <td className="p-3 text-center">
                                            {doc.signatureUrl ? <span className="text-green-600 text-xs">✅ Firmado</span> : <span className="text-red-500">Pendiente</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                className="text-blue-600 hover:underline text-xs"
                                                onClick={() => {
                                                    const w = window.open("", "_blank");
                                                    w.document.write(`
                                            <html>
                                              <head><title>Consentimiento - ${doc.templateTitle}</title></head>
                                              <body style="font-family: sans-serif; padding: 40px;">
                                                <h1 style="text-align: center; margin-bottom: 30px;">${doc.templateTitle}</h1>
                                                <div style="white-space: pre-wrap; margin-bottom: 50px; line-height: 1.6;">${doc.contentSnapshot}</div>
                                                <div style="border-top: 1px solid #ccc; width: 300px; padding-top: 10px;">
                                                    <img src="${doc.signatureUrl}" style="max-width: 200px; display: block; margin-bottom: 10px;" />
                                                    <p style="font-weight: bold;">${doc.pacienteNombre}</p>
                                                    <p style="color: #666; font-size: 12px;">Firma Digital - OdontoCloud</p>
                                                </div>
                                              </body>
                                            </html>
                                        `);
                                                }}
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
