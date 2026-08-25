// src/modules/administracion/views/TemperaturaHumedad.jsx
import React, { useState, useEffect } from "react";
import supabase from "../../../lib/supabaseClient";
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
      let list = [];
      try {
        const { data } = await supabase
          .from("temp_ubicaciones")
          .select("*")
          .eq("tenant_id", inquilino);
        if (data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.temp_ubicaciones || [
          { id: "loc_1", nombre: "CONSULTORIO 1" },
          { id: "loc_2", nombre: "REFRIGERADOR VACUNAS / INSUMOS" }
        ];
      }

      setLocations(list);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMediciones = async () => {
    try {
      let list = [];
      try {
        const { data } = await supabase
          .from("temp_mediciones")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("fechaMedida", { ascending: false });
        if (data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.temp_mediciones || [];
      }

      setMediciones(list);
    } catch (e) {
      console.error("Error loading measurements:", e);
    }
  };

  const loadProfessionals = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("tenant_id", inquilino);
      setProfessionals((data || []).map(d => d.full_name || d.nombreCompleto || d.nombre));
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
      const locId = editingLocation?.id || (crypto.randomUUID ? crypto.randomUUID() : `loc_${Date.now()}`);
      const payload = {
        id: locId,
        nombre: locationName.trim(),
        tenant_id: inquilino,
        updated_at: new Date().toISOString()
      };

      try {
        if (editingLocation?.id) {
          await supabase.from("temp_ubicaciones").update(payload).eq("id", editingLocation.id);
        } else {
          payload.created_at = new Date().toISOString();
          await supabase.from("temp_ubicaciones").insert([payload]);
        }
      } catch (err) {}

      // Sincronizar en website_config
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const currentList = Array.isArray(currentConfig.temp_ubicaciones) ? currentConfig.temp_ubicaciones : [];
      let updatedList;
      if (editingLocation?.id) {
        updatedList = currentList.map(item => item.id === editingLocation.id ? { ...item, ...payload } : item);
      } else {
        updatedList = [payload, ...currentList];
      }

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, temp_ubicaciones: updatedList } },
        { onConflict: "tenant_id" }
      );

      toast?.success(editingLocation ? "Ubicación actualizada con éxito" : "Ubicación creada con éxito");
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
      try {
        await supabase.from("temp_ubicaciones").delete().eq("id", loc.id);
      } catch (err) {}

      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const currentList = Array.isArray(currentConfig.temp_ubicaciones) ? currentConfig.temp_ubicaciones : [];
      const filteredList = currentList.filter(item => item.id !== loc.id);

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, temp_ubicaciones: filteredList } },
        { onConflict: "tenant_id" }
      );

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
      const medId = editingMedicion?.id || (crypto.randomUUID ? crypto.randomUUID() : `med_${Date.now()}`);
      const payload = {
        id: medId,
        ...medicionForm,
        temperaturaInterna: parseFloat(medicionForm.temperaturaInterna),
        temperaturaExterna: parseFloat(medicionForm.temperaturaExterna),
        humedad: parseFloat(medicionForm.humedad),
        ubicacionNombre: selectedLoc?.nombre || "",
        responsable: userProfile?.displayName || userProfile?.full_name || userProfile?.nombreCompleto || "Admin",
        tenant_id: inquilino,
        updated_at: new Date().toISOString()
      };

      try {
        if (editingMedicion?.id) {
          await supabase.from("temp_mediciones").update(payload).eq("id", editingMedicion.id);
        } else {
          payload.created_at = new Date().toISOString();
          await supabase.from("temp_mediciones").insert([payload]);
        }
      } catch (err) {}

      // Sincronizar en website_config
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const currentList = Array.isArray(currentConfig.temp_mediciones) ? currentConfig.temp_mediciones : [];
      let updatedList;
      if (editingMedicion?.id) {
        updatedList = currentList.map(item => item.id === editingMedicion.id ? { ...item, ...payload } : item);
      } else {
        updatedList = [payload, ...currentList];
      }

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, temp_mediciones: updatedList } },
        { onConflict: "tenant_id" }
      );

      toast?.success(editingMedicion ? "Medición actualizada" : "Medición registrada con éxito");

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
      await supabase.from("temp_mediciones").delete().eq("id", med.id);
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden animate-in fade-in duration-300 space-y-4 p-4 font-sans text-slate-800">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <FiThermometer size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Temperatura y Humedad</h3>
            <span className="text-[11px] text-slate-500 font-normal block">Monitoreo de cadena de frío y áreas clínicas</span>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 flex-wrap gap-1">
          {[
            { id: "UBICACIONES", label: "Ubicaciones", icon: <FiMapPin size={12} /> },
            { id: "REGISTRAR", label: "Registrar Medición", icon: <FiPlus size={12} /> },
            { id: "ENLISTAR", label: "Enlistar Mediciones", icon: <FiList size={12} /> },
            { id: "GRAFICAR", label: "Graficar Mediciones", icon: <FiTrendingUp size={12} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setLocationFormOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border-0 ${
                activeSubTab === tab.id
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 bg-transparent"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-4">
        
        {/* --- VIEW: UBICACIONES --- */}
        {activeSubTab === "UBICACIONES" && (
          <div className="flex-1 flex flex-col space-y-4">
            {locationFormOpen ? (
              <form onSubmit={handleSaveLocation} className="max-w-lg bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Ubicaciones / {editingLocation ? "Editar" : "Nueva"}</span>
                  <h4 className="text-xs font-bold text-slate-800">Información básica</h4>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Nombre de la ubicación *</label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Ej: CONSULTORIO 1 o REFRIGERADOR"
                    className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLocationFormOpen(false)}
                    className="h-8 px-3.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-8 px-4 rounded-lg bg-[#7cb342] hover:bg-[#689f38] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Locations Header Controls */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full max-w-sm">
                    <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar ubicación..."
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    onClick={handleNewLocation}
                    className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
                  >
                    <FiPlus size={13} />
                    <span>Nueva ubicación</span>
                  </button>
                </div>

                {/* Locations Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                          <th className="py-2.5 px-4">Nombre de la Ubicación</th>
                          <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {locations.length === 0 ? (
                          <tr>
                            <td colSpan="2" className="py-16 text-center text-slate-400 italic text-xs">
                              No hay ubicaciones registradas
                            </td>
                          </tr>
                        ) : (
                          locations
                            .filter(l => (l.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(loc => (
                              <tr key={loc.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-slate-800">{loc.nombre}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleEditLocation(loc)}
                                      className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                      title="Editar"
                                    >
                                      <FiEdit3 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLocation(loc)}
                                      className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                      title="Eliminar"
                                    >
                                      <FiTrash2 size={12} />
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
              </>
            )}
          </div>
        )}

        {/* --- VIEW: REGISTRAR MEDICION --- */}
        {activeSubTab === "REGISTRAR" && (
          <form onSubmit={handleSaveMedicion} className="bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-2xs space-y-4 max-w-3xl">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Mediciones / {editingMedicion ? "Editar" : "Registrar"}</span>
              <h3 className="text-xs font-bold text-slate-800">Formulario de Medición</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Location Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Ubicación *</label>
                <select
                  required
                  value={medicionForm.ubicacionId}
                  onChange={(e) => setMedicionForm({ ...medicionForm, ubicacionId: e.target.value })}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                >
                  <option value="">Seleccione...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha de Medida */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Fecha de medida *</label>
                <input
                  type="datetime-local"
                  required
                  value={medicionForm.fechaMedida}
                  onChange={(e) => setMedicionForm({ ...medicionForm, fechaMedida: e.target.value })}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Temperatura Interna */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Temperatura interna (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={medicionForm.temperaturaInterna}
                  onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaInterna: e.target.value })}
                  placeholder="Ej: 4.5"
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Temperatura Externa */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Temperatura externa (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={medicionForm.temperaturaExterna}
                  onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaExterna: e.target.value })}
                  placeholder="Ej: 22.0"
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Humedad */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Humedad (%) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={medicionForm.humedad}
                  onChange={(e) => setMedicionForm({ ...medicionForm, humedad: e.target.value })}
                  placeholder="Ej: 55"
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="hidden sm:block" />

              {/* Observaciones */}
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Observaciones</label>
                <textarea
                  rows="2"
                  value={medicionForm.observaciones}
                  onChange={(e) => setMedicionForm({ ...medicionForm, observaciones: e.target.value })}
                  placeholder="Notas u observaciones adicionales..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Form Actions footer */}
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditingMedicion(null);
                  setActiveSubTab("ENLISTAR");
                }}
                className="h-8 px-3.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-4 rounded-lg bg-[#7cb342] hover:bg-[#689f38] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* --- VIEW: ENLISTAR MEDICIONES --- */}
        {activeSubTab === "ENLISTAR" && (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Top Card: Search / Filters */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                    max="9999-12-31" min="1900-01-01" 
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                    max="9999-12-31" min="1900-01-01" 
                  />
                </div>

                <button
                  onClick={() => {
                    setAppliedStartDate(startDate);
                    setAppliedEndDate(endDate);
                  }}
                  className="h-8 px-4 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* Bottom Card: Table & Create Action */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex flex-1 gap-2.5 w-full max-w-lg">
                  <div className="relative flex-1">
                    <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por responsable..."
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                  
                  <select
                    value={filterUbicacion}
                    onChange={(e) => setFilterUbicacion(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 shrink-0 cursor-pointer"
                  >
                    <option value="">Todas las ubicaciones</option>
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
                  className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5 w-full sm:w-auto"
                >
                  <FiPlus size={13} />
                  <span>Nueva medida</span>
                </button>
              </div>

              {/* Measurements Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                        <th className="py-2.5 px-3">Fecha de medida</th>
                        <th className="py-2.5 px-3">Ubicación</th>
                        <th className="py-2.5 px-3 text-center">Temp. Interna</th>
                        <th className="py-2.5 px-3 text-center">Temp. Externa</th>
                        <th className="py-2.5 px-3 text-center">Humedad</th>
                        <th className="py-2.5 px-3">Responsable</th>
                        <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredMediciones.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-16 text-center text-slate-400 italic text-xs">
                            No hay mediciones registradas en este periodo
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
                            <tr key={med.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formattedDate}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">{med.ubicacionNombre}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  med.temperaturaInterna > 25 || med.temperaturaInterna < 15
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                }`}>
                                  {med.temperaturaInterna} °C
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  med.temperaturaExterna > 25 || med.temperaturaExterna < 15
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                }`}>
                                  {med.temperaturaExterna} °C
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  med.humedad > 70 || med.humedad < 40
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : "bg-blue-50 text-blue-600 border border-blue-100"
                                }`}>
                                  {med.humedad} %
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-xs">{med.responsable}</td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleEditMedicion(med)}
                                    className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                    title="Editar"
                                  >
                                    <FiEdit3 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMedicion(med)}
                                    className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <FiTrash2 size={12} />
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
          </div>
        )}

        {/* --- VIEW: GRAFICAR MEDICIONES --- */}
        {activeSubTab === "GRAFICAR" && (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Filters Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-end gap-3">
                {/* Location Select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Ubicación</label>
                  <select
                    value={graphUbicacion}
                    onChange={(e) => setGraphUbicacion(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors min-w-[180px] cursor-pointer"
                  >
                    <option value="">Todas las ubicaciones</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                  <input
                    type="date"
                    value={graphStartDate}
                    onChange={(e) => setGraphStartDate(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                    max="9999-12-31" min="1900-01-01" 
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                  <input
                    type="date"
                    value={graphEndDate}
                    onChange={(e) => setGraphEndDate(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                    max="9999-12-31" min="1900-01-01" 
                  />
                </div>

                <button
                  onClick={() => {
                    setAppliedGraphUbicacion(graphUbicacion);
                    setAppliedGraphStartDate(graphStartDate);
                    setAppliedGraphEndDate(graphEndDate);
                  }}
                  className="h-8 px-4 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-12 text-center text-slate-400 italic text-xs">
                Ingrese o seleccione al menos una medición para graficar los datos en este periodo.
              </div>
            ) : (
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Curva de Tendencias de Temperatura y Humedad
                  </h3>
                </div>

                {/* Recharts Component */}
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                      <Line type="monotone" dataKey="TempInt" name="Temp. Interna (°C)" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="TempExt" name="Temp. Externa (°C)" stroke="#f59e0b" strokeWidth={2} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Hum" name="Humedad (%)" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide block mb-0.5">Temp. Interna Máx</span>
                    <span className="text-lg font-bold text-rose-700 font-mono">
                      {Math.max(...chartData.map(d => d.TempInt))} °C
                    </span>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide block mb-0.5">Temp. Externa Máx</span>
                    <span className="text-lg font-bold text-amber-700 font-mono">
                      {Math.max(...chartData.map(d => d.TempExt))} °C
                    </span>
                  </div>
                  
                  <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide block mb-0.5">Humedad Máxima</span>
                    <span className="text-lg font-bold text-blue-700 font-mono">
                      {Math.max(...chartData.map(d => d.Hum))} %
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
