// src/modules/odontograma/Odontograma.jsx
import React, { useState, useEffect, useRef } from "react";
import OdontogramaVisual from "./components/OdontogramaVisual";
import TratamientosToolbar, { TOOLS, SURFACES } from "./components/TratamientosToolbar";
import { db } from "../../firebase/firebaseConfig";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    doc,
    setDoc,
    serverTimestamp,
    addDoc,
    deleteDoc
} from "firebase/firestore";
import {
    FiPlus,
    FiSave,
    FiClock,
    FiFileText,
    FiTrash2,
    FiSearch,
    FiChevronLeft,
    FiCheckCircle,
    FiEye,
    FiEdit3,
    FiPrinter,
    FiCalendar,
    FiFeather,
    FiX
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
const printHTMLInHiddenIframe = (htmlContent) => {
    let iframe = document.getElementById("oc-print-iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "oc-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0px";
        iframe.style.height = "0px";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const triggerPrint = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 150);
    };

    const img = doc.querySelector('.odontogram-image');
    if (img) {
        if (img.complete) {
            triggerPrint();
        } else {
            img.onload = triggerPrint;
        }
    } else {
        triggerPrint();
    }
};

export default function Odontograma({ embeddedPatient }) {
    const toast = useToast();
    const { userProfile } = useAuth();

    const [viewMode, setViewMode] = useState("LIST");
    const [sesiones, setSesiones] = useState([]);
    const [currentSesion, setCurrentSesion] = useState(null);
    const [selectedToolId, setSelectedToolId] = useState("caries");
    const [odontogramaData, setOdontogramaData] = useState({});
    const [planTratamiento, setPlanTratamiento] = useState([]);
    const [tipoDenticion, setTipoDenticion] = useState("completo");
    const [observaciones, setObservaciones] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [firmaModal, setFirmaModal] = useState(null);

    const [printingSesion, setPrintingSesion] = useState(null);
    const printTargetRef = useRef(null);

    useEffect(() => {
        if (!printingSesion) return;

        const executePrint = async () => {
            const toastId = toast?.loading ? toast.loading("Generando vista de impresión...") : null;
            try {
                await new Promise(r => setTimeout(r, 150));
                const { default: html2canvas } = await import("html2canvas");
                const el = printTargetRef.current;
                if (!el) {
                    if (toastId && toast?.dismiss) toast.dismiss(toastId);
                    setPrintingSesion(null);
                    return;
                }

                const canvas = await html2canvas(el, {
                    backgroundColor: "#ffffff",
                    scale: 2,
                    logging: false,
                    useCORS: true
                });

                const imgData = canvas.toDataURL("image/png");

                const logoUrl = userProfile?.tenant?.logo || "";
                const clinicName = userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenant?.name || "Clínica Dental";
                const clinicNit = userProfile?.tenant?.nit || "—";
                const clinicAddress = userProfile?.tenant?.direccion || "—";
                const clinicPhone = userProfile?.tenant?.telefono || "—";
                const clinicEmail = userProfile?.tenant?.email || "";

                const rawDate = printingSesion.creado?.seconds ? new Date(printingSesion.creado.seconds * 1000) : new Date();
                const dateStr = rawDate.toLocaleDateString("es-CO");

            const htmlContent = `
                <html>
                <head>
                    <title>Odontograma Clínico - ${embeddedPatient?.nombreCompleto}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                            color: #334155;
                            background-color: #ffffff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 4px solid #2563eb;
                            padding-bottom: 25px;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .logo-container {
                            display: flex;
                            gap: 25px;
                            align-items: center;
                        }
                        .logo-text-placeholder {
                            width: 80px;
                            height: 80px;
                            background: #2563eb;
                            border-radius: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 36px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .clinic-title {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #0f172a;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                        }
                        .clinic-meta {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        .doc-info {
                            text-align: right;
                        }
                        .doc-badge {
                            background: #eff6ff;
                            padding: 12px 20px;
                            border-radius: 16px;
                            border: 2px solid #dbeafe;
                            margin-bottom: 8px;
                            display: inline-block;
                        }
                        .doc-badge span {
                            font-size: 16px;
                            font-weight: 900;
                            color: #1d4ed8;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .doc-meta {
                            margin: 0;
                            font-size: 11px;
                            color: #94a3b8;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .patient-info {
                            font-size: 13px;
                            margin-bottom: 24px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 16px;
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 8px;
                        }
                        .patient-info div span {
                            font-weight: bold;
                            color: #475569;
                            margin-right: 4px;
                        }
                        .odontogram-image-container {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-top: 10px;
                        }
                        .odontogram-image {
                            max-width: 100%;
                            height: auto;
                            border: 1px solid #cbd5e1;
                            border-radius: 16px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                            .odontogram-image {
                                border: none;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo-container">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`
                                : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`
                            }
                            <div>
                                <h1 class="clinic-title">${clinicName}</h1>
                                <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicNit}</p>
                                <p class="clinic-meta">${clinicAddress}</p>
                                <p class="clinic-meta">TEL: ${clinicPhone} | ${clinicEmail}</p>
                            </div>
                        </div>
                        <div class="doc-info">
                            <div class="doc-badge">
                                <span>Odontograma Clínico</span>
                            </div>
                            <p class="doc-meta">FECHA SESIÓN: ${dateStr}</p>
                        </div>
                    </div>
                    <div class="patient-info">
                        <div><span>Paciente:</span> ${embeddedPatient?.nombreCompleto}</div>
                        <div><span>Doc. Identidad:</span> ${embeddedPatient?.nroDocumento || "—"}</div>
                        <div><span>Historia Clínica:</span> ${embeddedPatient?.nroHistoria || "—"}</div>
                        <div><span>Edad:</span> ${embeddedPatient?.edad || "—"}</div>
                    </div>
                    <div class="odontogram-image-container">
                        <img src="${imgData}" class="odontogram-image" />
                    </div>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                                ${(userProfile?.firmaElectronica || userProfile?.firma) ? `<img src="${userProfile.firmaElectronica || userProfile.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />` : ''}
                            </div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Firma del Especialista / Odontólogo</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${userProfile?.registroMedico ? `TP: ${userProfile.registroMedico}` : 'Sello y Registro Médico'}</p>
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px;"></div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Responsable de Registro</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${(userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Administrador").toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            printHTMLInHiddenIframe(htmlContent);

            if (toastId && toast?.dismiss) toast.dismiss(toastId);
            if (toast?.success) toast.success("Vista previa de impresión generada");

        } catch (err) {
            console.error(err);
            if (toastId && toast?.dismiss) toast.dismiss(toastId);
            if (toast?.error) toast.error("Error al generar vista de impresión");
        } finally {
            setPrintingSesion(null);
        }
    };

    executePrint();
}, [printingSesion]);

    useEffect(() => {
        if (embeddedPatient?.id) loadSesiones();
    }, [embeddedPatient?.id]);

    const loadSesiones = async () => {
        setLoading(true);
        try {
            const colRef = collection(db, "pacientes", embeddedPatient.id, "odontogramas");
            const snap = await getDocs(query(colRef, orderBy("creado", "desc")));
            setSesiones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { toast?.error("Error al cargar historial"); }
        finally { setLoading(false); }
    };

    const handleNuevo = async () => {
        setLoading(true);
        try {
            const colRef = collection(db, "pacientes", embeddedPatient.id, "odontogramas");
            const docRef = await addDoc(colRef, {
                creado: serverTimestamp(),
                creadoPor: embeddedPatient.creadorEmail || "usuario@sistema.com",
                profesional: embeddedPatient.dentistaResponsable || "Profesional",
                estado: "Abierto",
                data: {}, plan: [], observaciones: ""
            });
            abrirEditor({ id: docRef.id, data: {}, plan: [], observaciones: "", estado: "Abierto" });
        } catch { toast?.error("Error al crear sesión"); }
        finally { setLoading(false); }
    };

    const abrirEditor = (s) => {
        setCurrentSesion(s);
        setOdontogramaData(s.data || {});
        setPlanTratamiento(s.plan || []);
        setObservaciones(s.observaciones || "");
        setViewMode("EDITOR");
    };

    const handleEliminar = async (id) => {
        if (!window.confirm("¿Eliminar este odontograma permanentemente?")) return;
        try {
            await deleteDoc(doc(db, "pacientes", embeddedPatient.id, "odontogramas", id));
            toast?.success("Eliminado correctamente");
            loadSesiones();
        } catch { toast?.error("Error al eliminar"); }
    };

    const getClinicalZonaLabel = (dienteId, zona) => {
        if (zona === "center") return "Oclusal/Incisal";
        if (zona === "Completo") return "Pieza Completa";
        
        const num = parseInt(dienteId);
        // Dientes Superiores: 1x, 2x, 5x, 6x
        const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
        
        if (zona === "top") return "Vestibular";
        if (zona === "bottom") return isUpper ? "Palatina" : "Lingual";
        
        // Mesial es hacia la línea media (entre 11-21, 51-61, etc.)
        // Derecha del paciente (1x, 4x, 5x, 8x): Derecha en pantalla es Mesial, Izquierda es Distal
        // Izquierda del paciente (2x, 3x, 6x, 7x): Izquierda en pantalla es Mesial, Derecha es Distal
        const isRightSide = (num >= 11 && num <= 18) || (num >= 41 && num <= 48) || (num >= 51 && num <= 55) || (num >= 81 && num <= 85);
        
        if (zona === "left") return isRightSide ? "Distal" : "Mesial";
        if (zona === "right") return isRightSide ? "Mesial" : "Distal";
        
        return zona;
    };

    const [activeToothId, setActiveToothId] = useState(null);
    const [surfaceFilter, setSurfaceFilter] = useState("todas");
    const odontogramaRef = useRef(null);

    const handleImpFoto = async () => {
        try {
            const { default: html2canvas } = await import("html2canvas");
            const el = odontogramaRef.current;
            if (!el) return;
            const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
            const link = document.createElement("a");
            link.download = `odontograma_${embeddedPatient?.nombreCompleto || "paciente"}_${new Date().toLocaleDateString("es-ES").replace(/\//g, "-")}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast?.success("📸 Imagen guardada");
        } catch { toast?.error("Error al capturar imagen"); }
    };

    const handleImprimir = async () => {
        setLoading(true);
        try {
            const { default: html2canvas } = await import("html2canvas");
            const el = odontogramaRef.current;
            if (!el) return;

            // Desactivamos temporalmente el anillo de selección activo para la impresión
            const prevActiveTooth = activeToothId;
            setActiveToothId(null);

            // Breve espera para asegurar que React actualizó el DOM
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(el, { 
                backgroundColor: "#ffffff", 
                scale: 2,
                logging: false,
                useCORS: true
            });

            // Restauramos la selección
            setActiveToothId(prevActiveTooth);

            const imgData = canvas.toDataURL("image/png");

            const logoUrl = userProfile?.tenant?.logo || "";
            const clinicName = userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenant?.name || "Clínica Dental";
            const clinicNit = userProfile?.tenant?.nit || "—";
            const clinicAddress = userProfile?.tenant?.direccion || "—";
            const clinicPhone = userProfile?.tenant?.telefono || "—";
            const clinicEmail = userProfile?.tenant?.email || "";

            const htmlContent = `
                <html>
                <head>
                    <title>Odontograma Clínico - ${embeddedPatient?.nombreCompleto}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                            color: #334155;
                            background-color: #ffffff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 4px solid #2563eb;
                            padding-bottom: 25px;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .logo-container {
                            display: flex;
                            gap: 25px;
                            align-items: center;
                        }
                        .logo-text-placeholder {
                            width: 80px;
                            height: 80px;
                            background: #2563eb;
                            border-radius: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 36px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .clinic-title {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #0f172a;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                        }
                        .clinic-meta {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        .doc-info {
                            text-align: right;
                        }
                        .doc-badge {
                            background: #eff6ff;
                            padding: 12px 20px;
                            border-radius: 16px;
                            border: 2px solid #dbeafe;
                            margin-bottom: 8px;
                            display: inline-block;
                        }
                        .doc-badge span {
                            font-size: 16px;
                            font-weight: 900;
                            color: #1d4ed8;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .doc-meta {
                            margin: 0;
                            font-size: 11px;
                            color: #94a3b8;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .patient-info {
                            font-size: 13px;
                            margin-bottom: 24px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 16px;
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 8px;
                        }
                        .patient-info div span {
                            font-weight: bold;
                            color: #475569;
                            margin-right: 4px;
                        }
                        .odontogram-image-container {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-top: 10px;
                        }
                        .odontogram-image {
                            max-width: 100%;
                            height: auto;
                            border: 1px solid #cbd5e1;
                            border-radius: 16px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                            .odontogram-image {
                                border: none;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo-container">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`
                                : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`
                            }
                            <div>
                                <h1 class="clinic-title">${clinicName}</h1>
                                <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicNit}</p>
                                <p class="clinic-meta">${clinicAddress}</p>
                                <p class="clinic-meta">TEL: ${clinicPhone} | ${clinicEmail}</p>
                            </div>
                        </div>
                        <div class="doc-info">
                            <div class="doc-badge">
                                <span>Odontograma Clínico</span>
                            </div>
                            <p class="doc-meta">FECHA IMPRESIÓN: ${new Date().toLocaleDateString("es-ES")}</p>
                        </div>
                    </div>
                    <div class="patient-info">
                        <div><span>Paciente:</span> ${embeddedPatient?.nombreCompleto}</div>
                        <div><span>Doc. Identidad:</span> ${embeddedPatient?.nroDocumento || "—"}</div>
                        <div><span>Historia Clínica:</span> ${embeddedPatient?.nroHistoria || "—"}</div>
                        <div><span>Edad:</span> ${embeddedPatient?.edad || "—"}</div>
                    </div>
                    <div class="odontogram-image-container">
                        <img src="${imgData}" class="odontogram-image" />
                    </div>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                                ${(userProfile?.firmaElectronica || userProfile?.firma) ? `<img src="${userProfile.firmaElectronica || userProfile.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />` : ''}
                            </div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Firma del Especialista / Odontólogo</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${userProfile?.registroMedico ? `TP: ${userProfile.registroMedico}` : 'Sello y Registro Médico'}</p>
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px;"></div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Responsable de Registro</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${(userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Administrador").toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            printHTMLInHiddenIframe(htmlContent);
        } catch { 
            toast?.error("Error al generar impresión del odontograma"); 
        } finally {
            setLoading(false);
        }
    };

    const handleToothClick = (dienteId, zona) => {
        setActiveToothId(dienteId);
        
        if (!surfaceFilter) return;

        // Si el usuario tiene un filtro de superficie activo (ej: Mesial)
        // Forzamos que se marque esa zona específica automáticamente en cualquier clic (diente o selector)
        let targetZona = zona;
        if (surfaceFilter !== "todas") {
            const surfaceMap = {
                'vestibular': 'top',
                'oclusal': 'center',
                'lingual': 'bottom',
                'mesial': (parseInt(dienteId) >= 11 && parseInt(dienteId) <= 18) || (parseInt(dienteId) >= 41 && parseInt(dienteId) <= 48) || (parseInt(dienteId) >= 51 && parseInt(dienteId) <= 55) || (parseInt(dienteId) >= 81 && parseInt(dienteId) <= 85) ? 'right' : 'left',
                'distal': (parseInt(dienteId) >= 11 && parseInt(dienteId) <= 18) || (parseInt(dienteId) >= 41 && parseInt(dienteId) <= 48) || (parseInt(dienteId) >= 51 && parseInt(dienteId) <= 55) || (parseInt(dienteId) >= 81 && parseInt(dienteId) <= 85) ? 'left' : 'right'
            };
            targetZona = surfaceMap[surfaceFilter] || zona;
        }

        const tool = TOOLS.find(t => t.id === selectedToolId);
        if (!tool) return;

        const isGeneralTool = [
            "ausente", "extraccion", "implante_bueno", "implante_malo", 
            "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
            "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
        ].includes(selectedToolId);

        setOdontogramaData(prev => {
            const cur = { ...(prev[dienteId] || {}) };
            
            if (selectedToolId === "borrador") {
                if (targetZona === "Completo" || isGeneralTool) {
                    return { ...prev, [dienteId]: {} };
                }
                const newToothData = { ...cur };
                delete newToothData[targetZona];
                return { ...prev, [dienteId]: newToothData };
            }

            if (isGeneralTool || targetZona === "Completo") {
                return { 
                    ...prev, 
                    [dienteId]: { 
                        ...cur, 
                        general: { id: tool.id, color: tool.color } 
                    } 
                };
            }

            return { 
                ...prev, 
                [dienteId]: { 
                    ...cur, 
                    [targetZona]: { id: tool.id, color: tool.color } 
                } 
            };
        });

        if (selectedToolId === "borrador") return;

        const label = tool.label;
        const zonaLabel = isGeneralTool ? "Pieza Completa" : getClinicalZonaLabel(dienteId, targetZona);
        const fullDescription = isGeneralTool ? label : `${label} - ${zonaLabel}`;
        
        setPlanTratamiento(prev => [...prev,
            { 
                diente: dienteId, 
                zona: (isGeneralTool || targetZona === "Completo") ? "Completo" : targetZona,
                zonaLabel: zonaLabel, 
                tratamiento: fullDescription, 
                color: tool.color, 
                estado: "Planificado", 
                fechaISO: new Date().toISOString(),
                toolId: tool.id
            }
        ]);
    };

    const handleSurfaceFilterChange = (newSurfaceId) => {
        const nextSurface = surfaceFilter === newSurfaceId ? null : newSurfaceId;
        setSurfaceFilter(nextSurface);
        setActiveToothId(null);
    };

    const handleSave = async (finalizar = false) => {
        if (!currentSesion?.id) return;
        setSaving(true);
        try {
            const ref = doc(db, "pacientes", embeddedPatient.id, "odontogramas", currentSesion.id);
            await setDoc(ref, {
                data: odontogramaData, plan: planTratamiento,
                observaciones, updatedAt: serverTimestamp(),
                ...(finalizar ? { estado: "Finalizado" } : {})
            }, { merge: true });

            // Sincronización con Plan de Tratamiento Centralizado
            if (finalizar && planTratamiento.length > 0) {
                const tratamientosRef = collection(db, "pacientes", embeddedPatient.id, "tratamientos_pendientes");
                for (const item of planTratamiento) {
                    await addDoc(tratamientosRef, {
                        ...item,
                        odontogramaId: currentSesion.id,
                        fechaFinalizacion: serverTimestamp(),
                        estado: "Pendiente", // Para que Tesorería lo vea
                        valor: 0, // Se definirá en Caja o por catálogo
                        creadoPor: embeddedPatient.creadorEmail || "Doctor"
                    });
                }
            }

            toast?.success(finalizar ? "✅ Sesión finalizada y sincronizada con el Plan" : "✅ Guardado correctamente");
            if (finalizar) { setViewMode("LIST"); loadSesiones(); }
        } catch (e) { 
            console.error(e);
            toast?.error("Error al guardar"); 
        }
        finally { setSaving(false); }
    };

    const handleDeleteItem = (idx) => {
        const item = planTratamiento[idx];
        setPlanTratamiento(prev => prev.filter((_, i) => i !== idx));
        setOdontogramaData(prev => {
            const c = { ...(prev[item.diente] || {}) };
            const isGeneral = [
                "ausente", "extraccion", "implante_bueno", "implante_malo", 
                "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
                "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
            ].includes(item.toolId);

            if (item.zona === "Completo" || isGeneral || (c.general && c.general.id === item.toolId)) {
                delete c.general;
            } else {
                delete c[item.zona];
            }
            return { ...prev, [item.diente]: c };
        });
    };

    const isReadOnly = currentSesion?.estado === "Finalizado";
    const filtered = sesiones.filter(s =>
        !search || (s.creadoPor || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.profesional || "").toLowerCase().includes(search.toLowerCase())
    );

    if (viewMode === "LIST") {
        return (
            <div className="flex flex-col h-full bg-white animate-fadeIn">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">
                            Historial de <span className="text-indigo-600">Odontogramas</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <FiClock size={10} className="text-indigo-400" />
                            Registro clínico cronológico — {embeddedPatient?.nombreCompleto}
                        </p>
                    </div>
                    <button
                        onClick={handleNuevo}
                        className="flex items-center gap-2 px-6 py-3 rounded-[18px] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all"
                    >
                        <FiPlus size={16} strokeWidth={3} />
                        Nuevo Odontograma
                    </button>
                </header>

                <div className="px-8 py-3 border-b border-slate-50 flex items-center gap-3 bg-slate-50/40">
                    <div className="relative flex-1 max-w-xs">
                        <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por profesional o usuario..."
                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 bg-white outline-none focus:border-indigo-300 transition-colors"
                        />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-auto">
                        {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-12 px-8 py-3 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <div className="col-span-3 flex items-center gap-1"><FiCalendar size={10} /> Fecha de Sesión</div>
                        <div className="col-span-3">Creado por</div>
                        <div className="col-span-3">Profesional a cargo</div>
                        <div className="col-span-1">Estado</div>
                        <div className="col-span-2 text-right">Acciones</div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <div className="w-8 h-8 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin" style={{ border: "3px solid #f1f5f9", borderTopColor: "#4f46e5" }} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Cargando...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                            <FiCalendar size={40} className="mb-4 opacity-50" />
                            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Sin registros clínicos</div>
                            <div className="text-[10px] text-slate-300 mb-6">Inicia el primer registro para este paciente</div>
                            <button onClick={handleNuevo} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">
                                + Crear primer odontograma
                            </button>
                        </div>
                    ) : filtered.map((s, idx) => {
                        const fecha = s.creado?.toDate ? s.creado.toDate() : new Date();
                        const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        const finalizado = s.estado === "Finalizado";

                        return (
                            <div
                                key={s.id}
                                className="grid grid-cols-12 items-center px-8 py-4 border-b border-slate-50 hover:bg-indigo-50/20 transition-colors group"
                            >
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-100">
                                        <FiCalendar size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-slate-800 tracking-tight">{fechaStr}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{horaStr}</div>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[180px]">
                                        {s.creadoPor || "usuario@sistema.com"}
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[180px]">
                                        {s.profesional || "Profesional de Planta"}
                                    </div>
                                </div>

                                <div className="col-span-1">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${finalizado
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                        : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${finalizado ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"}`} />
                                        {s.estado || "Abierto"}
                                    </span>
                                </div>

                                <div className="col-span-2 flex justify-end gap-2">
                                    <button
                                        onClick={() => setFirmaModal(s)}
                                        title="Firma y huella paciente"
                                        className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center hover:bg-cyan-100 transition-all"
                                    >
                                        <FiFeather size={14} />
                                    </button>
                                    <button
                                        onClick={() => abrirEditor(s)}
                                        title={finalizado ? "Ver" : "Editar"}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${finalizado
                                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                        }`}
                                    >
                                        {finalizado ? <FiEye size={14} /> : <FiEdit3 size={14} />}
                                    </button>
                                     <button
                                         onClick={() => setPrintingSesion(s)}
                                         title="Imprimir / PDF"
                                         className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all"
                                     >
                                         <FiPrinter size={14} />
                                     </button>
                                    <button
                                        onClick={() => handleEliminar(s.id)}
                                        title="Eliminar"
                                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all"
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <footer className="h-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-8">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""} clínica{sesiones.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Motor Clínico v4.0 Elite
                    </span>
                </footer>

                {firmaModal && (
                    <FirmaHuellaModal
                        sesion={firmaModal}
                        paciente={embeddedPatient}
                        planTratamiento={firmaModal.plan || []}
                        onClose={() => setFirmaModal(null)}
                        onGuardar={async ({ firmaDataUrl, huellaImg }) => {
                            try {
                                const ref = doc(db, "pacientes", embeddedPatient.id, "odontogramas", firmaModal.id);
                                await setDoc(ref, {
                                    firmaUrl: firmaDataUrl || null,
                                    huellaUrl: huellaImg || null,
                                    firmadoEn: serverTimestamp(),
                                }, { merge: true });
                                toast?.success("✅ Firma y huella guardadas");
                                setFirmaModal(null);
                                loadSesiones();
                            } catch {
                                toast?.error("Error al guardar firma");
                            }
                        }}
                    />
                )}

                {printingSesion && (
                    <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "900px" }} ref={printTargetRef}>
                        <OdontogramaVisual
                            odontogramaData={printingSesion.data || {}}
                            tipoDenticion="completo"
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden animate-fadeIn">
            <header className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 bg-white sticky top-0 z-20 flex-wrap">
                <button
                    onClick={() => { setViewMode("LIST"); loadSesiones(); }}
                    className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                >
                    <FiChevronLeft size={18} />
                </button>

                <div>
                    <div className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none">
                        Odontograma <span className="text-indigo-600">Clínico</span>
                        {isReadOnly && (
                            <span className="ml-2 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">FINALIZADO</span>
                        )}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {embeddedPatient?.nombreCompleto} • {planTratamiento.length} hallazgo{planTratamiento.length !== 1 ? "s" : ""}
                    </div>
                </div>

                <div className="flex-1" />

                {/* Selector de Dentición Profesional */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    {[
                        { id: 'adulto', label: 'Permanente', icon: '🦷' },
                        { id: 'nino', label: 'Temporal', icon: '👶' },
                        { id: 'completo', label: 'Mixta', icon: '🌓' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setTipoDenticion(btn.id)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${tipoDenticion === btn.id
                                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                                }`}
                        >
                            <span>{btn.icon}</span>
                            {btn.label}
                        </button>
                    ))}
                </div>

                {!isReadOnly && (
                    <>
                        <button onClick={() => handleSave(false)} disabled={saving} className={`flex items-center gap-2 px-5 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-widest transition-all ${saving ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"}`}>
                            <FiSave size={14} /> {saving ? "..." : "Guardar"}
                        </button>
                        <button onClick={() => handleSave(true)} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-[14px] bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                            <FiCheckCircle size={14} /> Finalizar
                        </button>
                    </>
                )}
                <button onClick={handleImpFoto} title="Guardar como imagen" className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-cyan-50 text-cyan-700 border border-cyan-200 text-[11px] font-black uppercase tracking-widest hover:bg-cyan-100 transition-all">
                    <FiFileText size={14} /> Imp. Foto
                </button>
                <button onClick={handleImprimir} title="Imprimir" className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
                    <FiPrinter size={14} /> Imprimir
                </button>
            </header>

            <div className="flex flex-col xl:flex-row flex-1 overflow-hidden">
                {/* Columna Izquierda: Odontograma + Leyenda que hacen Scroll juntos */}
                <div className="flex-1 flex flex-col bg-white min-w-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                    <div className="w-full flex-shrink-0" ref={odontogramaRef}>
                        <OdontogramaVisual
                            odontogramaData={odontogramaData}
                            onToothClick={isReadOnly ? undefined : handleToothClick}
                            tipoDenticion={tipoDenticion}
                            activeToothId={activeToothId}
                            surfaceFilter={surfaceFilter}
                        />
                    </div>
                    
                    {/* Panel Inferior: Checkboxes, Leyenda y Observaciones */}
                    <div className="px-8 py-6 border-t border-slate-200 bg-white shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-10">
                        {/* Checkboxes de Superficies — funcionan como radio buttons */}
                        <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6">
                            {[
                                { id: 'todas', label: 'Todas las superficies' },
                                { id: 'vestibular', label: 'Vestibular' },
                                { id: 'oclusal', label: 'Oclusal/Incisal' },
                                { id: 'lingual', label: 'Lingual/Palatina' },
                                { id: 'mesial', label: 'Mesial' },
                                { id: 'distal', label: 'Distal' }
                            ].map(surf => (
                                <label key={surf.id} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={surfaceFilter === surf.id}
                                        onChange={() => handleSurfaceFilterChange(surf.id)}
                                        className="w-4 h-4 text-indigo-600 bg-slate-50 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className={`text-[12px] font-bold transition-colors ${surfaceFilter === surf.id ? "text-indigo-700" : "text-slate-700 group-hover:text-slate-900"}`}>{surf.label}</span>
                                </label>
                            ))}
                        </div>

                        {/* Leyenda y Observaciones */}
                        <div className="flex flex-col xl:flex-row gap-6 items-start">
                            {/* Leyenda: 2-3 columnas responsive */}
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-x-8 gap-y-1 bg-slate-50/50 p-4 rounded-[20px] border border-slate-100 shadow-sm w-full">
                                {TOOLS.filter(t => t.id !== "borrador").map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => !isReadOnly && setSelectedToolId(selectedToolId === t.id ? null : t.id)}
                                        disabled={isReadOnly}
                                        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left ${
                                            selectedToolId === t.id
                                                ? "bg-white shadow-sm ring-1 ring-indigo-200"
                                                : "hover:bg-white/70 disabled:hover:bg-transparent"
                                        }`}
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 shrink-0 shadow-sm overflow-hidden" style={{ color: t.color }}>
                                            {t.icon}
                                        </div>
                                        <span className={`text-[10px] md:text-[11px] font-semibold truncate ${selectedToolId === t.id ? "text-indigo-800 font-bold" : "text-slate-600"}`}>
                                            {t.label}
                                        </span>
                                    </button>
                                ))}
                                {/* Borrador */}
                                <button
                                    onClick={() => !isReadOnly && setSelectedToolId(selectedToolId === "borrador" ? null : "borrador")}
                                    disabled={isReadOnly}
                                    className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left col-span-full mt-2 border-t border-slate-100 pt-3 ${
                                        selectedToolId === "borrador" ? "bg-white shadow-sm ring-1 ring-slate-300" : "hover:bg-white/70"
                                    }`}
                                >
                                    <div className="w-5 h-5 rounded-full bg-slate-300 shrink-0 shadow-sm" />
                                    <span className="text-[11px] font-semibold text-slate-600">Borrador General</span>
                                </button>
                            </div>

                            {/* Campo de Observaciones */}
                            <div className="w-full xl:w-[260px] flex-shrink-0">
                                <label className="text-[12px] font-black text-slate-800 tracking-tight block mb-2">Observaciones Clínicas:</label>
                                <textarea
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full rounded-[14px] border-2 border-slate-200 px-4 py-3 text-[12px] text-slate-700 resize-y min-h-[140px] outline-none focus:border-indigo-400 transition-colors bg-white shadow-inner"
                                    placeholder="Detalles sobre los hallazgos..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plan de tratamiento lateral/inferior */}
                <div className="w-full xl:w-80 flex-shrink-0 border-t xl:border-t-0 xl:border-l border-slate-100 flex flex-col bg-slate-50/30">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                        <FiFileText size={15} className="text-indigo-500" />
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Plan de Tratamiento</span>
                        <span className="ml-auto bg-slate-100 rounded-full px-2 py-0.5 text-[10px] font-black text-slate-500">{planTratamiento.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {planTratamiento.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                                <span className="text-3xl mb-3">🦷</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">Sin hallazgos</span>
                            </div>
                        ) : planTratamiento.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 group hover:border-slate-200 transition-colors">
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color || "#94a3b8", flexShrink: 0 }} />
                                <span className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-700 flex-shrink-0">
                                    {item.diente}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-slate-800 truncate">{item.tratamiento}</div>
                                </div>
                                {!isReadOnly && (
                                    <button 
                                        onClick={() => handleDeleteItem(idx)} 
                                        className="text-rose-400 hover:text-rose-600 hover:scale-110 active:scale-95 transition-all flex-shrink-0 p-1.5"
                                        title="Eliminar del plan"
                                    >
                                        <FiTrash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-slate-100">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Presupuesto</div>
                        <div className="text-[12px] font-black text-slate-800 mb-4">Por definir</div>
                        {!isReadOnly && (
                            <button onClick={() => handleSave(false)} disabled={saving} className={`w-full py-3 rounded-[14px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${saving ? "bg-slate-100 text-slate-400" : "bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200"}`}>
                                <FiSave size={15} /> {saving ? "Guardando..." : "Guardar"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
