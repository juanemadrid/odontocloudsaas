// src/modules/config/ImportadorListaPrecios.jsx
import React, { useState } from "react";
import * as XLSX from "xlsx";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
    FiUploadCloud, FiFileText, FiCheckCircle, FiX,
    FiAlertCircle, FiRefreshCw, FiArrowRight, FiCheck, FiFolder
} from "react-icons/fi";

const genId = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2);

export default function ImportadorListaPrecios({ onComplete, onClose, activeTab = "clinicos" }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [fileName, setFileName] = useState("");
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, valid: 0 });
    const [listName, setListName] = useState(`IMPORTACIÓN ${new Date().toLocaleDateString('es-CO')}`);
    const [mappingReport, setMappingReport] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (!json || json.length === 0) {
                    alert("⚠️ El archivo seleccionado parece estar vacío.");
                    setFileData([]);
                    return;
                }

                // Normalizador de llaves
                const normalizeKey = (k) => String(k).toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "");

                const rowKeys = Object.keys(json[0] || {});

                const findBestMatch = (keywords, exacts = []) => {
                    const exactMatch = rowKeys.find(k => exacts.includes(normalizeKey(k)));
                    if (exactMatch) return exactMatch;
                    return rowKeys.find(k => keywords.some(p => normalizeKey(k).includes(p)));
                };

                const headerMapping = {
                    categoria: findBestMatch(["cat", "seccion", "grupo"], ["categoria", "cat"]),
                    codigo: findBestMatch(["cod", "ref", "cups", "id"], ["codigo", "cups", "cod"]),
                    nombre: findBestMatch(["procedimiento", "descripcion", "producto", "nombre"], ["nombre", "procedimiento", "procedimientos", "tratamientonombre"]),
                    permite_descuento: findBestMatch(["descuento", "desc", "permitedesc"], ["permitedescuento", "permitedesc"]),
                    max_descuento_porcentaje: findBestMatch(["maxporc", "porcentajedesc"], ["maxdescuentoporcentaje", "porcentajedescuento"]),
                    max_descuento_valor: findBestMatch(["maxval", "valordesc"], ["maxdescuentovalor", "valordescuento"]),
                    precio: findBestMatch(["valor", "costo", "total", "precio"], ["precio"]),
                    pago_fijo_doctor: findBestMatch(["pagofijo", "honorario"], ["pagofijodoctor"]),
                    genera_rips: findBestMatch(["generarips", "rips"], ["generarips"]),
                    es_consulta: findBestMatch(["esconsulta", "consulta"], ["esconsulta"]),
                    agenda_ver: findBestMatch(["veragenda", "verenlaagenda", "verenagend"], ["veragenda", "verenlaagenda"]),
                    agenda_nombre: findBestMatch(["nombreagenda", "nombreenlaagenda"], ["nombreagenda", "nombreenlaagenda"]),
                    tiempo: findBestMatch(["duracion", "minutos", "tiempo"], ["tiempo", "mins"]),
                    identificador_agenda: findBestMatch(["identificador"], ["identificador"]),
                    observaciones: findBestMatch(["obs", "nota", "comentario"], ["observaciones"])
                };

                setMappingReport(headerMapping);

                const isPositive = (val) => {
                    if (val === undefined || val === null) return false;
                    const s = String(val).toLowerCase().trim();
                    return ["si", "yes", "1", "true", "s", "y", "sí"].includes(s);
                };

                const mapped = json.map(row => {
                    const nombreVal = row[headerMapping.nombre] || "";
                    const codigoVal = row[headerMapping.codigo] || "";
                    const precioRaw = String(row[headerMapping.precio] || "0").replace(/[^0-9.-]+/g, "");
                    const pagoFijoRaw = String(row[headerMapping.pago_fijo_doctor] || "0").replace(/[^0-9.-]+/g, "");

                    return {
                        categoria: (String(row[headerMapping.categoria] || "GENERAL")).toUpperCase().trim(),
                        codigo: String(codigoVal).trim(),
                        nombre: String(nombreVal).trim(),
                        precio: Number(precioRaw) || 0,
                        permite_descuento: isPositive(row[headerMapping.permite_descuento]),
                        max_descuento_porcentaje: Number(row[headerMapping.max_descuento_porcentaje]) || 0,
                        max_descuento_valor: Number(String(row[headerMapping.max_descuento_valor] || 0).replace(/[^0-9.-]+/g, "")) || 0,
                        pago_fijo_doctor: Number(pagoFijoRaw) || 0,
                        usar_pago_fijo: Number(pagoFijoRaw) > 0,
                        genera_rips: isPositive(row[headerMapping.genera_rips]),
                        es_consulta: isPositive(row[headerMapping.es_consulta]),
                        ver_en_agenda: isPositive(row[headerMapping.agenda_ver]),
                        nombre_agenda: String(row[headerMapping.agenda_nombre] || "").trim(),
                        tiempo: Number(row[headerMapping.tiempo]) || 30,
                        identificador_agenda: String(row[headerMapping.identificador_agenda] || "").trim(),
                        observaciones: String(row[headerMapping.observaciones] || "").trim(),
                    };
                }).filter(p => p.nombre.length > 0);

                setFileData(mapped);
                setStats({
                    total: json.length,
                    valid: mapped.length
                });
            } catch (err) {
                console.error("Error al procesar archivo:", err);
                alert("❌ No se pudo leer el archivo Excel/CSV. Verifica que el formato sea correcto.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // ── Guardar datos en Supabase ──
    const handleImport = async () => {
        if (fileData.length === 0) return;
        if (activeTab !== "productos" && activeTab !== "servicios" && !listName.trim()) {
            return alert("El nombre de la lista es obligatorio.");
        }

        if (!inquilino) {
            return alert("❌ No se detectó la clínica activa. Inicia sesión nuevamente.");
        }

        setLoading(true);

        try {
            if (activeTab === "productos" || activeTab === "servicios") {
                // Insertar directamente a la tabla inventario en Supabase
                const rowsToInsert = fileData.map(item => ({
                    tenant_id: inquilino,
                    nombre: item.nombre,
                    codigo: item.codigo || "",
                    categoria: item.categoria || "GENERAL",
                    precio_venta: item.precio || 0,
                    costo: 0,
                    stock: 0,
                    es_servicio: activeTab === "servicios"
                }));

                // Chunks de 200 en 200 para inserciones masivas seguras
                for (let i = 0; i < rowsToInsert.length; i += 200) {
                    const chunk = rowsToInsert.slice(i, i + 200);
                    const { error } = await supabase.from("inventario").insert(chunk);
                    if (error) throw error;
                }

                if (toast?.success) toast.success(`✅ ${fileData.length} ${activeTab} importados exitosamente.`);
                else alert(`✅ ${fileData.length} ${activeTab} importados exitosamente en la base de datos.`);
            } else {
                // Importar a listas_precios (guardando items como JSON en descripcion)
                const itemsFormatted = fileData.map(item => ({
                    id: genId(),
                    nombre: item.nombre,
                    codigo: item.codigo || "",
                    categoria: item.categoria || "GENERAL",
                    precio: Number(item.precio) || 0,
                    permite_descuento: Boolean(item.permite_descuento),
                    max_descuento_porcentaje: Number(item.max_descuento_porcentaje) || 0,
                    max_descuento_valor: Number(item.max_descuento_valor) || 0,
                    pago_fijo_doctor: Number(item.pago_fijo_doctor) || 0,
                    usar_pago_fijo: Boolean(item.usar_pago_fijo),
                    genera_rips: Boolean(item.genera_rips),
                    es_consulta: Boolean(item.es_consulta),
                    ver_en_agenda: Boolean(item.ver_en_agenda),
                    nombre_agenda: item.nombre_agenda || "",
                    tiempo: Number(item.tiempo) || 30,
                    identificador_agenda: item.identificador_agenda || "",
                    observaciones: item.observaciones || ""
                }));

                const { error } = await supabase.from("listas_precios").insert([{
                    nombre: listName.trim(),
                    tenant_id: inquilino,
                    descripcion: JSON.stringify(itemsFormatted),
                    activa: true
                }]);

                if (error) throw error;

                if (toast?.success) toast.success(`✅ Lista "${listName}" creada con ${fileData.length} procedimientos en Supabase.`);
                else alert(`✅ Lista "${listName}" creada con ${fileData.length} procedimientos en la base de datos.`);
            }

            onComplete && onComplete();
            onClose();
        } catch (err) {
            console.error("Error al guardar en Supabase:", err);
            alert("❌ Error al guardar en la base de datos: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">

                {/* ── Modal Header ── */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                            <FiUploadCloud size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Importar Lista de Precios</h3>
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Soporta formatos Excel (.xlsx, .xls) y CSV</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all">&times;</button>
                </div>

                {/* ── Modal Body ── */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">

                    {/* Nombre de la lista */}
                    {activeTab !== "productos" && activeTab !== "servicios" && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre de la nueva lista *</label>
                            <input
                                type="text"
                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                value={listName}
                                onChange={(e) => setListName(e.target.value)}
                                placeholder="EJ: TARIFAS INSTITUCIONALES 2026"
                            />
                        </div>
                    )}

                    {/* File Dropzone */}
                    {!fileData.length ? (
                        <div className="relative group cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="border-2 border-dashed border-blue-200 group-hover:border-blue-500 group-hover:bg-blue-50/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-all duration-300 bg-blue-50/10">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md border border-blue-100 group-hover:scale-110 transition-transform duration-300">
                                    <FiFileText className="text-3xl text-blue-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Haz clic para seleccionar o arrastra el archivo</p>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Excel (.xlsx, .xls) o CSV — Máximo 10MB</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* File Status Card */}
                            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                        <FiFileText size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 truncate max-w-[280px]">{fileName}</p>
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{stats.valid} registros válidos detectados</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFileData([]); setFileName(""); }}
                                    className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                                >
                                    Cambiar archivo
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Filas Leídas</span>
                                    <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Listos para Cargar en BD</span>
                                    <span className="text-2xl font-black text-emerald-700">{stats.valid}</span>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <FiCheckCircle className="text-emerald-500" size={14} /> Vista previa de datos ({Math.min(fileData.length, 50)} de {fileData.length})
                                    </span>
                                </div>
                                <div className="max-h-52 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider">Categoría</th>
                                                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider">Código</th>
                                                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider">Procedimiento / Ítem</th>
                                                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-right">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {fileData.slice(0, 50).map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-2.5 font-bold text-slate-500 uppercase">{row.categoria}</td>
                                                    <td className="px-4 py-2.5 font-mono text-slate-600">{row.codigo || '-'}</td>
                                                    <td className="px-4 py-2.5 font-bold text-slate-800 uppercase">{row.nombre}</td>
                                                    <td className="px-4 py-2.5 font-black text-blue-600 text-right">${row.precio.toLocaleString('es-CO')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer Actions ── */}
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || !fileData.length || stats.valid === 0}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <FiRefreshCw size={14} className="animate-spin" /> Guardando en Supabase...
                            </>
                        ) : (
                            <>
                                <FiCheck size={16} /> Procesar {stats.valid} Ítems Ahora
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
