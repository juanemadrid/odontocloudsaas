import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar, FiPlus, FiSearch, FiTrash2, FiEye, FiArrowLeft, FiSave, FiUploadCloud, FiClock, FiFileText } from "react-icons/fi";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";

export default function Esterilizacion() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  // View state: 'list' or 'new'
  const [view, setView] = useState("list");
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0]
  });
  const [appliedRange, setAppliedRange] = useState({ ...dateRange });

  // Form states
  const [fechaEsterilizacion, setFechaEsterilizacion] = useState(new Date().toISOString().split("T")[0]);
  const [conceptoCarga, setConceptoCarga] = useState("");
  const [cantidadCarga, setCantidadCarga] = useState(1);
  const [cargaItems, setCargaItems] = useState([]); // List of { concepto, cantidad }
  
  const [nroPaquetes, setNroPaquetes] = useState(0);
  const [horaInicio, setHoraInicio] = useState("08:00 AM");
  const [horaFin, setHoraFin] = useState("09:00 AM");
  const [temperatura, setTemperatura] = useState(121); // 121°C is standard for autoclave sterilization
  const [presion, setPresion] = useState(15); // 15 psi is standard
  
  const [responsableTipo, setResponsableTipo] = useState("usuario"); // usuario or otro
  const [responsableOtro, setResponsableOtro] = useState("");

  const [quimicoImg, setQuimicoImg] = useState("");
  const [biologicoImg, setBiologicoImg] = useState("");
  const [uploadingQuimico, setUploadingQuimico] = useState(false);
  const [uploadingBiologico, setUploadingBiologico] = useState(false);

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeCycleDetail, setActiveCycleDetail] = useState(null);

  const loadCycles = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "ciclos_esterilizacion"), where("inquilino", "==", inquilino)));
      const list = snap.docs.map((doc, idx) => ({
        id: doc.id,
        consecutivo: idx + 1,
        ...doc.data()
      }));
      list.sort((a, b) => b.fechaEsterilizacion.localeCompare(a.fechaEsterilizacion));
      setCycles(list);
    } catch (e) {
      console.error("Error loading sterilization cycles:", e);
      toast.error("Error al cargar los ciclos de esterilización");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, [inquilino]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setAppliedRange({ ...dateRange });
  };

  const handleAddCargaItem = () => {
    if (!conceptoCarga.trim()) {
      toast.error("Ingrese el concepto del ítem de la carga.");
      return;
    }
    const qty = parseInt(cantidadCarga);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Ingrese una cantidad válida mayor a 0.");
      return;
    }

    setCargaItems(prev => [...prev, { concepto: conceptoCarga.toUpperCase(), cantidad: qty }]);
    setConceptoCarga("");
    setCantidadCarga(1);
  };

  const handleRemoveCargaItem = (idx) => {
    setCargaItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === "quimico") setUploadingQuimico(true);
    if (type === "biologico") setUploadingBiologico(true);

    try {
      const storageRef = ref(storage, `esterilizacion/${inquilino}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      if (type === "quimico") {
        setQuimicoImg(url);
        toast.success("Control químico cargado");
      } else {
        setBiologicoImg(url);
        toast.success("Control biológico cargado");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("No se pudo subir la imagen.");
    } finally {
      if (type === "quimico") setUploadingQuimico(false);
      if (type === "biologico") setUploadingBiologico(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (cargaItems.length === 0) {
      toast.error("Debe agregar al menos un ítem a la carga.");
      return;
    }
    const finalResponsable = responsableTipo === "usuario" 
      ? (userProfile?.nombreCompleto || userProfile?.nombre || "Usuario Clínico") 
      : responsableOtro;

    if (!finalResponsable.trim()) {
      toast.error("Ingrese el nombre del responsable.");
      return;
    }

    setSaving(true);
    try {
      const cycleData = {
        inquilino,
        fechaEsterilizacion,
        cargaItems,
        nroPaquetes: parseInt(nroPaquetes) || 0,
        horaInicio,
        horaFin,
        temperatura: parseFloat(temperatura) || 0,
        presion: parseFloat(presion) || 0,
        responsable: finalResponsable.toUpperCase(),
        quimicoImg,
        biologicoImg,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "ciclos_esterilizacion"), cycleData);
      toast.success("Ciclo de esterilización registrado con éxito");

      // Reset form
      setFechaEsterilizacion(new Date().toISOString().split("T")[0]);
      setCargaItems([]);
      setNroPaquetes(0);
      setHoraInicio("08:00 AM");
      setHoraFin("09:00 AM");
      setTemperatura(121);
      setPresion(15);
      setQuimicoImg("");
      setBiologicoImg("");
      setResponsableTipo("usuario");
      setResponsableOtro("");

      setView("list");
      loadCycles();
    } catch (err) {
      console.error("Error saving sterilization cycle:", err);
      toast.error("Error al guardar el ciclo de esterilización");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este ciclo de esterilización?")) return;
    try {
      await deleteDoc(doc(db, "ciclos_esterilizacion", id));
      toast.success("Ciclo de esterilización eliminado");
      setCycles(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error("Error deleting sterilization cycle:", e);
      toast.error("Error al eliminar el registro");
    }
  };

  const filteredCycles = useMemo(() => {
    return cycles.filter(c => {
      const date = c.fechaEsterilizacion || "";
      const matchesDate = date >= appliedRange.start && date <= appliedRange.end;
      if (!matchesDate) return false;

      const q = searchQuery.toLowerCase();
      if (q) {
        const resp = (c.responsable || "").toLowerCase();
        const itemsStr = (c.cargaItems || []).map(i => i.concepto).join(" ").toLowerCase();
        return resp.includes(q) || itemsStr.includes(q);
      }
      return true;
    });
  }, [cycles, appliedRange, searchQuery]);

  if (view === "list") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header / Add Button Row */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Autoclaves & Cargas</h3>
          </div>
          <button 
            onClick={() => setView("new")}
            className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
          >
            <FiPlus className="mr-1.5" size={14} />
            Agregar ciclo
          </button>
        </div>

        {/* Date Filter Upper Card (OralDrive style) */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Fecha Inicial</label>
              <div className="relative">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                />
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Fecha Final</label>
              <div className="relative">
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                />
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <button
              type="submit"
              className="h-11 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Lower Table Card */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
          <div className="relative w-full max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por responsable o carga..."
              className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-50">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 pl-8 w-24 text-center">Nro</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4 text-center">Horario</th>
                  <th className="px-6 py-4 text-center">Temp/Presión</th>
                  <th className="px-6 py-4 text-center">Paquetes</th>
                  <th className="px-6 py-4">Responsable</th>
                  <th className="px-6 py-4 text-center pr-8 w-32">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-8 py-20 text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredCycles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-8 py-20 text-center text-slate-400 italic">
                      No se encontraron registros de esterilización.
                    </td>
                  </tr>
                ) : (
                  filteredCycles.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 pl-8 text-center font-bold text-slate-400 font-mono">{c.consecutivo}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">{c.fechaEsterilizacion}</td>
                      <td className="px-6 py-4 text-center font-semibold text-slate-500 font-mono">{c.horaInicio} - {c.horaFin}</td>
                      <td className="px-6 py-4 text-center font-semibold text-blue-600 font-mono">{c.temperatura}°C / {c.presion} psi</td>
                      <td className="px-6 py-4 text-center font-black text-slate-700 font-mono">{c.nroPaquetes}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 uppercase">{c.responsable}</td>
                      <td className="px-6 py-4 text-center pr-8">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setActiveCycleDetail(c);
                              setShowDetailModal(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                            title="Ver detalles"
                          >
                            <FiEye size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details View Modal */}
        {showDetailModal && activeCycleDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Detalle del Ciclo de Esterilización #{activeCycleDetail.consecutivo}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto text-xs font-bold text-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2 col-span-2 md:col-span-1">
                    <span className="text-slate-400">Fecha:</span>
                    <span className="text-slate-800">{activeCycleDetail.fechaEsterilizacion}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2 col-span-2 md:col-span-1">
                    <span className="text-slate-400">Paquetes:</span>
                    <span className="text-slate-800">{activeCycleDetail.nroPaquetes}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2 col-span-2 md:col-span-1">
                    <span className="text-slate-400">Horario:</span>
                    <span className="text-slate-800">{activeCycleDetail.horaInicio} - {activeCycleDetail.horaFin}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2 col-span-2 md:col-span-1">
                    <span className="text-slate-400">Temperatura/Presión:</span>
                    <span className="text-blue-600">{activeCycleDetail.temperatura}°C / {activeCycleDetail.presion} psi</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2 col-span-2">
                    <span className="text-slate-400">Responsable:</span>
                    <span className="text-slate-800 uppercase">{activeCycleDetail.responsable}</span>
                  </div>
                </div>

                {/* Table of items inside cycle */}
                <div className="space-y-2 pt-2">
                  <span className="text-slate-400 block mb-1">Carga de instrumental:</span>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-2">Concepto</th>
                          <th className="px-4 py-2 text-center w-28">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCycleDetail.cargaItems?.map((itm, idx) => (
                          <tr key={idx} className="border-t border-slate-50 text-[11px]">
                            <td className="px-4 py-2 font-black text-slate-700 uppercase">{itm.concepto}</td>
                            <td className="px-4 py-2 text-center font-mono text-slate-500 font-bold">{itm.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Image verification blocks */}
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-400 block">Control Químico:</span>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                      {activeCycleDetail.quimicoImg ? (
                        <img src={activeCycleDetail.quimicoImg} alt="Quimico" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-450 italic">Sin cargar</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-400 block">Control Biológico:</span>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                      {activeCycleDetail.biologcioImg || activeCycleDetail.biologicoImg ? (
                        <img src={activeCycleDetail.biologcioImg || activeCycleDetail.biologicoImg} alt="Biologico" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-450 italic">Sin cargar</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Create Cycle Form View (New)
  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500 space-y-6 pb-20">
      
      {/* Back Button and Save Button Header */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between">
        <button 
          onClick={() => setView("list")}
          className="h-10 px-5 rounded-full border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <FiArrowLeft size={14} />
          Volver a la lista
        </button>

        <button 
          onClick={handleSave}
          disabled={saving || cargaItems.length === 0}
          className="h-10 px-8 rounded-full bg-[#8cc33f] hover:bg-[#7db02b] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#8cc33f]/20 transition-all flex items-center gap-2"
        >
          <FiSave size={15} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-8">
        <div className="border-b border-slate-50 pb-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Ciclo</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fecha esterilización */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha esterilización *</label>
            <div className="relative">
              <input
                type="date"
                required
                className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={fechaEsterilizacion}
                onChange={e => setFechaEsterilizacion(e.target.value)}
              />
              <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Dummy element for grid layout balance */}
          <div />

          {/* Add Item to load section */}
          <div className="flex flex-col gap-2 md:col-span-2 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contenido de la carga *</span>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nombre o concepto de ítem a esterilizar..."
                className="flex-1 h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all bg-white"
                value={conceptoCarga}
                onChange={e => setConceptoCarga(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Cantidad"
                  className="w-24 h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-center bg-white"
                  value={cantidadCarga}
                  onChange={e => setCantidadCarga(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddCargaItem}
                  className="h-11 px-6 rounded-xl bg-[#8cc33f] hover:bg-[#7db02b] text-white text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-[#8cc33f]/10"
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Load Items List Table */}
            {cargaItems.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white mt-4 animate-fadeIn">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-4 py-3 pl-6">Concepto</th>
                      <th className="px-4 py-3 text-center w-28">Cantidad</th>
                      <th className="px-4 py-3 text-center pr-6 w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargaItems.map((itm, idx) => (
                      <tr key={idx} className="border-t border-slate-50 text-[12px] text-slate-700">
                        <td className="px-4 py-2.5 pl-6 font-black text-slate-800 uppercase tracking-tight">{itm.concepto}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-slate-500 font-bold">{itm.cantidad}</td>
                        <td className="px-4 py-2.5 text-center pr-6">
                          <button
                            type="button"
                            onClick={() => handleRemoveCargaItem(idx)}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider bg-slate-50 px-2.5 py-1 rounded"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Número de paquetes */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de paquetes *</label>
            <input
              type="number"
              required
              className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-center"
              value={nroPaquetes}
              onChange={e => setNroPaquetes(e.target.value)}
            />
          </div>

          <div /> {/* Grid separator */}

          {/* Hora Inicio */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora Inicio *</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Ej: 04:50 pm"
                className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
              />
              <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Hora Fin */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora Fin *</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Ej: 05:50 pm"
                className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={horaFin}
                onChange={e => setHoraFin(e.target.value)}
              />
              <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Temperatura */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temperatura (°C) *</label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-center"
              value={temperatura}
              onChange={e => setTemperatura(e.target.value)}
            />
          </div>

          {/* Presión */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Presión en libras *</label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-center"
              value={presion}
              onChange={e => setPresion(e.target.value)}
            />
          </div>

          {/* Responsable */}
          <div className="flex flex-col gap-3 md:col-span-2 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsable *</span>
            
            <div className="flex items-center gap-6 mt-1 ml-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                <input
                  type="radio"
                  name="responsableTipo"
                  value="usuario"
                  checked={responsableTipo === "usuario"}
                  onChange={() => setResponsableTipo("usuario")}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span>Usuario del sistema</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                <input
                  type="radio"
                  name="responsableTipo"
                  value="otro"
                  checked={responsableTipo === "otro"}
                  onChange={() => setResponsableTipo("otro")}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span>Otro</span>
              </label>
            </div>

            {responsableTipo === "usuario" ? (
              <select
                disabled
                className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed mt-2"
              >
                <option>{(userProfile?.nombreCompleto || userProfile?.nombre || "Cargando usuario...").toUpperCase()}</option>
              </select>
            ) : (
              <input
                type="text"
                required
                placeholder="Nombre del responsable del ciclo"
                className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all bg-white mt-2 uppercase"
                value={responsableOtro}
                onChange={e => setResponsableOtro(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Chemical Control Upload */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Control químico</span>
          <div className="border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 flex flex-col items-center justify-center gap-4 relative cursor-pointer group min-h-[140px]">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={e => handleImageUpload(e, "quimico")}
              disabled={uploadingQuimico}
            />
            {uploadingQuimico ? (
              <span className="text-xs text-slate-400 animate-pulse font-black uppercase tracking-widest">Subiendo...</span>
            ) : quimicoImg ? (
              <img src={quimicoImg} alt="Quimico" className="max-h-[120px] object-contain rounded-lg" />
            ) : (
              <div className="text-center space-y-2">
                <FiUploadCloud size={24} className="text-slate-300 mx-auto group-hover:scale-105 transition-transform" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Arrastra o click para cargar la foto.</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Cargue su imagen aquí</p>
              </div>
            )}
          </div>
        </div>

        {/* Biological Control Upload */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Control biológico</span>
          <div className="border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 flex flex-col items-center justify-center gap-4 relative cursor-pointer group min-h-[140px]">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={e => handleImageUpload(e, "biologico")}
              disabled={uploadingBiologico}
            />
            {uploadingBiologico ? (
              <span className="text-xs text-slate-400 animate-pulse font-black uppercase tracking-widest">Subiendo...</span>
            ) : biologicoImg ? (
              <img src={biologicoImg} alt="Biologico" className="max-h-[120px] object-contain rounded-lg" />
            ) : (
              <div className="text-center space-y-2">
                <FiUploadCloud size={24} className="text-slate-300 mx-auto group-hover:scale-105 transition-transform" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Arrastra o click para cargar la foto.</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Cargue su imagen aquí</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
