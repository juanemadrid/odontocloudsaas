import React, { useState } from "react";
import { FiDownload, FiUpload, FiInfo, FiAlertCircle, FiDatabase, FiUsers, FiBox, FiActivity } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebaseConfig";
import { collection, writeBatch, doc, Timestamp } from "firebase/firestore";

function ensureXLSX() {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && window.XLSX) return resolve(window.XLSX);
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        s.onload = () => resolve(window.XLSX || null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
    });
}

const CARGA_TYPES = [
    {
        id: "pacientes",
        label: "Pacientes",
        description: "Migración masiva de expedientes (Identificación, nombres, celular, correo y demografía).",
        collection: "pacientes",
        icon: FiUsers
    },
    {
        id: "productos",
        label: "Inventario / Productos",
        description: "Carga de catálogo de insumos, códigos de barra, costos y existencias iniciales.",
        collection: "inventario",
        icon: FiBox
    },
    {
        id: "servicios",
        label: "Servicios / Procedimientos",
        description: "Actualización de listas de precios, honorarios y códigos de procedimientos.",
        collection: "servicios_clinica",
        icon: FiActivity
    },
];

export default function ConfigCargas() {
    const toast = useToast();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [showWarning, setShowWarning] = useState(true);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const getHeaders = (type) => {
        switch (type) {
            case "pacientes":
                return ["Documento", "Tipo_Doc", "Nombres", "Apellidos", "Celular", "Email", "Fecha_Nacimiento", "Sexo", "Direccion"];
            case "productos":
                return ["Codigo", "Nombre", "Costo", "Stock_Actual", "Stock_Minimo"];
            case "servicios":
                return ["Codigo", "Nombre", "Precio_Venta", "Categoria"];
            default:
                return ["Columna1", "Columna2"];
        }
    };

    const handleDownload = async (item) => {
        setLoading(true);
        const XLSX = await ensureXLSX();
        if (!XLSX) {
            if (toast?.error) toast.error("Error al cargar librería Excel");
            setLoading(false);
            return;
        }

        const headers = getHeaders(item.id);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);

        XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
        XLSX.writeFile(wb, `Plantilla_${item.label}.xlsx`);

        if (toast?.success) toast.success(`Plantilla de ${item.label} descargada`);
        setLoading(false);
    };

    const handleUploadClick = (inputId) => {
        document.getElementById(inputId).click();
    };

    const processFile = async (file, item) => {
        if (!inquilino) {
            if (toast?.error) toast.error("No se identificó la clínica/tenant");
            return;
        }

        const XLSX = await ensureXLSX();
        if (!XLSX) return;

        setLoading(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    if (toast?.error) toast.error("El archivo seleccionado está vacío");
                    setLoading(false);
                    return;
                }

                if (window.confirm(`¿Está seguro de importar ${jsonData.length} registros a ${item.label}?`)) {
                    await uploadToFirestore(jsonData, item);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (toast?.error) toast.error("Error al procesar el archivo Excel");
                setLoading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const uploadToFirestore = async (data, item) => {
        const total = data.length;
        setProgress({ current: 0, total });

        try {
            const BATCH_SIZE = 400;
            let count = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = data.slice(i, i + BATCH_SIZE);

                chunk.forEach((row) => {
                    const docRef = doc(collection(db, item.collection));

                    let payload = {
                        inquilino,
                        importado: true,
                        createdAt: Timestamp.now()
                    };

                    if (item.id === "pacientes") {
                        payload = {
                            ...payload,
                            nroDocumento: String(row.Documento || ""),
                            tipoDocumento: row.Tipo_Doc || "CC",
                            nombres: String(row.Nombres || "").toUpperCase(),
                            apellidos: String(row.Apellidos || "").toUpperCase(),
                            nombreCompleto: `${row.Nombres || ""} ${row.Apellidos || ""}`.trim().toUpperCase(),
                            celular: String(row.Celular || ""),
                            email: String(row.Email || "").toLowerCase(),
                            sexo: String(row.Sexo || "").toUpperCase(),
                            lugarResidencia: row.Direccion || "",
                            activo: true,
                            facturacion: { saldoFavor: 0 }
                        };
                    } else if (item.id === "productos") {
                        payload = {
                            ...payload,
                            codigo: String(row.Codigo || ""),
                            nombre: String(row.Nombre || "").toUpperCase(),
                            costo: Number(row.Costo || 0),
                            cantidad: Number(row.Stock_Actual || 0),
                            minStock: Number(row.Stock_Minimo || 5)
                        };
                    } else if (item.id === "servicios") {
                        payload = {
                            ...payload,
                            codigo: String(row.Codigo || ""),
                            nombre: String(row.Nombre || "").toUpperCase(),
                            precio: Number(row.Precio_Venta || 0),
                            categoria: String(row.Categoria || "GENERAL").toUpperCase()
                        };
                    }

                    batch.set(docRef, payload);
                });

                await batch.commit();
                count += chunk.length;
                setProgress({ current: count, total });
            }

            if (toast?.success) toast.success(`¡Importación exitosa! ${total} registros cargados correctamente.`);
        } catch (err) {
            console.error(err);
            if (toast?.error) toast.error("Error durante el cargue a la base de datos");
        } finally {
            setLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Warning Overlay Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                            <FiAlertCircle size={28} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-slate-800">Control de Integridad de Datos</h3>
                            <p className="text-[12px] text-slate-500 mt-1">
                                Para evitar duplicidad de expedientes o inconsistencias en inventario, verifique la estructura del archivo Excel antes de ejecutar el cargue.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowWarning(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[12px] transition-colors cursor-pointer border-0"
                        >
                            Comprendido, Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiDatabase size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Cargas Masivas de Datos</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Migración e importación masiva de expedientes, catálogo de inventario y tarifas</p>
                    </div>
                </div>

                {loading && progress.total > 0 && (
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 text-[11px] font-bold text-blue-700">
                        <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                        <span>Procesando: {progress.current} / {progress.total}</span>
                    </div>
                )}
            </div>

            {/* Import Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CARGA_TYPES.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
                            <div className="space-y-2">
                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <IconComponent size={18} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">{item.label}</h3>
                                <p className="text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
                            </div>

                            <div className="pt-2 flex gap-2">
                                {/* Download Template Button */}
                                <button
                                    onClick={() => handleDownload(item)}
                                    disabled={loading}
                                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <FiDownload size={13} />
                                    <span>Plantilla</span>
                                </button>

                                {/* Upload File Button */}
                                <input
                                    id={`file-${item.id}`}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => processFile(e.target.files[0], item)}
                                />
                                <button
                                    onClick={() => handleUploadClick(`file-${item.id}`)}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-[11px] font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0 disabled:opacity-50"
                                >
                                    <FiUpload size={13} />
                                    <span>Cargar Archivo</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Smart Import Guide Footer */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <FiInfo size={15} />
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-800 block">Recomendaciones para el cargue masivo:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                        <li>Utilice la plantilla oficial en formato Excel (.xlsx) descargable en cada sección.</li>
                        <li>Verifique que las columnas no contengan celdas combinadas ni fórmulas calculadas.</li>
                        <li>Los documentos de identidad y códigos de productos deben ser únicos para evitar registros duplicados.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
