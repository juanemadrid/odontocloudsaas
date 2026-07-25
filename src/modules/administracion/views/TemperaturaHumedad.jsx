// src/modules/administracion/views/TemperaturaHumedad.jsx
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { 
  collection, query, where, getDocs, doc, setDoc, 
  addDoc, serverTimestamp, updateDoc, deleteDoc, orderBy 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { 
  FiThermometer, FiMapPin, FiPlus, FiSearch, FiEdit3, 
  FiTrash2, FiSave, FiList, FiTrendingUp, FiActivity 
} from "react-icons/fi";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from "recharts";

export default function TemperaturaHumedad() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // Sub-navigation state: 'UBICACIONES' | 'REGISTRAR' | 'ENLISTAR' | 'GRAFICAR'
  const [activeSubTab, setActiveSubTab] = useState("UBICACIONES");
  
  // Data lists
  const [locations, setLocations] = useState([]);
  const [mediciones, setMediciones] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationName, setLocationName] = useState("");

  const [editingMedicion, setEditingMedicion] = useState(null);
  const [medicionForm, setMedicionForm] = useState({
    ubicacionId: "",
    temperaturaInterna: "",
    temperaturaExterna: "",
    humedad: "",
    fechaMedida: new Date().toISOString().substring(0, 16), // YYYY-MM-DDTHH:MM
    observaciones: ""
  });

  // Filter for enlistar / graficar
  const [filterUbicacion, setFilterUbicacion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Date filters matching OralDrive
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-CA"); // One month ago: YYYY-MM-DD
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA"); // Today: YYYY-MM-DD
  });
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);

  // Graph tab filters matching OralDrive
  const [graphUbicacion, setGraphUbicacion] = useState("");
  const [graphStartDate, setGraphStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-CA"); // One month ago: YYYY-MM-DD
  });
  const [graphEndDate, setGraphEndDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA"); // Today: YYYY-MM-DD
  });
  const [appliedGraphUbicacion, setAppliedGraphUbicacion] = useState("");
  const [appliedGraphStartDate, setAppliedGraphStartDate] = useState(graphStartDate);
  const [appliedGraphEndDate, setAppliedGraphEndDate] = useState(graphEndDate);

  useEffect(() => {
    if (inquilino) {
      loadLocations();
      loadMediciones();
      loadProfessionals();
    }
  }, [inquilino]);

  const loadLocations = async () => {
    try {
      const q = query(
        collection(db, "temp_ubicaciones"), 
        where("inquilino", "==", inquilino)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLocations(list);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMediciones = async () => {
    try {
      const q = query(
        collection(db, "temp_mediciones"), 
        where("inquilino", "==", inquilino),
        orderBy("fechaMedida", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMediciones(list);
    } catch (e) {
      console.error("Error loading measurements:", e);
    }
  };

  const loadProfessionals = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "profesionales"), where("inquilino", "==", inquilino))
      );
      setProfessionals(snap.docs.map(d => d.data().nombreCompleto || d.data().nombre));
    } catch (e) {
      console.error(e);
    }
  };

  // --- LOCATION ACTIONS ---
  const handleNewLocation = () => {
    setEditingLocation(null);
    setLocationName("");
    setLocationFormOpen(true);
  };

  const handleEditLocation = (loc) => {
    setEditingLocation(loc);
    setLocationName(loc.nombre || "");
    setLocationFormOpen(true);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!locationName.trim()) return toast?.error("El nombre de la ubicación es requerido");
    setSaving(true);
    try {
      const payload = {
        nombre: locationName.trim(),
        inquilino,
        updatedAt: serverTimestamp()
      };

      if (editingLocation?.id) {
        await setDoc(doc(db, "temp_ubicaciones", editingLocation.id), payload, { merge: true });
        toast?.success("Ubicación actualizada con éxito");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "temp_ubicaciones"), payload);
        toast?.success("Ubicación creada con éxito");
      }
      setLocationFormOpen(false);
      loadLocations();
    } catch (e) {
      console.error(e);
      toast?.error("Error al guardar la ubicación");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (loc) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente la ubicación "${loc.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db, "temp_ubicaciones", loc.id));
      toast?.success("Ubicación eliminada");
      loadLocations();
    } catch (e) {
      console.error(e);
      toast?.error("Error al eliminar la ubicación");
    }
  };

  // --- MEASUREMENT ACTIONS ---
  const handleSaveMedicion = async (e) => {
    e.preventDefault();
    if (!medicionForm.ubicacionId) return toast?.error("Debe seleccionar una ubicación");
    if (medicionForm.temperaturaInterna === "") return toast?.error("La temperatura interna es requerida");
    if (medicionForm.temperaturaExterna === "") return toast?.error("La temperatura externa es requerida");
    if (medicionForm.humedad === "") return toast?.error("La humedad es requerida");
    if (!medicionForm.fechaMedida) return toast?.error("La fecha de medida es requerida");

    setSaving(true);
    try {
      const selectedLoc = locations.find(l => l.id === medicionForm.ubicacionId);
      const payload = {
        ...medicionForm,
        temperaturaInterna: parseFloat(medicionForm.temperaturaInterna),
        temperaturaExterna: parseFloat(medicionForm.temperaturaExterna),
        humedad: parseFloat(medicionForm.humedad),
        ubicacionNombre: selectedLoc?.nombre || "",
        responsable: userProfile?.displayName || userProfile?.nombreCompleto || "Admin",
        inquilino,
        updatedAt: serverTimestamp()
      };

      if (editingMedicion?.id) {
        await setDoc(doc(db, "temp_mediciones", editingMedicion.id), payload, { merge: true });
        toast?.success("Medición actualizada");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "temp_mediciones"), payload);
        toast?.success("Medición registrada con éxito");
      }

      setMedicionForm({
        ubicacionId: "",
        temperaturaInterna: "",
        temperaturaExterna: "",
        humedad: "",
        fechaMedida: new Date().toISOString().substring(0, 16),
        observaciones: ""
      });
      setEditingMedicion(null);
      loadMediciones();
      setActiveSubTab("ENLISTAR");
    } catch (e) {
      console.error(e);
      toast?.error("Error al registrar medición");
    } finally {
      setSaving(false);
    }
  };

  const handleEditMedicion = (med) => {
    setEditingMedicion(med);
    setMedicionForm({
      ubicacionId: med.ubicacionId || "",
      temperaturaInterna: med.temperaturaInterna || "",
      temperaturaExterna: med.temperaturaExterna || "",
      humedad: med.humedad || "",
      fechaMedida: med.fechaMedida || new Date().toISOString().substring(0, 16),
      observaciones: med.observaciones || ""
    });
    setActiveSubTab("REGISTRAR");
  };

  const handleDeleteMedicion = async (med) => {
    if (!window.confirm("¿Está seguro de eliminar permanentemente esta medición?")) return;
    try {
      await deleteDoc(doc(db, "temp_mediciones", med.id));
      toast?.success("Medición eliminada");
      loadMediciones();
    } catch (e) {
      console.error(e);
      toast?.error("Error al eliminar medición");
    }
  };

  // Filtered mediciones
  const filteredMediciones = mediciones.filter(m => {
    const isLocMatch = filterUbicacion ? m.ubicacionId === filterUbicacion : true;
    if (!isLocMatch) return false;

    const mDate = m.fechaMedida ? m.fechaMedida.substring(0, 10) : "";
    const isWithinDateRange = (!appliedStartDate || mDate >= appliedStartDate) && (!appliedEndDate || mDate <= appliedEndDate);
    if (!isWithinDateRange) return false;

    const term = searchQuery.toLowerCase();
    const locName = (m.ubicacionNombre || "").toLowerCase();
    const resp = (m.responsable || "").toLowerCase();
    return locName.includes(term) || resp.includes(term);
  });

  // Recharts Chart Data Prep
  const chartData = [...mediciones]
    .filter(m => {
      const matchLoc = appliedGraphUbicacion ? m.ubicacionId === appliedGraphUbicacion : true;
      if (!matchLoc) return false;

      const mDate = m.fechaMedida ? m.fechaMedida.substring(0, 10) : "";
      const isWithinDateRange = (!appliedGraphStartDate || mDate >= appliedGraphStartDate) && (!appliedGraphEndDate || mDate <= appliedGraphEndDate);
      return isWithinDateRange;
    })
    .slice(0, 15) // Last 15 measurements in that range
    .reverse() // Chronological order
    .map(m => {
      let displayName = "";
      if (m.fechaMedida && m.fechaMedida.includes("T")) {
        const [dPart, tPart] = m.fechaMedida.split("T");
        displayName = `${dPart.substring(5)} ${tPart}`;
      }
      return {
        name: displayName,
        TempInt: m.temperaturaInterna || 0,
        TempExt: m.temperaturaExterna || 0,
        Hum: m.humedad || 0
      };
    });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden animate-fadeIn space-y-4 p-4">
      {/* Top Horizontal Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FiThermometer size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-800 uppercase tracking-tight">Temperatura y Humedad</h3>
            <span className="text-[10px] text-slate-400 font-medium block">Monitoreo de cadena de frío</span>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 flex-wrap">
          {[
            { id: "UBICACIONES", label: "Ubicaciones", icon: <FiMapPin size={13} /> },
            { id: "REGISTRAR", label: "Registrar Medición", icon: <FiPlus size={13} /> },
            { id: "ENLISTAR", label: "Enlistar Mediciones", icon: <FiList size={13} /> },
            { id: "GRAFICAR", label: "Graficar Mediciones", icon: <FiTrendingUp size={13} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setLocationFormOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${
                activeSubTab === tab.id
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        
        {/* --- VIEW: UBICACIONES --- */}
        {activeSubTab === "UBICACIONES" && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            {locationFormOpen ? (
              <form onSubmit={handleSaveLocation} className="max-w-xl bg-slate-50 border border-slate-100 p-6 rounded-2xl space-y-6">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ubicaciones / {editingLocation ? "Editar" : "Nueva"}</span>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Información básica</h4>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Nombre de la ubicación"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setLocationFormOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-2.5 rounded-xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Locations Header Controls */}
                <div className="flex justify-between items-center gap-4 mb-6">
                  <div className="relative w-full max-w-sm">
                    <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar ubicación..."
                      className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300"
                    />
                  </div>

                  <button
                    onClick={handleNewLocation}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
                  >
                    <FiPlus size={15} strokeWidth={3} />
                    <span>Nueva ubicación</span>
                  </button>
                </div>

                {/* Locations Table */}
                <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Nombre de la Ubicación</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60 text-slate-700">
                      {locations.length === 0 ? (
                        <tr>
                          <td colSpan="2" className="px-6 py-20 text-center">
                            <div className="text-3xl mb-3">📍</div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay ubicaciones registradas</p>
                          </td>
                        </tr>
                      ) : (
                        locations
                          .filter(l => (l.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(loc => (
                            <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-800 text-[13px]">{loc.nombre}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditLocation(loc)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Editar"
                                  >
                                    <FiEdit3 size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLocation(loc)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    title="Eliminar"
                                  >
                                    <FiTrash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- VIEW: REGISTRAR MEDICION --- */}
        {activeSubTab === "REGISTRAR" && (
          <form onSubmit={handleSaveMedicion} className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
            <div className="border-b border-slate-100 pb-4 mb-6 shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mediciones / Registrar</span>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Formulario de Medición</h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 border border-slate-100 rounded-2xl">
                
                {/* Location Select */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Ubicación *</label>
                  <select
                    required
                    value={medicionForm.ubicacionId}
                    onChange={(e) => setMedicionForm({ ...medicionForm, ubicacionId: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  >
                    <option value="">Seleccione...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha de Medida */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Fecha de medida *</label>
                  <input
                    type="datetime-local"
                    required
                    value={medicionForm.fechaMedida}
                    onChange={(e) => setMedicionForm({ ...medicionForm, fechaMedida: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Temperatura Interna */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Temperatura interna *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={medicionForm.temperaturaInterna}
                    onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaInterna: e.target.value })}
                    placeholder="Temperatura interna"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Temperatura Externa */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Temperatura externa *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={medicionForm.temperaturaExterna}
                    onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaExterna: e.target.value })}
                    placeholder="Temperatura externa"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Humedad */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Humedad *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={medicionForm.humedad}
                    onChange={(e) => setMedicionForm({ ...medicionForm, humedad: e.target.value })}
                    placeholder="Humedad"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Empty grid space for alignment */}
                <div className="hidden md:block" />

                {/* Observaciones */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Observaciones</label>
                  <textarea
                    rows="3"
                    value={medicionForm.observaciones}
                    onChange={(e) => setMedicionForm({ ...medicionForm, observaciones: e.target.value })}
                    placeholder="Observaciones"
                    className="w-full p-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

              </div>
            </div>

            {/* Form Actions footer */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingMedicion(null);
                  setActiveSubTab("ENLISTAR");
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/60 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-100"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* --- VIEW: ENLISTAR MEDICIONES --- */}
        {activeSubTab === "ENLISTAR" && (
          <div className="flex-1 flex flex-col animate-fadeIn space-y-6">
            
            {/* Top Card: Search / Filters */}
            <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-2xl">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Mediciones</h3>
                <span className="text-[10px] font-bold text-slate-400">
                  Temperatura y Humedad - Mediciones
                </span>
              </div>
              
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Fecha Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Fecha Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <button
                  onClick={() => {
                    setAppliedStartDate(startDate);
                    setAppliedEndDate(endDate);
                  }}
                  className="h-10 px-8 rounded-xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* Bottom Card: Table & Create Action */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl flex-1 flex flex-col overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex flex-1 gap-3 w-full max-w-xl">
                  <div className="relative flex-1">
                    <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por responsable..."
                      className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <select
                    value={filterUbicacion}
                    onChange={(e) => setFilterUbicacion(e.target.value)}
                    className="px-3 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-white outline-none focus:border-blue-400 shrink-0"
                  >
                    <option value="">Todas las Ubicaciones</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    setEditingMedicion(null);
                    setActiveSubTab("REGISTRAR");
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 w-full sm:w-auto justify-center"
                >
                  <FiPlus size={15} strokeWidth={3} />
                  <span>+ Nueva medida</span>
                </button>
              </div>

              {/* Measurements Table */}
              <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Fecha de medida</th>
                      <th className="px-6 py-4">Ubicación</th>
                      <th className="px-6 py-4 text-center">Temp. Interna (°C)</th>
                      <th className="px-6 py-4 text-center">Temp. Externa (°C)</th>
                      <th className="px-6 py-4 text-center">Humedad (%)</th>
                      <th className="px-6 py-4">Responsable</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 text-slate-700">
                    {filteredMediciones.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-20 text-center">
                          <div className="text-3xl mb-3">🌡️</div>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay mediciones registradas</p>
                        </td>
                      </tr>
                    ) : (
                      filteredMediciones.map(med => {
                        let formattedDate = med.fechaMedida || "";
                        if (formattedDate.includes("T")) {
                          const [dPart, tPart] = formattedDate.split("T");
                          const [yr, mo, dy] = dPart.split("-");
                          formattedDate = `${dy}/${mo}/${yr} - ${tPart}`;
                        }
                        return (
                          <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-[13px] text-slate-800">{formattedDate}</div>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 text-[12px]">{med.ubicacionNombre}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[12px] font-black ${
                                med.temperaturaInterna > 25 || med.temperaturaInterna < 15
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {med.temperaturaInterna} °C
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[12px] font-black ${
                                med.temperaturaExterna > 25 || med.temperaturaExterna < 15
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {med.temperaturaExterna} °C
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[12px] font-black ${
                                med.humedad > 70 || med.humedad < 40
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : "bg-blue-50 text-blue-600 border border-blue-100"
                              }`}>
                                {med.humedad} %
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-600 text-[12px]">{med.responsable}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditMedicion(med)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                  title="Editar"
                                >
                                  <FiEdit3 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMedicion(med)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Eliminar"
                                >
                                  <FiTrash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: GRAFICAR MEDICIONES --- */}
        {activeSubTab === "GRAFICAR" && (
          <div className="flex-1 flex flex-col animate-fadeIn space-y-6">
            
            {/* Filters Card */}
            <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-2xl">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Gráficos</h3>
                <span className="text-[10px] font-bold text-slate-400">
                  Temperatura y Humedad - Gráficos
                </span>
              </div>
              
              <div className="flex flex-wrap items-end gap-6">
                {/* Location Select */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Ubicación *</label>
                  <select
                    required
                    value={graphUbicacion}
                    onChange={(e) => setGraphUbicacion(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all min-w-[200px]"
                  >
                    <option value="">Seleccione...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Fecha inicial</label>
                  <input
                    type="date"
                    value={graphStartDate}
                    onChange={(e) => setGraphStartDate(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Fecha final</label>
                  <input
                    type="date"
                    value={graphEndDate}
                    onChange={(e) => setGraphEndDate(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <button
                  onClick={() => {
                    setAppliedGraphUbicacion(graphUbicacion);
                    setAppliedGraphStartDate(graphStartDate);
                    setAppliedGraphEndDate(graphEndDate);
                  }}
                  className="h-10 px-8 rounded-xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
                >
                  Buscar
                </button>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ingrese al menos una medición para graficar los datos</p>
              </div>
            ) : (
              <>
                {/* Recharts Component */}
                <div className="h-80 w-full bg-slate-50 border border-slate-100 p-6 rounded-3xl">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                      <Line type="monotone" dataKey="TempInt" name="Temp. Interna (°C)" stroke="#ef4444" strokeWidth={3} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="TempExt" name="Temp. Externa (°C)" stroke="#f59e0b" strokeWidth={3} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Hum" name="Humedad (%)" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  <div className="bg-rose-50/40 border border-rose-100 p-5 rounded-2xl">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1">Temperatura Interna Máx</span>
                    <span className="text-2xl font-black text-rose-700">
                      {Math.max(...chartData.map(d => d.TempInt))} °C
                    </span>
                  </div>

                  <div className="bg-amber-50/40 border border-amber-100 p-5 rounded-2xl">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Temperatura Externa Máx</span>
                    <span className="text-2xl font-black text-amber-700">
                      {Math.max(...chartData.map(d => d.TempExt))} °C
                    </span>
                  </div>
                  
                  <div className="bg-blue-50/40 border border-blue-100 p-5 rounded-2xl">
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-1">Humedad Máxima</span>
                    <span className="text-2xl font-black text-blue-700">
                      {Math.max(...chartData.map(d => d.Hum))} %
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
