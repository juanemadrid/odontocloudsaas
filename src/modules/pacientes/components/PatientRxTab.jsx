import React, { useRef, useState, useMemo } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { setDoc, doc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { FiPlus, FiSearch, FiFileText, FiImage, FiTrash2, FiDownload, FiUploadCloud, FiEdit, FiEye, FiX } from "react-icons/fi";


export default function PatientRxTab({ patient, onUpdate }) {
    const toast = useToast();
    const { userProfile, user } = useAuth();
    // Robust display name: tries all possible fields in the user profile before falling back to email
    const currentUserName = userProfile?.nombre 
        || userProfile?.nombreCompleto 
        || userProfile?.nombres 
        || userProfile?.displayName 
        || user?.displayName 
        || user?.email 
        || "Usuario";
    const [viewMode, setViewMode] = useState("list"); // 'list' | 'form'
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState("");
    const [editingImage, setEditingImage] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
    const [compareModalOpen, setCompareModalOpen] = useState(false);
    const [beforeImg, setBeforeImg] = useState(null);
    const [afterImg, setAfterImg] = useState(null);
    const [sliderPos, setSliderPos] = useState(50);
    
    // Form States
    const [selectedFile, setSelectedFile] = useState(null);
    const [nombreVisible, setNombreVisible] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [profesionalResp, setProfesionalResp] = useState("");
    const [fechaAsoc, setFechaAsoc] = useState(new Date().toISOString().split("T")[0]);
    const fileInputRef = useRef(null);

    // Dynamic Select List for Profesionales
    const [catalogProfesionales, setCatalogProfesionales] = useState([]);

    React.useEffect(() => {
        const loadCatalog = async () => {
            if (!userProfile?.inquilino) return;
            try {
                if (patient?.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
                    const list = patient.profesionales.map(p => ({
                        id: p.id,
                        nombreCompleto: p.nombreCompleto || p.nombre || "",
                        ...p
                    }));
                    setCatalogProfesionales(list.sort((a,b) => a.nombreCompleto?.localeCompare(b.nombreCompleto) || 0));
                    return;
                }

                const q = query(
                    collection(db, "profesionales"),
                    where("inquilino", "==", userProfile.inquilino),
                    where("activo", "==", true)
                );
                const s = await getDocs(q);
                const list = s.docs.map(doc => {
                    const d = doc.data();
                    return { 
                        id: doc.id, 
                        nombreCompleto: d.nombreCompleto || d.nombre || "",
                        ...d
                    };
                });
                setCatalogProfesionales(list.sort((a,b) => a.nombreCompleto?.localeCompare(b.nombreCompleto) || 0));
            } catch (err) {
                console.error("Error loading professionals:", err);
            }
        };
        loadCatalog();
    }, [userProfile, patient?.profesionales]);

    const images = useMemo(() => {
        let list = Array.isArray(patient?.rxImagenes) ? patient.rxImagenes : [];
        if (filter.trim()) {
            const q = filter.toLowerCase();
            list = list.filter(i => (i.title || "").toLowerCase().includes(q) || (i.name || "").toLowerCase().includes(q));
        }
        return [...list].sort((a, b) => (b.uploadedAtMS || b.created || 0) - (a.uploadedAtMS || a.created || 0));
    }, [patient?.rxImagenes, filter]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            if (!nombreVisible) setNombreVisible(file.name.replace(/\.[^.]+$/, ""));
        }
    };

    const handleSaveFile = async (e) => {
        e.preventDefault();
        if (!selectedFile && !editingImage) return toast.error("Debe cargar un archivo");
        if (!nombreVisible.trim()) return toast.error("El nombre es requerido");
        if (!profesionalResp.trim()) return toast.error("El profesional es requerido");

        setUploading(true);
        const storage = getStorage();
        try {
            let url, path;
            
            if (editingImage) {
                // Edición: mantener URL y path si no se cambió el archivo
                url = editingImage.url;
                path = editingImage.path;
                
                if (selectedFile) {
                    // Si se cambió el archivo, eliminar el anterior y subir el nuevo
                    if (editingImage.path) {
                        try {
                            await deleteObject(ref(storage, editingImage.path));
                        } catch (err) {
                            console.warn("Could not delete old file in Storage:", err);
                        }
                    }
                    
                    const safe = (selectedFile.name || "archivo").replace(/\s+/g, "_");
                    path = `pacientes/${patient.id}/rx/${Date.now()}_${safe}`;
                    const sref = ref(storage, path);
                    
                    await uploadBytes(sref, selectedFile, { contentType: selectedFile.type });
                    url = await getDownloadURL(sref);
                }
            } else {
                // Creación: subir nuevo archivo
                const safe = (selectedFile.name || "archivo").replace(/\s+/g, "_");
                path = `pacientes/${patient.id}/rx/${Date.now()}_${safe}`;
                const sref = ref(storage, path);

                await uploadBytes(sref, selectedFile, { contentType: selectedFile.type });
                url = await getDownloadURL(sref);
            }

            const itemData = {
                url,
                name: selectedFile ? selectedFile.name : editingImage.name,
                title: nombreVisible,
                descripcion,
                profesional: profesionalResp,
                creador: currentUserName,
                fechaAsocISO: fechaAsoc,
                path,
                type: selectedFile ? selectedFile.type : editingImage.type,
                size: selectedFile ? selectedFile.size : editingImage.size,
                uploadedAtMS: editingImage ? editingImage.uploadedAtMS : Date.now(),
                uploadedAtISO: editingImage ? editingImage.uploadedAtISO : new Date().toISOString()
            };

            let updatedList;
            if (editingImage) {
                // Actualizar el elemento existente
                updatedList = (patient.rxImagenes || []).map(img => 
                    img.path === editingImage.path ? itemData : img
                );
            } else {
                // Agregar nuevo elemento
                updatedList = [...(patient.rxImagenes || []), itemData];
            }

            await setDoc(doc(db, "pacientes", patient.id), {
                rxImagenes: updatedList,
                actualizado: serverTimestamp()
            }, { merge: true });
            onUpdate && onUpdate({ ...patient, rxImagenes: updatedList });
            toast.success(editingImage ? "Archivo actualizado correctamente" : "Archivo guardado correctamente");
            
            // reset form and return to list
            setSelectedFile(null);
            setNombreVisible("");
            setDescripcion("");
            setProfesionalResp("");
            setEditingImage(null);
            setViewMode("list");
        } catch (err) {
            console.error(err);
            toast.error("Error subiendo el archivo");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = (item) => {
        setDeleteConfirmItem(item);
    };

    const executeDelete = async (item) => {
        const currentList = patient.rxImagenes || [];
        // Filter by both path and url to guarantee clean removal even if path is missing/empty
        const newList = currentList.filter(x => x.path !== item.path && x.url !== item.url);

        try {
            // First update Firestore so the document is immediately removed in the UI
            await setDoc(doc(db, "pacientes", patient.id), {
                rxImagenes: newList,
                actualizado: serverTimestamp()
            }, { merge: true });

            onUpdate && onUpdate({ ...patient, rxImagenes: newList });
            toast.success("Archivo eliminado");

            // Attempt to delete from Storage asynchronously, without blocking the user
            if (item.path) {
                try {
                    const storage = getStorage();
                    await deleteObject(ref(storage, item.path));
                } catch (storageErr) {
                    console.warn("Storage binary deletion failed or was bypassed:", storageErr);
                }
            }
        } catch (e) {
            console.error("Firestore document deletion failed:", e);
            toast.error("Error al borrar el archivo");
        }
    };

    if (viewMode === "form") {
        return (
            <div className="p-4 md:p-8 animate-fadeIn flex flex-col h-full min-h-0 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => {
                            setViewMode("list");
                            setEditingImage(null);
                            setSelectedFile(null);
                            setNombreVisible("");
                            setDescripcion("");
                            setProfesionalResp("");
                        }} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest">&larr; Volver</button>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">
                            {editingImage ? "Editar archivo" : "Nuevo archivo"}
                        </h2>
                    </div>
                    <button type="submit" form="rxForm" disabled={uploading} className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                        {uploading ? "Guardando..." : editingImage ? "Actualizar" : "Guardar"}
                    </button>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-8 max-w-4xl mx-auto flex-1 w-full overflow-y-auto custom-scrollbar">
                    <form id="rxForm" onSubmit={handleSaveFile} className="space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Información básica</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Usuario creador</label>
                            </div>
                            <div className="md:col-span-9">
                                <input type="text" readOnly value={currentUserName} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-medium text-slate-500 cursor-not-allowed" />
                            </div>

                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Cargar los archivos</label>
                            </div>
                            <div className="md:col-span-9">
                                <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors group">
                                    <FiUploadCloud size={32} className="text-slate-400 group-hover:text-blue-500 mb-2" />
                                    {selectedFile ? (
                                        <p className="text-sm font-bold text-blue-600">{selectedFile.name}</p>
                                    ) : editingImage ? (
                                        <>
                                            <p className="text-sm font-bold text-slate-600">Archivo actual: {editingImage.name}</p>
                                            <p className="text-xs text-slate-400 font-medium">Click para cambiar archivo (opcional)</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-slate-600">Arrastra o click para cargar la foto.</p>
                                            <p className="text-xs text-slate-400 font-medium">Solo archivos de imágenes, Word, Excel o PDF</p>
                                        </>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                </div>
                            </div>

                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Fecha asociación *</label>
                            </div>
                            <div className="md:col-span-9">
                                <input type="date" required value={fechaAsoc} onChange={e => setFechaAsoc(e.target.value)} className="w-64 bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-medium text-slate-700 focus:border-blue-500 outline-none" />
                            </div>

                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Nombre *</label>
                            </div>
                            <div className="md:col-span-9">
                                <input type="text" required placeholder="Nombre del archivo" value={nombreVisible} onChange={e => setNombreVisible(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-medium text-slate-700 focus:border-blue-500 outline-none" />
                            </div>

                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Descripción</label>
                            </div>
                            <div className="md:col-span-9">
                                <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-medium text-slate-700 focus:border-blue-500 outline-none custom-scrollbar"></textarea>
                            </div>

                            <div className="md:col-span-3 text-right">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-3">Profesional *</label>
                            </div>
                            <div className="md:col-span-9">
                                <select 
                                    required 
                                    value={profesionalResp} 
                                    onChange={e => setProfesionalResp(e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-medium text-slate-700 focus:border-blue-500 outline-none cursor-pointer"
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    {catalogProfesionales.map((p) => (
                                        <option key={p.id} value={p.nombreCompleto || p.nombre || p.id}>
                                            {p.nombreCompleto || p.nombre || p.id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 animate-fadeIn flex flex-col min-h-0 h-full">
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
                
                {/* TOOLBAR */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="relative w-full md:w-80">
                        <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700"
                            placeholder="Buscar..." 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => {
                                if (images.length < 2) return toast.error("Necesita al menos 2 imágenes cargadas para comparar");
                                setBeforeImg(images[images.length - 1]);
                                setAfterImg(images[0]);
                                setCompareModalOpen(true);
                            }}
                            className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shrink-0"
                        >
                            <FiEye size={14} /> Comparar Antes vs Después
                        </button>
                        <button 
                            onClick={() => setViewMode("form")}
                            className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95 shrink-0"
                        >
                            <FiPlus size={14} /> Nuevo archivo
                        </button>
                    </div>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-[#f8fafc] sticky top-0 z-10 shadow-[0_1px_0_0_#f1f5f9]">
                            <tr>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-24 text-center">Vista previa</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Profesional</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Descripción</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">Fecha asoc ↓</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {images.length > 0 ? (
                                images.map((img, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6 text-center">
                                            {img.type?.startsWith('image/') ? (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden mx-auto shadow-sm">
                                                    <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-500 shadow-sm">
                                                    <FiFileText size={20} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 font-bold text-sm text-slate-800">{img.profesional || '---'}</td>
                                        <td className="py-4 px-6 font-bold text-sm text-slate-800">{img.title}</td>
                                        <td className="py-4 px-6 text-sm text-slate-600 truncate max-w-xs" title={img.descripcion}>{img.descripcion || '---'}</td>
                                        <td className="py-4 px-6 text-sm font-medium text-slate-500">{img.fechaAsocISO || new Date(img.uploadedAtMS).toLocaleDateString()}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 transition-opacity">
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-colors"
                                                    onClick={() => setPreviewItem(img)}
                                                    title="Visualizar"
                                                >
                                                    <FiEye size={14} />
                                                </button>
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-colors"
                                                    onClick={() => {
                                                        setEditingImage(img);
                                                        setNombreVisible(img.title || '');
                                                        setDescripcion(img.descripcion || '');
                                                        setProfesionalResp(img.profesional || '');
                                                        setFechaAsoc(img.fechaAsocISO || img.uploadedAtISO?.split("T")[0] || new Date().toISOString().split("T")[0]);
                                                        setViewMode("form");
                                                    }}
                                                    title="Editar"
                                                >
                                                    <FiEdit size={14} />
                                                </button>
                                                <a href={img.url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors" title="Descargar">
                                                    <FiDownload size={14} />
                                                </a>
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                                    onClick={() => handleDelete(img)}
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay información disponible</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            {/* PREVIEW MODAL */}
            {previewItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setPreviewItem(null)} />
                    <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-zoomIn border border-slate-100 flex flex-col max-h-[90vh] z-10">
                        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{previewItem.title}</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {previewItem.profesional ? `Asociado a: ${previewItem.profesional}` : ''} • {previewItem.fechaAsocISO || new Date(previewItem.uploadedAtMS).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={previewItem.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md shadow-blue-500/10"
                                    title="Descargar"
                                >
                                    <FiDownload size={12} /> Descargar
                                </a>
                                <button 
                                    onClick={() => setPreviewItem(null)} 
                                    className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm"
                                >
                                    <FiX size={16} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-6 min-h-[300px] custom-scrollbar">
                            {previewItem.type?.startsWith('image/') ? (
                                <img 
                                    src={previewItem.url} 
                                    alt={previewItem.title} 
                                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl border border-slate-800 bg-slate-950" 
                                />
                            ) : previewItem.type === 'application/pdf' ? (
                                <iframe 
                                    src={previewItem.url} 
                                    title={previewItem.title} 
                                    className="w-full h-[70vh] rounded-xl border border-slate-800 bg-white"
                                />
                            ) : (
                                <div className="text-center p-12 max-w-md bg-slate-950 border border-slate-800 rounded-[24px]">
                                    <FiFileText size={48} className="text-indigo-400 mx-auto mb-4" />
                                    <h4 className="text-white text-sm font-black uppercase tracking-wider mb-2">Archivo No Previsualizable</h4>
                                    <p className="text-slate-400 text-xs font-medium mb-6">Este tipo de archivo ({previewItem.type || 'documento'}) no se puede previsualizar directamente. Por favor descárguelo para abrirlo.</p>
                                    <a 
                                        href={previewItem.url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        <FiDownload size={14} /> Descargar Archivo
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirmItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setDeleteConfirmItem(null)} />
                    <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl p-8 overflow-hidden animate-zoomIn border border-slate-100 text-center z-10">
                        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">
                            <FiTrash2 />
                        </div>
                        
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">¿Confirmar eliminación?</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8">
                            ¿Seguro que deseas eliminar el archivo <span className="font-bold text-slate-800">"{deleteConfirmItem.title}"</span>? Esta acción no se puede deshacer.
                        </p>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setDeleteConfirmItem(null)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    const itemToDelete = deleteConfirmItem;
                                    setDeleteConfirmItem(null);
                                    executeDelete(itemToDelete);
                                }}
                                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 📸 COMPARADOR ANTES VS DESPUÉS MODAL */}
            {compareModalOpen && (
                <div className="fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                            <div>
                                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                    📸 Comparador Clínico Antes vs Después
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Desplaza el divisor central para evaluar la evolución estética o radiográfica
                                </p>
                            </div>
                            <button 
                                onClick={() => setCompareModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Selectors */}
                        <div className="p-4 bg-slate-950/30 border-b border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1.5">
                                    1. Imagen "ANTES" (Inicial)
                                </label>
                                <select 
                                    value={beforeImg?.path || ""} 
                                    onChange={e => setBeforeImg(images.find(i => i.path === e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-2 px-3 text-xs font-bold focus:outline-none"
                                >
                                    {images.map(img => (
                                        <option key={img.path} value={img.path}>
                                            {img.title || img.name} ({img.fechaAsocISO || 'Sin fecha'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1.5">
                                    2. Imagen "DESPUÉS" (Final / Progreso)
                                </label>
                                <select 
                                    value={afterImg?.path || ""} 
                                    onChange={e => setAfterImg(images.find(i => i.path === e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-2 px-3 text-xs font-bold focus:outline-none"
                                >
                                    {images.map(img => (
                                        <option key={img.path} value={img.path}>
                                            {img.title || img.name} ({img.fechaAsocISO || 'Sin fecha'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Interactive Comparison Canvas */}
                        <div className="p-6 flex-1 flex items-center justify-center relative min-h-[380px] select-none overflow-hidden bg-slate-950/80">
                            {beforeImg && afterImg ? (
                                <div className="relative w-full h-[400px] md:h-[480px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                                    {/* AFTER IMAGE (Background) */}
                                    <img 
                                        src={afterImg.url} 
                                        alt="Después" 
                                        className="absolute inset-0 w-full h-full object-contain bg-black"
                                    />
                                    <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-emerald-600/90 backdrop-blur-md text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg">
                                        DESPUÉS: {afterImg.title || afterImg.name}
                                    </div>

                                    {/* BEFORE IMAGE (Clipped overlay) */}
                                    <div 
                                        className="absolute inset-0 overflow-hidden border-r-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                        style={{ width: `${sliderPos}%` }}
                                    >
                                        <img 
                                            src={beforeImg.url} 
                                            alt="Antes" 
                                            className="absolute inset-0 w-full h-full object-contain bg-black max-w-none"
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-blue-600/90 backdrop-blur-md text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg">
                                            ANTES: {beforeImg.title || beforeImg.name}
                                        </div>
                                    </div>

                                    {/* Range input controller */}
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={sliderPos}
                                        onChange={e => setSliderPos(e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-ew-resize z-30 w-full h-full"
                                    />

                                    {/* Slider Handle Knob */}
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-20 w-10 h-10 -ml-5 rounded-full bg-white text-slate-900 shadow-2xl flex items-center justify-center font-black text-xs border-2 border-blue-500"
                                        style={{ left: `${sliderPos}%` }}
                                    >
                                        ↔
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                                    Seleccione las dos imágenes para iniciar la comparación.
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Arrastre el control slider horizontalmente para comparar la evolución clínica
                            </span>
                            <button 
                                onClick={() => setCompareModalOpen(false)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
