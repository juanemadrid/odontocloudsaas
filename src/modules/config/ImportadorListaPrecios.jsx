
import React, { useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { FiUploadCloud, FiFileText, FiCheckCircle, FiX, FiAlertCircle } from "react-icons/fi";

export default function ImportadorListaPrecios({ onComplete, onClose, activeTab }) {
    const { userProfile } = useAuth();
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, valid: 0 });
    const [listName, setListName] = useState(`IMPORTACIÓN ${new Date().toLocaleDateString('es-CO')}`);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            if (json.length === 0) {
                alert("El archivo parece estar vacío.");
                return;
            }

            // Normalizador de llaves: quita tildes, espacios, mayúsculas y caracteres raros
            const normalizeKey = (k) => String(k).toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");

            const rowKeys = Object.keys(json[0]);
            
            // Priority matching logic
            const findBestMatch = (keywords, exacts = []) => {
                // First try exact matches (after normalization)
                const exactMatch = rowKeys.find(k => exacts.includes(normalizeKey(k)));
                if (exactMatch) return exactMatch;
                
                // Then try partial matches
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
                const precioRaw = String(row[headerMapping.precio] || "0").replace(/[^0-9.-]+/g,"");
                const pagoFijoRaw = String(row[headerMapping.pago_fijo_doctor] || "0").replace(/[^0-9.-]+/g,"");
                
                return {
                    categoria: (String(row[headerMapping.categoria] || "GENERAL")).toUpperCase().trim(),
                    codigo: String(codigoVal).trim(),
                    nombre: String(nombreVal).trim(),
                    search_name: String(nombreVal).toLowerCase().trim(),
                    precio: Number(precioRaw) || 0,
                    permite_descuento: isPositive(row[headerMapping.permite_descuento]),
                    max_descuento_porcentaje: Number(row[headerMapping.max_descuento_porcentaje]) || 0,
                    max_descuento_valor: Number(String(row[headerMapping.max_descuento_valor] || 0).replace(/[^0-9.-]+/g,"")) || 0,
                    pago_fijo_doctor: Number(pagoFijoRaw) || 0,
                    usar_pago_fijo: Number(pagoFijoRaw) > 0,
                    genera_rips: isPositive(row[headerMapping.genera_rips]),
                    es_consulta: isPositive(row[headerMapping.es_consulta]),
                    ver_en_agenda: isPositive(row[headerMapping.agenda_ver]),
                    nombre_agenda: row[headerMapping.agenda_nombre] || "",
                    tiempo: Number(row[headerMapping.tiempo]) || 30,
                    identificador_agenda: row[headerMapping.identificador_agenda] || "",
                    observaciones: row[headerMapping.observaciones] || "",
                    inquilino: userProfile?.inquilino
                };
            });

            setFileData(mapped);
            setStats({
                total: mapped.length,
                valid: mapped.filter(p => p.nombre).length
            });
        };
        reader.readAsArrayBuffer(file);
    };

    const [mappingReport, setMappingReport] = useState(null);

    const handleImport = async () => {
        if (fileData.length === 0) return;
        if (activeTab !== "productos" && !listName.trim()) return;
        
        setLoading(true);

        try {
            const inquilino = userProfile?.inquilino;
            if (!inquilino) throw new Error("No se detectó el identificador de la clínica.");

            if (activeTab === "productos") {
                // Importar directo a catálogo de productos global
                const chunks = [];
                for (let i = 0; i < fileData.length; i += 500) {
                    chunks.push(fileData.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(item => {
                        const productRef = doc(collection(db, "productos")); 
                        batch.set(productRef, {
                            ...item,
                            inquilino,
                            creado: serverTimestamp(),
                            actualizado: serverTimestamp()
                        });
                    });
                    await batch.commit();
                }

                alert(`✅ Importación exitosa: ${fileData.length} productos cargados a tu catálogo maestro.`);
            } else {
                // Importar a una lista de precios (clínica o servicio)
                const newListRef = doc(collection(db, "listas_precios"));
                await setDoc(newListRef, {
                    nombre: listName,
                    tipo: activeTab || "clinicos",
                    inquilino,
                    creado: serverTimestamp(),
                    actualizado: serverTimestamp(),
                    en_uso: false,
                    is_import: true
                });

                const itemsCollection = collection(db, "listas_precios", newListRef.id, "items");
                
                const chunks = [];
                for (let i = 0; i < fileData.length; i += 500) {
                    chunks.push(fileData.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(item => {
                        const itemRef = doc(itemsCollection); 
                        batch.set(itemRef, {
                            ...item,
                            inquilino,
                            creado: serverTimestamp()
                        });
                    });
                    await batch.commit();
                }

                alert(`✅ Importación exitosa: ${fileData.length} ítems cargados en "${listName}".`);
            }
            
            onComplete && onComplete();
            onClose();
        } catch (err) {
            console.error("Error en importación:", err);
            alert("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fadeIn">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                            <FiUploadCloud className="text-white text-2xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Importar Lista de Precios</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Soporta formatos Excel (.xlsx, .xls) y CSV</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <FiX size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                    
                    {/* List Name Input (Only for non-products) */}
                    {activeTab !== "productos" && (
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nombre de la nueva lista</label>
                            <input
                                type="text"
                                className="w-full px-6 py-4 bg-slate-100/50 border border-slate-200 rounded-2xl text-[15px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner-sm"
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
                            <div className="border-4 border-dashed border-slate-100 group-hover:border-blue-200 group-hover:bg-blue-50/30 rounded-[32px] p-12 flex flex-col items-center justify-center gap-4 transition-all duration-500 bg-slate-50/50">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-500">
                                    <FiFileText className="text-4xl text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <p className="text-[15px] font-black text-slate-600 uppercase tracking-tight">Haz clic para seleccionar o arrastra el archivo</p>
                                    <p className="text-[12px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Excel o CSV máximo 10MB</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Preview Table */}
                            <div className="bg-slate-50 rounded-[24px] border border-slate-200 overflow-hidden">
                                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                                    <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                        <FiCheckCircle className="text-emerald-500" /> Vista previa de datos
                                    </span>
                                    <button 
                                        onClick={() => setFileData([])}
                                        className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                                    >
                                        Cambiar archivo
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Categoría</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Código</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Producto</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-200">Permite desc.</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right border-b border-slate-200">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fileData.slice(0, 50).map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <span className="text-[12px] font-bold text-slate-600 uppercase">{row.categoria}</span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="text-[12px] font-bold text-slate-600">{row.codigo || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="text-[13px] font-black text-slate-700 uppercase leading-tight">{row.nombre}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        <span className={`text-[11px] font-black ${row.permite_descuento ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                            {row.permite_descuento ? 'SÍ' : 'NO'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-[13px] font-black text-slate-700 text-right">${row.precio.toLocaleString('es-CO')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Viendo 10 de {fileData.length} registros
                                    </p>
                                    {mappingReport && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-blue-400 uppercase">Columna detectada:</span>
                                            <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-[9px] font-black">{mappingReport.categoria}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-[24px] bg-blue-50 border border-blue-100 flex flex-col">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Registros</span>
                                    <span className="text-3xl font-black text-blue-600">{stats.total}</span>
                                </div>
                                <div className="p-6 rounded-[24px] bg-emerald-50 border border-emerald-100 flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Listos para Cargar</span>
                                    <span className="text-3xl font-black text-emerald-600">{stats.valid}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50/30">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || !fileData.length || stats.valid === 0}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-[20px] font-black text-[12px] uppercase tracking-[0.1em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Procesando Base de Datos...
                            </>
                        ) : (
                            <>
                                <FiCheckCircle size={18} /> Procesar {stats.valid} Ítems Ahora
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
