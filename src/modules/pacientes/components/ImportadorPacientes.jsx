import React, { useState } from "react";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { FiDownload, FiUpload, FiUsers } from "react-icons/fi";

// Utility to load XLSX library dynamically
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

export default function ImportadorPacientes({ onComplete, onClose }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, valid: 0 });
    const [progress, setProgress] = useState({ current: 0, total: 0, active: false });

    const normalizePatientRecord = (row) => {
        // 1. Names
        const nombres = String(row["Nombre"] || row["Nombres"] || row["nombres"] || "").trim();
        const apellidos = String(row["Apellido"] || row["Apellidos"] || row["apellidos"] || "").trim();
        const nombreCompleto = row["nombreCompleto"] || row["Nombre completo"] || `${nombres} ${apellidos}`.trim();

        // 2. Document
        const rawDoc = String(row["Documento"] || row["nroDocumento"] || row["Documento Identidad"] || row["Identificación"] || "");
        const cleanDoc = rawDoc.replace(/\D/g, ""); // Clean formatting (dots, spaces, dashes)

        // 3. Document Type
        let tipoDoc = row["Tipo de documento"] || row["Tipo_Doc"] || row["tipoDocumento"] || "Cédula de ciudadanía";
        const tdLower = tipoDoc.toLowerCase();
        if (tdLower.includes("cédula de ciudadanía") || tdLower.includes("cedula de ciudadania") || tdLower.includes("cédula de identidad") || tdLower.includes("documento nacional")) {
            tipoDoc = "Cédula de ciudadanía";
        } else if (tdLower.includes("tarjeta de identidad")) {
            tipoDoc = "Tarjeta de identidad";
        } else if (tdLower.includes("pasaporte")) {
            tipoDoc = "Pasaporte";
        } else if (tdLower.includes("extranjería") || tdLower.includes("extranjeria")) {
            tipoDoc = "Cédula de extranjería";
        } else if (tdLower.includes("registro civil")) {
            tipoDoc = "Registro civil de nacimiento";
        } else {
            tipoDoc = "Cédula de ciudadanía";
        }

        // 4. Gender
        let sexo = row["Género"] || row["Sexo"] || row["sexo"] || "Otro";
        if (sexo.toLowerCase().startsWith("f")) sexo = "Femenino";
        else if (sexo.toLowerCase().startsWith("m")) sexo = "Masculino";
        else sexo = "Otro";

        // 5. Contact
        const celular = String(row["Celular"] || row["celular"] || "").trim().replace(/\D/g, "");
        const telDomicilio = String(row["Teléfono"] || row["telDomicilio"] || "").trim().replace(/\D/g, "");
        const telOficina = String(row["Teléfono oficina"] || row["telOficina"] || "").trim().replace(/\D/g, "");
        const extension = String(row["Extensión oficina"] || row["extension"] || "").trim();

        // 6. Dates (Birthdate & ingreso)
        let fechaNacimiento = "";
        const rawBirth = row["Fecha de nacimiento"] || row["Fecha_Nacimiento"] || row["fechaNacimiento"] || "";
        if (rawBirth) {
            if (typeof rawBirth === "string") {
                const parts = rawBirth.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) {
                        fechaNacimiento = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                    } else {
                        fechaNacimiento = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                    }
                }
            } else if (rawBirth instanceof Date) {
                fechaNacimiento = rawBirth.toISOString().split("T")[0];
            } else if (typeof rawBirth === "number") {
                const date = new Date((rawBirth - 25569) * 86400000);
                fechaNacimiento = date.toISOString().split("T")[0];
            }
        }

        let fechaIngreso = "";
        const rawIngreso = row["Fecha hora ingreso"] || "";
        if (rawIngreso) {
            const datePart = String(rawIngreso).split(" ")[0];
            const parts = datePart.split(/[\/\-]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    fechaIngreso = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                } else {
                    fechaIngreso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
            }
        }
        if (!fechaIngreso) {
            fechaIngreso = new Date().toISOString().split("T")[0];
        }

        // 7. Residence
        const direccion = row["Dirección"] || row["Direccion"] || row["lugarResidencia"] || "";
        const barrio = row["Barrio"] || row["barrio"] || "";
        const estrato = String(row["Estrato"] || row["estrato"] || "").trim();

        let zonaResidencial = "Urbano";
        const rawZona = String(row["Zona residencial"] || row["zonaResidencial"] || "").trim();
        if (rawZona === "2" || rawZona.toLowerCase().includes("rural")) {
            zonaResidencial = "Rural";
        }

        // 8. Civil State
        let estadoCivil = "Soltero";
        const rawCivil = String(row["Estado civil"] || row["estadoCivil"] || "").trim();
        if (rawCivil === "2" || rawCivil.toLowerCase().includes("casado")) estadoCivil = "Casado";
        else if (rawCivil === "3" || rawCivil.toLowerCase().includes("libre")) estadoCivil = "Unión libre";
        else if (rawCivil === "4" || rawCivil.toLowerCase().includes("divorciado")) estadoCivil = "Divorciado";
        else if (rawCivil === "5" || rawCivil.toLowerCase().includes("viudo")) estadoCivil = "Viudo";

        // 9. Marketing & EPS
        const remitidoPor = row["Remitido por"] || row["remitidoPor"] || "";
        const comoConocio = row["Cómo nos conoció"] || row["comoConocio"] || "";
        const campania = row["Campaña"] || row["campania"] || "";
        const asesorComercial = row["Asesor comercial"] || row["asesorComercial"] || "";
        const convenio = row["Convenio"] || "";
        const convenioBeneficio = row["Convenio beneficio"] || "";
        const convenioPago = row["Convenio de pago"] || "";

        const eps = row["Eps"] || row["nombreEps"] || "";
        const tipoAfiliacion = row["Tipo de afiliación"] || row["tipoVinculacion"] || "";
        const polizaSalud = row["Póliza de salud"] || row["polizaSalud"] || "";
        const sgsss = row["Sgsss"] || "";
        const tipoPaciente = row["Tipo de paciente"] || "";

        // Responsable
        const nombreResponsable = row["Nombre del responsable"] || row["nombreResponsable"] || "";
        const parentesco = row["Relación con responsable"] || row["parentesco"] || "";
        const celularResponsable = String(row["Celular responsable"] || row["celularResponsable"] || "").trim().replace(/\D/g, "");
        const telefonoResponsable = String(row["Teléfono responsable"] || row["telefonoResponsable"] || "").trim().replace(/\D/g, "");
        const emailResponsable = String(row["Correo responsable"] || row["emailResponsable"] || "").trim().toLowerCase();

        // Acompañante
        const nombreAcompanante = row["Nombre acompañante"] || row["nombreAcompanante"] || "";
        const telefonoAcompanante = String(row["Teléfono acompañante"] || row["telefonoAcompanante"] || "").trim().replace(/\D/g, "");

        // 10. Age
        let edad = "";
        if (fechaNacimiento) {
            const birth = new Date(fechaNacimiento);
            const today = new Date();
            let calcAge = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) calcAge--;
            if (!isNaN(calcAge)) edad = String(calcAge);
        }

        return {
            fechaHoraIngreso: row["Fecha hora ingreso"] || "",
            fechaHoraCreacion: row["Fecha hora creación"] || "",
            tipoDocumento: tipoDoc,
            nroDocumento: cleanDoc || rawDoc.trim(),
            nroHistoria: row["Número Historia"] || row["nroHistoria"] || cleanDoc || rawDoc.trim(),
            nombres: (nombres || nombreCompleto.split(" ")[0] || "PACIENTE").toUpperCase(),
            apellidos: (apellidos || nombreCompleto.split(" ").slice(1).join(" ") || "IMPORTADO").toUpperCase(),
            nombreCompleto: nombreCompleto.toUpperCase(),
            sexo,
            rh: row["RH"] || "",
            estadoCivil,
            fechaNacimiento,
            edad,
            paisNacimiento: row["País de nacimiento"] || "Colombia",
            ciudadNacimiento: row["Ciudad de nacimiento"] || "",
            lugarResidencia: direccion || "",
            paisDomicilio: row["País de domicilio"] || "Colombia",
            ciudadDomicilio: row["Ciudad de domicilio"] || "",
            barrio: barrio || "",
            estrato,
            zonaResidencial,
            celular,
            telDomicilio,
            telOficina,
            extension,
            email: String(row["Correo"] || row["Email"] || "").trim().toLowerCase(),
            ocupacion: row["Ocupación"] || "",
            nombreResponsable,
            parentesco,
            celularResponsable,
            telefonoResponsable,
            emailResponsable,
            nombreAcompanante,
            telefonoAcompanante,
            convenio,
            tipoVinculacion: tipoAfiliacion,
            nombreEps: eps,
            polizaSalud,
            sgsss,
            tipoPaciente,
            convenioBeneficio,
            convenioPago,
            comoConocio,
            campania,
            remitidoPor,
            remitidoPorValue: remitidoPor,
            remitidoPorType: "Libre",
            asesorComercial,
            asesorComercialValue: asesorComercial,
            asesorComercialType: "Libre",
            presupuestosCount: String(row["Presupuestos"] || "0"),
            tratamientosIniciadosCount: String(row["Tratamientos iniciados"] || "0"),
            tratamientosNoIniciadosCount: String(row["Tratamientos no iniciados"] || "0"),
            tratamientosFinalizadosCount: String(row["Tratamientos finalizados"] || "0"),
            citasCount: String(row["Citas"] || "0"),
            doctoresAsignados: row["Doctores"] || "",
            proximaCita: row["Próxima Cita"] || "",
            fechaIngreso,
            activo: true,
            importado: true
        };
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const XLSX = await ensureXLSX();
        if (!XLSX) {
            toast.error("Error al cargar la librería de importación");
            setLoading(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target.result;
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: "" });

                if (rawJson.length === 0) {
                    toast.error("El archivo seleccionado está vacío.");
                    setLoading(false);
                    return;
                }

                const mapped = rawJson.map(row => normalizePatientRecord(row));
                setFileData(mapped);
                setStats({
                    total: mapped.length,
                    valid: mapped.filter(p => p.nroDocumento && (p.nombres || p.nombreCompleto)).length
                });
                toast.success(`Archivo procesado: ${mapped.length} registros encontrados.`);
            } catch (err) {
                console.error("Error parsing file:", err);
                toast.error("Error al analizar el archivo Excel/CSV.");
            } finally {
                setLoading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = async () => {
        setLoading(true);
        const XLSX = await ensureXLSX();
        if (!XLSX) {
            toast.error("Error al cargar la librería Excel");
            setLoading(false);
            return;
        }

        // Standard headers matching OralDrive layout for seamless compatibility
        const headers = [
            "Fecha hora ingreso",
            "Fecha hora creación",
            "Tipo de documento",
            "Documento",
            "Número Historia",
            "Nombre",
            "Apellido",
            "Género",
            "RH",
            "Estado civil",
            "Fecha de nacimiento",
            "Edad",
            "País de nacimiento",
            "Ciudad de nacimiento",
            "Dirección",
            "País de domicilio",
            "Ciudad de domicilio",
            "Barrio",
            "Estrato",
            "Zona residencial",
            "Celular",
            "Teléfono",
            "Teléfono oficina",
            "Extensión oficina",
            "Correo",
            "Ocupación",
            "Nombre del responsable",
            "Relación con responsable",
            "Celular responsable",
            "Teléfono responsable",
            "Correo responsable",
            "Nombre acompañante",
            "Teléfono acompañante",
            "Convenio",
            "Tipo de afiliación",
            "Eps",
            "Póliza de salud",
            "Sgsss",
            "Tipo de paciente",
            "Convenio beneficio",
            "Convenio de pago",
            "Cómo nos conoció",
            "Campaña",
            "Remitido por",
            "Asesor comercial",
            "Presupuestos",
            "Tratamientos iniciados",
            "Tratamientos no iniciados",
            "Tratamientos finalizados",
            "Citas",
            "Doctores",
            "Próxima Cita"
        ];

        const sampleRow = [
            "19/06/2024 03:47 PM",
            "19/06/2024 03:47 PM",
            "Cédula de identidad",
            "1103950363",
            "1103950363",
            "Diana Marcela",
            "Serpa Barreto",
            "Femenino",
            "O+",
            "1",
            "25/07/1990",
            "33",
            "Colombia",
            "Sincelejo",
            "Barrio Calle real",
            "Colombia",
            "Betulia",
            "Calle Real",
            "2",
            "1",
            "3146425604",
            "",
            "",
            "",
            "dianaserpa07@gmail.com",
            "Medica",
            "",
            "",
            "",
            "",
            "",
            "N/A",
            "0",
            "",
            "Especiales o de Excepción cotizante",
            "Regimen Especial",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Dr. Elias Samur",
            "",
            "0",
            "1",
            "0",
            "0",
            "3",
            "Guillermo Jose Rodríguez Mercado",
            ""
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

        XLSX.utils.book_append_sheet(wb, ws, "Reporte de pacientes");
        XLSX.writeFile(wb, "plantilla_importador_pacientes.xlsx");

        toast.success("Plantilla de importación descargada");
        setLoading(false);
    };

    const handleImport = async () => {
        if (fileData.length === 0) return;
        setLoading(true);

        const validPatients = fileData.filter(p => p.nroDocumento);
        setProgress({ current: 0, total: validPatients.length, active: true });

        let count = 0;
        try {
            for (const patient of validPatients) {
                const payload = {
                    ...patient,
                    creado: serverTimestamp(),
                    inquilino: userProfile?.inquilino || "",
                    celularPaciente: patient.celular,
                    documento: patient.nroDocumento,
                    paciente: patient.nombreCompleto,
                    facturacion: { saldoFavor: 0 }
                };

                await setDoc(doc(db, "pacientes", patient.nroDocumento), payload);
                count++;
                setProgress(prev => ({ ...prev, current: count }));
            }
            toast.success(`Se importaron ${count} pacientes correctamente.`);
            onComplete && onComplete();
            onClose();
        } catch (err) {
            console.error("Error importing patients:", err);
            toast.error("Ocurrió un error al importar los pacientes.");
        } finally {
            setLoading(false);
            setProgress(prev => ({ ...prev, active: false }));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <FiUsers size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase text-slate-800 tracking-wider">Importador de Pacientes</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Soporte Excel (.xlsx, .xls) y CSV</p>
                        </div>
                    </div>
                    <button 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors border-0" 
                        onClick={onClose} 
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                    <p className="text-xs text-slate-500 font-medium leading-relaxed font-sans">
                        Sube tu base de datos de pacientes exportada directamente desde **OralDrive** o en cualquier formato Excel/CSV. 
                        El sistema mapeará automáticamente los nombres, apellidos, tipo de identificación, dirección, celular y EPS.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        <button 
                            type="button"
                            onClick={handleDownloadTemplate} 
                            disabled={loading}
                            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-5 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest flex items-center gap-2.5 transition-all cursor-pointer"
                        >
                            <FiDownload size={16} /> Descargar Plantilla
                        </button>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                            id="import-excel-file-upload"
                            disabled={loading}
                        />
                        <label 
                            htmlFor="import-excel-file-upload" 
                            className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest flex items-center gap-2.5 cursor-pointer shadow-lg shadow-blue-500/10 transition-all"
                        >
                            <FiUpload size={16} /> Seleccionar Archivo
                        </label>
                    </div>

                    {fileData.length > 0 && (
                        <div className="bg-slate-50 rounded-[18px] border border-slate-100 p-5 space-y-4 font-sans">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                    Previsualización de datos
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${stats.valid === stats.total ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {stats.valid} / {stats.total} registros listos
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200/50 bg-white">
                                <table className="min-w-full text-left text-[11px] border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500">Documento</th>
                                            <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500">Nombre Completo</th>
                                            <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500">Celular</th>
                                            <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500">Correo</th>
                                            <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500">EPS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {fileData.slice(0, 5).map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-2.5 font-mono font-medium text-slate-700">{p.nroDocumento || <span className="text-rose-500 font-bold">FALTA DOCUMENTO</span>}</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-800">{p.nombreCompleto}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{p.celular || "—"}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{p.email || "—"}</td>
                                                <td className="px-4 py-2.5 text-slate-600 uppercase">{p.nombreEps || "—"}</td>
                                            </tr>
                                        ))}
                                        {fileData.length > 5 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                                                    ... y {fileData.length - 5} registros más en la lista.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Progress Bar */}
                            {progress.active && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                                            Importando pacientes...
                                        </span>
                                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">
                                            {progress.current} / {progress.total}
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% completado
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            {progress.total - progress.current} restantes
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-[16px] py-3.5 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 border-0 mt-4 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                onClick={handleImport}
                                disabled={loading || stats.valid === 0}
                            >
                                {loading
                                    ? `⏳ Importando ${progress.current} de ${progress.total}...`
                                    : `🚀 Importar ${stats.valid} Pacientes de base de datos`
                                }
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
