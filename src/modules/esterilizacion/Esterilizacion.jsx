import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar, FiPlus, FiSearch, FiTrash2, FiEye, FiArrowLeft, FiSave, FiUploadCloud, FiClock, FiCheckCircle } from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { resolvePrivateFileUrl, uploadPrivateFile } from "../../services/privateStorageService";

export default function Esterilizacion() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";

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
  
  const [nroPaquetes, setNroPaquetes] = useState(1);
  const [horaInicio, setHoraInicio] = useState("08:00 AM");
  const [horaFin, setHoraFin] = useState("09:00 AM");
  const [temperatura, setTemperatura] = useState(121);
  const [presion, setPresion] = useState(15);
  
  const [responsableTipo, setResponsableTipo] = useState("usuario"); // usuario or otro
  const [responsableUsuario, setResponsableUsuario] = useState("");
  const [responsableOtro, setResponsableOtro] = useState("");
  const [usersList, setUsersList] = useState([]);

  const [quimicoImg, setQuimicoImg] = useState("");
  const [biologicoImg, setBiologicoImg] = useState("");
  const [quimicoPreview, setQuimicoPreview] = useState("");
  const [biologicoPreview, setBiologicoPreview] = useState("");
  const [uploadingQuimico, setUploadingQuimico] = useState(false);
  const [uploadingBiologico, setUploadingBiologico] = useState(false);

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeCycleDetail, setActiveCycleDetail] = useState(null);

  // Load clinic users/staff for dropdown
  useEffect(() => {
    if (!inquilino) return;
    const loadUsers = async () => {
      try {
        const [pRes, cfgRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("tenant_id", inquilino),
          supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle()
        ]);
        
        const map = new Map();
        
        (pRes.data || []).forEach(p => {
          const name = p.nombreCompleto || p.nombre || p.full_name || p.email;
          if (name) map.set(name.toUpperCase().trim(), name.toUpperCase().trim());
        });

        const cfgUsers = cfgRes.data?.config?.usuarios || [];
        cfgUsers.forEach(u => {
          const name = u.nombreCompleto || u.nombre || u.name;
          if (name) map.set(name.toUpperCase().trim(), name.toUpperCase().trim());
        });

        const currentName = userProfile?.nombreCompleto || userProfile?.nombre;
        if (currentName) {
          map.set(currentName.toUpperCase().trim(), currentName.toUpperCase().trim());
        }

        const sorted = Array.from(map.values()).sort();
        setUsersList(sorted);
        if (currentName) {
          setResponsableUsuario(currentName.toUpperCase().trim());
        }
      } catch (err) {
        console.error("Error loading clinic users for sterilization:", err);
      }
    };
    loadUsers();
  }, [inquilino, userProfile]);

  const loadCycles = async () => {
    if (!inquilino) return;
    setLoading(true);
    try {
      let list = [];
      try {
        const { data: snap, error: tErr } = await supabase
          .from("ciclos_esterilizacion")
          .select("*")
          .eq("tenant_id", inquilino);
        if (!tErr && snap && snap.length > 0) {
          list = snap;
        }
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.ciclos_esterilizacion || [];
      }

      const formatted = await Promise.all(list.map(async (docData, idx) => ({
        id: docData.id || `cycle_${idx}`,
        consecutivo: idx + 1,
        ...docData,
        quimicoImg: await resolvePrivateFileUrl(docData.quimicoImg || ""),
        biologicoImg: await resolvePrivateFileUrl(docData.biologicoImg || docData.biologcioImg || "")
      })));
      formatted.sort((a, b) => (b.fechaEsterilizacion || "").localeCompare(a.fechaEsterilizacion || ""));
      setCycles(formatted);
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

    const newItem = { concepto: conceptoCarga.toUpperCase().trim(), cantidad: qty };
    const updated = [...cargaItems, newItem];
    setCargaItems(updated);
    
    // Auto-calcula la suma total de paquetes
    const totalPkgs = updated.reduce((sum, item) => sum + (parseInt(item.cantidad) || 0), 0);
    setNroPaquetes(totalPkgs);

    setConceptoCarga("");
    setCantidadCarga(1);
  };

  const handleRemoveCargaItem = (idx) => {
    const updated = cargaItems.filter((_, i) => i !== idx);
    setCargaItems(updated);
    const totalPkgs = updated.reduce((sum, item) => sum + (parseInt(item.cantidad) || 0), 0);
    setNroPaquetes(totalPkgs);
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === "quimico") setUploadingQuimico(true);
    if (type === "biologico") setUploadingBiologico(true);

    try {
      const fileExt = file.name.split('.').pop();
      const uploaded = await uploadPrivateFile({
        tenantId: inquilino,
        relativePath: `esterilizacion/${Date.now()}.${fileExt}`,
        file,
        upsert: true,
        optimizationProfile: "standard"
      });

      if (type === "quimico") {
        setQuimicoImg(uploaded.reference);
        setQuimicoPreview(uploaded.signedUrl);
        toast.success("Control químico cargado");
      } else {
        setBiologicoImg(uploaded.reference);
        setBiologicoPreview(uploaded.signedUrl);
        toast.success("Control biológico cargado");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error al subir la imagen");
    } finally {
      if (type === "quimico") setUploadingQuimico(false);
      if (type === "biologico") setUploadingBiologico(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (cargaItems.length === 0) {
      toast.error("Debe agregar al menos un ítem al contenido de la carga.");
      return;
    }

    const respName = responsableTipo === "usuario"
      ? (responsableUsuario || "").trim()
      : (responsableOtro || "").trim();

    if (!respName) {
      toast.error(responsableTipo === "usuario" ? "Seleccione un usuario responsable." : "Ingrese el nombre del responsable.");
      return;
    }

    setSaving(true);

    try {
      const newCycle = {
        id: `cycle_${Date.now()}`,
        fechaEsterilizacion,
        cargaItems,
        nroPaquetes: parseInt(nroPaquetes) || 1,
        horaInicio,
        horaFin,
        temperatura: parseFloat(temperatura) || 121,
        presion: parseFloat(presion) || 15,
        responsable: respName,
        quimicoImg,
        biologicoImg,
        createdAt: new Date().toISOString()
      };

      // 1. Save to DB table
      let savedInTable = false;
      try {
        const { error: insErr } = await supabase
          .from("ciclos_esterilizacion")
          .insert({
            ...newCycle,
            tenant_id: inquilino
          });
        if (!insErr) savedInTable = true;
      } catch (e) {}

      // 2. Save in website_config fallback
      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        const currentConfig = cfgRow?.config || {};
        const currentList = currentConfig.ciclos_esterilizacion || [];
        const updatedList = [newCycle, ...currentList];

        await supabase
          .from("website_config")
          .upsert({
            tenant_id: inquilino,
            config: {
              ...currentConfig,
              ciclos_esterilizacion: updatedList
            },
            updated_at: new Date().toISOString()
          }, { onConflict: "tenant_id" });
      } catch (e) {}

      toast.success("Ciclo de esterilización guardado exitosamente");
      setView("list");
      loadCycles();

      // Reset form
      setCargaItems([]);
      setConceptoCarga("");
      setCantidadCarga(1);
      setQuimicoImg("");
      setBiologicoImg("");
      setQuimicoPreview("");
      setBiologicoPreview("");
    } catch (err) {
      console.error("Error saving sterilization cycle:", err);
      toast.error("Error al guardar el ciclo de esterilización");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cycleId) => {
    if (!window.confirm("¿Está seguro de eliminar este registro de esterilización?")) return;

    try {
      try {
        await supabase
          .from("ciclos_esterilizacion")
          .delete()
          .eq("tenant_id", inquilino)
          .eq("id", cycleId);
      } catch (e) {}

      try {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();

        if (cfgRow?.config?.ciclos_esterilizacion) {
          const updated = cfgRow.config.ciclos_esterilizacion.filter(c => c.id !== cycleId);
          await supabase
            .from("website_config")
            .upsert({
              tenant_id: inquilino,
              config: {
                ...cfgRow.config,
                ciclos_esterilizacion: updated
              },
              updated_at: new Date().toISOString()
            }, { onConflict: "tenant_id" });
        }
      } catch (e) {}

      toast.success("Registro eliminado correctamente");
      loadCycles();
    } catch (err) {
      console.error("Error deleting sterilization cycle:", err);
      toast.error("Error al eliminar el registro");
    }
  };

  const handleExportExcel = () => {
    try {
      if (filteredCycles.length === 0) {
        toast.warning("No hay registros para exportar");
        return;
      }

      import("xlsx").then((XLSX) => {
        const dataToExport = filteredCycles.map((c) => ({
          "N° de lote": c.nroLote || c.consecutivo || "1",
          "Fecha de esterilización": c.fechaEsterilizacion || "",
          "Fecha de creación": (c.createdAt || c.created_at || "").split("T")[0] || c.fechaEsterilizacion,
          "N° de carga": c.nroCarga || c.consecutivo || "1",
          "N° de paquetes": c.nroPaquetes || 1,
          "Contenido de la carga": (c.cargaItems || []).map(i => `${i.concepto} (x${i.cantidad})`).join(", "),
          "Hora de inicio del ciclo": c.horaInicio || "",
          "Hora de fin del ciclo": c.horaFin || "",
          "Temperatura en grados": `${c.temperatura || 121} °C`,
          "Presión en libras": `${c.presion || 15} PSI`,
          "Responsable": (c.responsable || "").toUpperCase(),
          "Activo": "Sí"
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Esterilización");
        XLSX.writeFile(wb, `Reporte_Esterilizacion_${appliedRange.start}_${appliedRange.end}.xlsx`);
        toast.success("Archivo Excel exportado con éxito");
      });
    } catch (err) {
      console.error("Error exporting excel:", err);
      toast.error("Error al exportar a Excel");
    }
  };

  const filteredCycles = useMemo(() => {
    return cycles.filter(c => {
      const date = c.fechaEsterilizacion || "";
      const matchesDate = date >= appliedRange.start && date <= appliedRange.end;
      if (!matchesDate) return false;

      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const resp = (c.responsable || "").toLowerCase();
        const itemsStr = (c.cargaItems || []).map(i => i.concepto).join(" ").toLowerCase();
        const lote = String(c.nroLote || c.consecutivo || "").toLowerCase();
        return resp.includes(q) || itemsStr.includes(q) || lote.includes(q);
      }
      return true;
    });
  }, [cycles, appliedRange, searchQuery]);

  if (view === "list") {
    return (
      <div className="space-y-4 animate-in fade-in duration-300 w-full max-w-7xl mx-auto pb-12">
        
        {/* ─── ENCABEZADO Y BREADCRUMB 1:1 ORALDRIVE ─── */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              Esterilización
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span>🏠 Administración - Esterilización</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setView("new")}
            className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs shrink-0"
          >
            Agregar ciclo
          </button>
        </div>

        {/* ─── TARJETA DE FILTROS 1:1 ORALDRIVE ─── */}
        <div className="mx-6 bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
          <form onSubmit={handleSearch} className="flex flex-col lg:flex-row items-center justify-center gap-6">
            
            {/* Fecha Inicial */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <label className="text-xs font-normal text-slate-500 shrink-0 w-24 text-right">Fecha inicial</label>
              <div className="relative flex-1 lg:w-48">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                  max="9999-12-31" min="1900-01-01" 
                />
              </div>
            </div>

            {/* Fecha Final */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <label className="text-xs font-normal text-slate-500 shrink-0 w-20 text-right">Fecha final</label>
              <div className="relative flex-1 lg:w-48">
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                  max="9999-12-31" min="1900-01-01" 
                />
              </div>
            </div>

            {/* Botón Buscar Verde */}
            <button
              type="submit"
              className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs shrink-0"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* ─── TARJETA TABLA DATAGRID 1:1 ORALDRIVE ─── */}
        <div className="mx-6 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* Barra Superior DataGrid */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-400">
            <span className="italic text-[11px]">Drag a column header here to group by that column</span>
            <div className="flex items-center gap-2">
              {/* Botón Excel */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                title="Exportar a Excel"
              >
                <span className="text-xs font-bold font-mono">📊</span>
              </button>

              {/* Buscador */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input 
                  type="text" 
                  placeholder="Search..."
                  className="h-7 pl-8 pr-2.5 w-44 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-sky-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabla de Registros */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] min-w-[1300px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold whitespace-nowrap">
                  <th className="py-2.5 px-3 border-r border-slate-200 w-20">N° de lote</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Fecha de esterilización</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Fecha de creación</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-20">N° de carga</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">N° de paquetes</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Contenido de la carga</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Hora de inicio del ciclo</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Hora de fin del ciclo</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Temperatura en grados</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Presión en libras</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Responsable</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-16">Activo</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Control químico</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Control Biológico</th>
                  <th className="py-2.5 px-3 text-center w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap">
                {loading ? (
                  <tr>
                    <td colSpan="15" className="py-16 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span className="text-xs font-medium">Cargando registros...</span>
                    </td>
                  </tr>
                ) : filteredCycles.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="py-12 text-center text-slate-400 text-xs">
                      No data
                    </td>
                  </tr>
                ) : (
                  filteredCycles.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-700 text-center">{c.nroLote || c.consecutivo}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-slate-800 font-medium">{c.fechaEsterilizacion}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-slate-500">{(c.createdAt || c.created_at || "").split("T")[0] || c.fechaEsterilizacion}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-600">{c.nroCarga || c.consecutivo}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-800">{c.nroPaquetes || 1}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-slate-600 truncate max-w-xs" title={(c.cargaItems || []).map(i => `${i.concepto} (x${i.cantidad})`).join(", ")}>
                        {(c.cargaItems || []).map(i => `${i.concepto} (x${i.cantidad})`).join(", ") || "—"}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-600 font-mono">{c.horaInicio}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-600 font-mono">{c.horaFin}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-800 font-semibold">{c.temperatura}°C</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-800 font-semibold">{c.presion} psi</td>
                      <td className="py-2 px-3 border-r border-slate-100 font-medium text-slate-700 uppercase">{c.responsable}</td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Activo" />
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center">
                        {c.quimicoImg ? (
                          <a
                            href={c.quimicoImg}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline"
                          >
                            Ver foto
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Sin comprobante</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 text-center">
                        {c.biologicoImg ? (
                          <a
                            href={c.biologicoImg}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline"
                          >
                            Ver foto
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Sin comprobante</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveCycleDetail(c);
                              setShowDetailModal(true);
                            }}
                            className="w-6 h-6 rounded border border-slate-200 bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Ver detalles"
                          >
                            <FiEye size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="w-6 h-6 rounded border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
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

        {/* Details View Modal */}
        {showDetailModal && activeCycleDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Detalle del Ciclo #{activeCycleDetail.consecutivo}
                  </h3>
                  <p className="text-xs text-slate-400">Fecha: {activeCycleDetail.fechaEsterilizacion}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Horario:</span>
                    <span className="font-semibold text-slate-700">{activeCycleDetail.horaInicio} - {activeCycleDetail.horaFin}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Temperatura / Presión:</span>
                    <span className="font-semibold text-blue-600">{activeCycleDetail.temperatura}°C / {activeCycleDetail.presion} psi</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Número de Paquetes:</span>
                    <span className="font-semibold text-slate-700">{activeCycleDetail.nroPaquetes}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Responsable:</span>
                    <span className="font-semibold text-slate-800 uppercase">{activeCycleDetail.responsable}</span>
                  </div>
                </div>

                {/* Table of items inside cycle */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Contenido de la carga:</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="px-3 py-2">Concepto</th>
                          <th className="px-3 py-2 text-center w-24">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeCycleDetail.cargaItems?.map((itm, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-semibold text-slate-700 uppercase">{itm.concepto}</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-600">{itm.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Image verification blocks */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Control Químico:</span>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                      {activeCycleDetail.quimicoImg ? (
                        <img src={activeCycleDetail.quimicoImg} alt="Control Químico" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin comprobante</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Control Biológico:</span>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                      {activeCycleDetail.biologicoImg ? (
                        <img src={activeCycleDetail.biologicoImg} alt="Control Biológico" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin comprobante</span>
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
    <div className="w-full max-w-6xl mx-auto animate-in fade-in duration-300 space-y-4 pb-12">
      
      {/* ─── ENCABEZADO Y BREADCRUMB 1:1 ORALDRIVE ─── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setView("list")}
            className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer mr-1"
            title="Volver"
          >
            <FiArrowLeft size={14} />
          </button>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Nuevo ciclo
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>🏠 - Esterilización - Nuevo ciclo</span>
          </div>
        </div>

        <button 
          type="button"
          onClick={handleSave}
          disabled={saving || cargaItems.length === 0}
          className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* ─── TARJETA CICLO 1:1 ORALDRIVE ─── */}
      <div className="mx-6 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 bg-white">
          <h3 className="text-xs font-bold text-slate-700">Ciclo</h3>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-5 max-w-4xl">
          
          {/* 1. Fecha esterilización */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Fecha esterilización*
            </label>
            <div className="relative w-full sm:w-64">
              <input
                type="date"
                required
                className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                value={fechaEsterilizacion}
                onChange={e => setFechaEsterilizacion(e.target.value)}
                max="9999-12-31" min="1900-01-01" 
              />
            </div>
          </div>

          {/* 2. Contenido de la carga */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Contenido de la carga*
            </label>
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <input
                type="text"
                placeholder="agregar ítems"
                className="w-full sm:w-72 h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                value={conceptoCarga}
                onChange={e => setConceptoCarga(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Cantidad</span>
                <input
                  type="number"
                  min="1"
                  className="w-16 h-8 px-2 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 text-center"
                  value={cantidadCarga}
                  onChange={e => setCantidadCarga(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddCargaItem}
                  className="h-8 px-4 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs shrink-0"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de ítems agregados */}
          {cargaItems.length > 0 && (
            <div className="sm:ml-48 max-w-xl border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2 px-3">Concepto</th>
                    <th className="py-2 px-3 text-center w-24">Cantidad</th>
                    <th className="py-2 px-3 text-center w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargaItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-800 uppercase">{itm.concepto}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-600">{itm.cantidad}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCargaItem(idx)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent mx-auto"
                          title="Eliminar"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. Número de paquetes */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Numero de paquetes*
            </label>
            <input
              type="number"
              min="1"
              required
              className="w-full sm:w-64 h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
              value={nroPaquetes}
              onChange={e => setNroPaquetes(e.target.value)}
            />
          </div>

          {/* 4. Hora inicio */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Hora inicio
            </label>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="08:00 am"
                className="w-full h-8 px-3 pr-8 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
              />
              <FiClock className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            </div>
          </div>

          {/* 5. Hora fin */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Hora fin
            </label>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="09:00 am"
                className="w-full h-8 px-3 pr-8 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
                value={horaFin}
                onChange={e => setHoraFin(e.target.value)}
              />
              <FiClock className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            </div>
          </div>

          {/* 6. Temperatura */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Temperatura*
            </label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full sm:w-64 h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
              value={temperatura}
              onChange={e => setTemperatura(e.target.value)}
            />
          </div>

          {/* 7. Presión en libras */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0">
              Presión en libras*
            </label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full sm:w-64 h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all"
              value={presion}
              onChange={e => setPresion(e.target.value)}
            />
          </div>

          {/* 8. Responsable */}
          <div className="flex flex-col sm:flex-row items-start sm:items-start gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0 pt-1">
              Responsable
            </label>
            <div className="w-full sm:w-96 space-y-2">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                  <input
                    type="radio"
                    name="responsableTipo"
                    value="usuario"
                    checked={responsableTipo === "usuario"}
                    onChange={() => setResponsableTipo("usuario")}
                    className="w-3.5 h-3.5 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Usuario</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                  <input
                    type="radio"
                    name="responsableTipo"
                    value="otro"
                    checked={responsableTipo === "otro"}
                    onChange={() => setResponsableTipo("otro")}
                    className="w-3.5 h-3.5 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Libre</span>
                </label>
              </div>

              {responsableTipo === "usuario" ? (
                <select
                  value={responsableUsuario}
                  onChange={e => setResponsableUsuario(e.target.value)}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all cursor-pointer font-medium"
                  required
                >
                  <option value="">Seleccione...</option>
                  {usersList.map((userName, i) => (
                    <option key={i} value={userName}>{userName}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Nombre del responsable..."
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-sky-500 transition-all uppercase font-medium"
                  value={responsableOtro}
                  onChange={e => setResponsableOtro(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* 9. Control químico */}
          <div className="flex flex-col sm:flex-row items-start sm:items-start gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0 pt-2">
              Control químico
            </label>
            <div className="w-full sm:w-[480px]">
              <div className="border border-dashed border-slate-200 rounded bg-white p-6 flex flex-col items-center justify-center gap-2 relative cursor-pointer hover:bg-slate-50/70 transition-colors min-h-[100px]">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={e => handleImageUpload(e, "quimico")}
                  disabled={uploadingQuimico}
                />
                {uploadingQuimico ? (
                  <span className="text-xs text-sky-600 font-semibold animate-pulse">Subiendo imagen...</span>
                ) : quimicoPreview ? (
                  <img src={quimicoPreview} alt="Control Químico" className="max-h-[100px] object-contain rounded" />
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-slate-600">Arrastra o click para cargar la foto.</p>
                    <p className="text-[11px] text-slate-400">Cargue su imagen aquí</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 10. Control biológico */}
          <div className="flex flex-col sm:flex-row items-start sm:items-start gap-3">
            <label className="text-xs text-slate-500 sm:w-44 sm:text-right shrink-0 pt-2">
              Control biológico
            </label>
            <div className="w-full sm:w-[480px]">
              <div className="border border-dashed border-slate-200 rounded bg-white p-6 flex flex-col items-center justify-center gap-2 relative cursor-pointer hover:bg-slate-50/70 transition-colors min-h-[100px]">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={e => handleImageUpload(e, "biologico")}
                  disabled={uploadingBiologico}
                />
                {uploadingBiologico ? (
                  <span className="text-xs text-sky-600 font-semibold animate-pulse">Subiendo imagen...</span>
                ) : biologicoPreview ? (
                  <img src={biologicoPreview} alt="Control Biológico" className="max-h-[100px] object-contain rounded" />
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-slate-600">Arrastra o click para cargar la foto.</p>
                    <p className="text-[11px] text-slate-400">Cargue su imagen aquí</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ─── BOTÓN GUARDAR INFERIOR 1:1 ORALDRIVE ─── */}
      <div className="mx-6 flex justify-end">
        <button 
          type="button"
          onClick={handleSave}
          disabled={saving || cargaItems.length === 0}
          className="h-8 px-6 bg-[#7cb342] hover:bg-[#689f38] active:scale-95 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
