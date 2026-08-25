// src/modules/administracion/views/TemperaturaHumedad.jsx
import React, { useState, useEffect } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { 
  FiThermometer, FiMapPin, FiPlus, FiSearch, FiEdit2, 
  FiTrash2, FiList, FiTrendingUp, FiCalendar, FiHome, FiFileText, FiPrinter
} from "react-icons/fi";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from "recharts";

export default function TemperaturaHumedad() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // Sub-navigation state: 'UBICACIONES' | 'REGISTRAR' | 'ENLISTAR' | 'GRAFICAR'
  const [activeSubTab, setActiveSubTab] = useState("ENLISTAR");
  
  // Data lists
  const [locations, setLocations] = useState([]);
  const [mediciones, setMediciones] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states - Locations
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationName, setLocationName] = useState("");

  // Form states - Medicion
  const [editingMedicion, setEditingMedicion] = useState(null);
  const [medicionForm, setMedicionForm] = useState({
    ubicacionId: "",
    temperaturaInterna: "",
    temperaturaExterna: "",
    humedad: "",
    fechaMedida: new Date().toISOString().substring(0, 16), // YYYY-MM-DDTHH:MM
    observaciones: ""
  });

  // Filter for enlistar
  const [hasSearched, setHasSearched] = useState(true);
  const [searchTableQuery, setSearchTableQuery] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  });
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);

  // Graph tab filters
  const [graphUbicacion, setGraphUbicacion] = useState("");
  const [graphStartDate, setGraphStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-CA");
  });
  const [graphEndDate, setGraphEndDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA");
  });
  const [appliedGraphUbicacion, setAppliedGraphUbicacion] = useState("");
  const [appliedGraphStartDate, setAppliedGraphStartDate] = useState(graphStartDate);
  const [appliedGraphEndDate, setAppliedGraphEndDate] = useState(graphEndDate);

  useEffect(() => {
    if (inquilino) {
      loadLocations();
      loadMediciones();
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
    if (!locationName.trim()) {
      toast.error("El nombre de la ubicación es requerido");
      return;
    }
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

      toast.success(editingLocation ? "Ubicación actualizada con éxito" : "Ubicación creada con éxito");
      setLocationFormOpen(false);
      loadLocations();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar la ubicación");
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

      toast.success("Ubicación eliminada");
      loadLocations();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar la ubicación");
    }
  };

  // --- MEASUREMENT ACTIONS ---
  const handleOpenNewMedicion = () => {
    setEditingMedicion(null);
    setMedicionForm({
      ubicacionId: locations[0]?.id || "",
      temperaturaInterna: "",
      temperaturaExterna: "",
      humedad: "",
      fechaMedida: new Date().toISOString().substring(0, 16),
      observaciones: ""
    });
    setActiveSubTab("REGISTRAR");
  };

  const handleEditMedicion = (med) => {
    setEditingMedicion(med);
    setMedicionForm({
      ubicacionId: med.ubicacionId || "",
      temperaturaInterna: med.temperaturaInterna ?? "",
      temperaturaExterna: med.temperaturaExterna ?? "",
      humedad: med.humedad ?? "",
      fechaMedida: med.fechaMedida || new Date().toISOString().substring(0, 16),
      observaciones: med.observaciones || ""
    });
    setActiveSubTab("REGISTRAR");
  };

  const handleSaveMedicion = async (e) => {
    if (e) e.preventDefault();
    if (!medicionForm.ubicacionId) {
      toast.error("Debe seleccionar una ubicación");
      return;
    }
    if (medicionForm.temperaturaInterna === "") {
      toast.error("La temperatura interna es requerida");
      return;
    }
    if (medicionForm.temperaturaExterna === "") {
      toast.error("La temperatura externa es requerida");
      return;
    }
    if (medicionForm.humedad === "") {
      toast.error("La humedad es requerida");
      return;
    }
    if (!medicionForm.fechaMedida) {
      toast.error("La fecha de medida es requerida");
      return;
    }

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

      toast.success(editingMedicion ? "Medición actualizada" : "Medición registrada con éxito");

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
      setHasSearched(true);
      setActiveSubTab("ENLISTAR");
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar medición");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMedicion = async (med) => {
    if (!window.confirm("¿Está seguro de eliminar permanentemente esta medición?")) return;
    try {
      try {
        await supabase.from("temp_mediciones").delete().eq("id", med.id);
      } catch (err) {}

      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const currentList = Array.isArray(currentConfig.temp_mediciones) ? currentConfig.temp_mediciones : [];
      const updatedList = currentList.filter(item => item.id !== med.id);

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, temp_mediciones: updatedList } },
        { onConflict: "tenant_id" }
      );

      toast.success("Medición eliminada");
      loadMediciones();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar medición");
    }
  };

  // Filtered mediciones
  const filteredMediciones = mediciones.filter(m => {
    const mDate = m.fechaMedida ? m.fechaMedida.substring(0, 10) : "";
    const isWithinDateRange = (!appliedStartDate || mDate >= appliedStartDate) && (!appliedEndDate || mDate <= appliedEndDate);
    if (!isWithinDateRange) return false;

    if (!searchTableQuery.trim()) return true;
    const term = searchTableQuery.toLowerCase();
    const locName = (m.ubicacionNombre || "").toLowerCase();
    const resp = (m.responsable || "").toLowerCase();
    const dateStr = (m.fechaMedida || "").toLowerCase();
    return locName.includes(term) || resp.includes(term) || dateStr.includes(term);
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
    .slice(0, 20)
    .reverse()
    .map(m => {
      let displayName = "";
      if (m.fechaMedida && m.fechaMedida.includes("T")) {
        const [dPart, tPart] = m.fechaMedida.split("T");
        displayName = `${dPart.substring(5)} ${tPart}`;
      }
      return {
        name: displayName || m.fechaMedida,
        TempInt: m.temperaturaInterna || 0,
        TempExt: m.temperaturaExterna || 0,
        Hum: m.humedad || 0
      };
    });

  const handleSearchClick = (e) => {
    if (e) e.preventDefault();
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setHasSearched(true);
  };

  return (
    <div className="flex flex-col md:flex-row items-start gap-4 font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* ─── LEFT SUB-SIDEBAR (INFORMACIÓN GENERAL) ─── */}
      <div className="w-full md:w-56 bg-white rounded-xl border border-slate-200 p-3 flex flex-col shrink-0 shadow-2xs space-y-2">
        <div className="px-2 py-1 border-b border-slate-100 flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Información general
          </span>
        </div>
        <div className="space-y-1">
          {[
            { id: "UBICACIONES", label: "Ubicaciones" },
            { id: "REGISTRAR", label: "Registrar Medición" },
            { id: "ENLISTAR", label: "Enlistar Mediciones" },
            { id: "GRAFICAR", label: "Graficar Mediciones" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "REGISTRAR") {
                  handleOpenNewMedicion();
                } else {
                  setActiveSubTab(tab.id);
                  setLocationFormOpen(false);
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                activeSubTab === tab.id
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── RIGHT CONTENT AREA ─── */}
      <div className="flex-1 w-full min-w-0 space-y-4">
        
        {/* ─── 1. VIEW: ENLISTAR MEDICIONES ─── */}
        {activeSubTab === "ENLISTAR" && (
          <div className="space-y-4">
            
            {/* Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Mediciones</h2>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-0.5">
                  <FiHome size={12} className="text-slate-400" />
                  <span>/</span>
                  <span>Temperatura y humedad - Mediciones</span>
                </div>
              </div>
            </div>

            {/* Upper Date Filter Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <form onSubmit={handleSearchClick} className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full sm:w-44 h-8 px-3 pr-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                      max="9999-12-31" min="1900-01-01" 
                    />
                    <FiCalendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full sm:w-44 h-8 px-3 pr-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                      max="9999-12-31" min="1900-01-01" 
                    />
                    <FiCalendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                  </div>
                </div>

                <button
                  type="submit"
                  className="h-8 px-5 flex items-center justify-center bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  Buscar
                </button>
              </form>
            </div>

            {/* Lower Table & Actions Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleOpenNewMedicion}
                  className="h-8 px-3.5 flex items-center justify-center bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer gap-1.5"
                >
                  <FiPlus size={13} />
                  <span>+ Nueva medida</span>
                </button>
              </div>

              {hasSearched && (
                <div className="space-y-3 pt-1">
                  {/* Table Helper / Search Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="text-[11px] italic text-slate-400">
                      Arrastre una columna aquí para agrupar por ella
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative w-full sm:w-48">
                        <FiSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchTableQuery}
                          onChange={(e) => setSearchTableQuery(e.target.value)}
                          placeholder="Buscar..."
                          className="w-full h-7 pl-7 pr-2 rounded border border-slate-200 text-xs text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Measurements Table */}
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] whitespace-nowrap">
                            <th className="py-2 px-3">Fecha</th>
                            <th className="py-2 px-3">Ubicación</th>
                            <th className="py-2 px-3 text-center">Temp. Interna</th>
                            <th className="py-2 px-3 text-center">Temp. Externa</th>
                            <th className="py-2 px-3 text-center">Humedad</th>
                            <th className="py-2 px-3 text-center w-24">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredMediciones.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-14 text-center text-slate-400 italic text-xs">
                                Sin datos
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
                                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                    {formattedDate}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-slate-800">
                                    {med.ubicacionNombre}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700">
                                    {med.temperaturaInterna} °C
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700">
                                    {med.temperaturaExterna} °C
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700">
                                    {med.humedad} %
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => handleEditMedicion(med)}
                                        className="w-6 h-6 rounded bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                        title="Editar"
                                      >
                                        <FiEdit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteMedicion(med)}
                                        className="w-6 h-6 rounded bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                        title="Eliminar"
                                      >
                                        <FiTrash2 size={11} />
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
            </div>
          </div>
        )}

        {/* ─── 2. VIEW: REGISTRAR / NUEVA MEDIDA ─── */}
        {activeSubTab === "REGISTRAR" && (
          <div className="space-y-4">
            
            {/* Header with Title & Top Guardar Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {editingMedicion ? "Editar medida de temperatura y humedad" : "Nueva medida de temperatura y humedad"}
                </h2>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-0.5">
                  <FiHome size={12} className="text-slate-400" />
                  <span>/</span>
                  <span>Temperatura y humedad - Medidas</span>
                  <span>/</span>
                  <span className="text-slate-600 font-semibold">
                    {editingMedicion ? "Editar medida" : "Nueva medida de temperatura y humedad"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveMedicion}
                disabled={saving}
                className="h-8 px-5 bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>

            {/* Form Card: Información Básica */}
            <form onSubmit={handleSaveMedicion} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-5">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800">Información básica</h3>
              </div>

              <div className="space-y-4 max-w-2xl">
                
                {/* Ubicación */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2">
                    Ubicación*
                  </label>
                  <div className="sm:col-span-2">
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
                </div>

                {/* Fecha de Medida */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2">
                    Fecha de medida*
                  </label>
                  <div className="sm:col-span-2 relative">
                    <input
                      type="datetime-local"
                      required
                      value={medicionForm.fechaMedida}
                      onChange={(e) => setMedicionForm({ ...medicionForm, fechaMedida: e.target.value })}
                      className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Temperatura Interna */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2">
                    Temperatura interna*
                  </label>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="Temperatura interna"
                      value={medicionForm.temperaturaInterna}
                      onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaInterna: e.target.value })}
                      className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Temperatura Externa */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2">
                    Temperatura externa*
                  </label>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="Temperatura externa"
                      value={medicionForm.temperaturaExterna}
                      onChange={(e) => setMedicionForm({ ...medicionForm, temperaturaExterna: e.target.value })}
                      className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Humedad */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2">
                    Humedad*
                  </label>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="1"
                      required
                      placeholder="Humedad"
                      value={medicionForm.humedad}
                      onChange={(e) => setMedicionForm({ ...medicionForm, humedad: e.target.value })}
                      className="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-2">
                  <label className="text-xs font-medium text-slate-600 sm:text-right pr-2 pt-1">
                    Observaciones
                  </label>
                  <div className="sm:col-span-2">
                    <textarea
                      rows="3"
                      placeholder="Observaciones"
                      value={medicionForm.observaciones}
                      onChange={(e) => setMedicionForm({ ...medicionForm, observaciones: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

              </div>

              {/* Form Bottom Guardar Button */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-5 bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── 3. VIEW: UBICACIONES ─── */}
        {activeSubTab === "UBICACIONES" && (
          <div className="space-y-4">
            
            {/* Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Ubicaciones</h2>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-0.5">
                  <FiHome size={12} className="text-slate-400" />
                  <span>/</span>
                  <span>Temperatura y humedad - Ubicaciones</span>
                </div>
              </div>
            </div>

            {locationFormOpen ? (
              <form onSubmit={handleSaveLocation} className="max-w-lg bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                    Ubicaciones / {editingLocation ? "Editar" : "Nueva"}
                  </span>
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
                    className="h-8 px-4 rounded-lg bg-[#8dc63f] hover:bg-[#7db02b] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full max-w-sm">
                    <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTableQuery}
                      onChange={(e) => setSearchTableQuery(e.target.value)}
                      placeholder="Buscar ubicación..."
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    onClick={handleNewLocation}
                    className="h-8 px-3.5 flex items-center justify-center bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
                  >
                    <FiPlus size={13} />
                    <span>Nueva ubicación</span>
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] whitespace-nowrap">
                          <th className="py-2.5 px-4">Nombre de la Ubicación</th>
                          <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {locations.length === 0 ? (
                          <tr>
                            <td colSpan="2" className="py-14 text-center text-slate-400 italic text-xs">
                              Sin datos
                            </td>
                          </tr>
                        ) : (
                          locations
                            .filter(l => (l.nombre || "").toLowerCase().includes(searchTableQuery.toLowerCase()))
                            .map(loc => (
                              <tr key={loc.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-slate-800">{loc.nombre}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleEditLocation(loc)}
                                      className="w-6 h-6 rounded bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                      title="Editar"
                                    >
                                      <FiEdit2 size={11} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLocation(loc)}
                                      className="w-6 h-6 rounded bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                      title="Eliminar"
                                    >
                                      <FiTrash2 size={11} />
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
              </div>
            )}
          </div>
        )}

        {/* ─── 4. VIEW: GRAFICAR MEDICIONES ─── */}
        {activeSubTab === "GRAFICAR" && (
          <div className="space-y-4">
            
            {/* Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Gráficos</h2>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-0.5">
                  <FiHome size={12} className="text-slate-400" />
                  <span>/</span>
                  <span>Temperatura y humedad - Gráficos</span>
                </div>
              </div>
            </div>

            {/* Filters Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[11px] font-semibold text-slate-600">Ubicación</label>
                  <select
                    value={graphUbicacion}
                    onChange={(e) => setGraphUbicacion(e.target.value)}
                    className="w-full sm:w-48 h-8 px-3 rounded-lg border border-slate-200 text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="">Todas las ubicaciones</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={graphStartDate}
                      onChange={(e) => setGraphStartDate(e.target.value)}
                      className="w-full sm:w-40 h-8 px-3 pr-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                      max="9999-12-31" min="1900-01-01" 
                    />
                    <FiCalendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={graphEndDate}
                      onChange={(e) => setGraphEndDate(e.target.value)}
                      className="w-full sm:w-40 h-8 px-3 pr-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 bg-white outline-none focus:border-emerald-500 transition-colors"
                      max="9999-12-31" min="1900-01-01" 
                    />
                    <FiCalendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAppliedGraphUbicacion(graphUbicacion);
                    setAppliedGraphStartDate(graphStartDate);
                    setAppliedGraphEndDate(graphEndDate);
                  }}
                  className="h-8 px-5 flex items-center justify-center bg-[#8dc63f] hover:bg-[#7db02b] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  Buscar
                </button>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-14 text-center text-slate-400 italic text-xs">
                Sin datos en este periodo seleccionado.
              </div>
            ) : (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
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
