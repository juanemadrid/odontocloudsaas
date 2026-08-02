import React, { useState, useEffect } from "react";
import supabase from "../../../lib/supabaseClient";
import { normalizeScheduleRow } from "../../../services/agendaAvailabilityService";
import { useAuth } from "../../../context/AuthContext";
import { 
  FiSearch, FiEdit2, FiPlus, FiSave, FiX, FiCheck, FiUsers, FiPhone, FiInfo, FiTrash2, FiActivity, FiClock, FiChevronLeft, FiCalendar 
} from "react-icons/fi";

export default function GestionAgenda() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino;

  const [activeTab, setActiveTab] = useState("profesionales"); // 'profesionales' | 'recursos'
  const [searchTerm, setSearchTerm] = useState("");

  // Main data states
  const [professionals, setProfessionals] = useState([]);
  const [resources, setResources] = useState([]);
  const [loadingProfs, setLoadingProfs] = useState(true);
  const [loadingRes, setLoadingRes] = useState(true);

  // Selected professional for schedule management
  const [selectedProfForSchedule, setSelectedProfForSchedule] = useState(null);

  // Selected resource for schedule management
  const [selectedResForSchedule, setSelectedResForSchedule] = useState(null);

  // Active tab inside schedule management screen: 'predefinido' | 'abrir' | 'nodisponible'
  const [scheduleActiveTab, setScheduleActiveTab] = useState("predefinido");

  // Modals for professional basic info editing
  const [profModalOpen, setProfModalOpen] = useState(false);
  const [selectedProf, setSelectedProf] = useState(null);
  const [profForm, setProfForm] = useState({
    nombre: "",
    apellido: "",
    telefonoMovil: "",
    activo: true
  });

  // Modals for resources management
  const [resModalOpen, setResModalOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [resForm, setResForm] = useState({
    nombre: "",
    descripcion: "",
    active: true
  });

  // Scheduling states for the selected doctor
  const [predefinedSlots, setPredefinedSlots] = useState([]);
  const [openAgendaSlots, setOpenAgendaSlots] = useState([]);
  const [unavailableSlots, setUnavailableSlots] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Scheduling CRUD modals
  const [predModalOpen, setPredModalOpen] = useState(false);
  const [selectedPredSlot, setSelectedPredSlot] = useState(null);
  const [predForm, setPredForm] = useState({
    dias: {
      Lunes: false,
      Martes: false,
      "Miércoles": false,
      Jueves: false,
      Viernes: false,
      "Sábado": false,
      Domingo: false
    },
    horaInicio: "08:00",
    horaFin: "12:00",
    recursoId: "todos"
  });

  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [selectedOpenSlot, setSelectedOpenSlot] = useState(null);
  const [openForm, setOpenForm] = useState({
    fecha: "",
    horaInicio: "08:00",
    horaFin: "12:00"
  });

  const [unavailModalOpen, setUnavailModalOpen] = useState(false);
  const [selectedUnavailSlot, setSelectedUnavailSlot] = useState(null);
  const [unavailForm, setUnavailForm] = useState({
    fecha: "",
    horaInicio: "08:00",
    horaFin: "12:00",
    motivo: ""
  });

  const [saving, setSaving] = useState(false);

  // Checkboxes selection states for bulk delete
  const [selectedPredIds, setSelectedPredIds] = useState([]);
  const [selectedOpenIds, setSelectedOpenIds] = useState([]);
  const [selectedUnavailIds, setSelectedUnavailIds] = useState([]);

  // Reset selected checkboxes on tab/doctor/resource change
  useEffect(() => {
    setSelectedPredIds([]);
    setSelectedOpenIds([]);
    setSelectedUnavailIds([]);
  }, [selectedProfForSchedule, selectedResForSchedule, scheduleActiveTab]);

  // Time conversion helpers
  const format12h = (time24) => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  };

  const convertTo24h = (time12) => {
    if (!time12) return "08:00";
    const match = time12.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return time12;
    let [_, hStr, mStr, ampm] = match;
    let h = parseInt(hStr, 10);
    if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${mStr}`;
  };

  const getDayNameSpanish = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return days[date.getDay()];
  };

  const getDayOrderValue = (day) => {
    if (!day) return 99;
    const normalized = day.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    switch (normalized) {
      case "lunes": return 1;
      case "martes": return 2;
      case "miercoles": return 3;
      case "jueves": return 4;
      case "viernes": return 5;
      case "sabado": return 6;
      case "domingo": return 7;
      default: return 99;
    }
  };

  // Format date to dd/mm/aaaa
  const formatDateLocal = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  // Fetch Professionals (Doctors/Odontologists only) - Using profiles table from Supabase
  useEffect(() => {
    if (!inquilino) return;

    setLoadingProfs(true);
    Promise.all([
      supabase.from("profiles").select("*").eq("tenant_id", inquilino).eq("activo", true),
      supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle()
    ])
      .then(([profRes, cfgRes]) => {
        const userDetailsMap = cfgRes.data?.config?.user_details || {};
        const docs = profRes.data || [];

        // Filter ONLY doctors/odontologists (exclude admins and receptionists)
        const filtered = docs.filter(u => {
          const roleLower = (u.role || "").toLowerCase();
          const detail = userDetailsMap[u.id] || {};
          return roleLower.includes('odontólog') || 
                 roleLower.includes('odontolog') || 
                 roleLower.includes('doctor') ||
                 roleLower.includes('especialista') ||
                 detail.esDoctor === true ||
                 !!u.especialidad;
        }).map(u => {
          const detail = userDetailsMap[u.id] || {};
          const userNombre = detail.nombre || (u.full_name || '').split(' ')[0] || '';
          const userApellido = detail.apellido || (u.full_name || '').split(' ').slice(1).join(' ') || '';
          const updatedFullName = (detail.nombre || detail.apellido) 
            ? `${detail.nombre || ''} ${detail.apellido || ''}`.trim() 
            : (u.full_name || '');

          return {
            id: u.id,
            nombre: userNombre,
            apellido: userApellido,
            nombreCompleto: updatedFullName,
            email: u.email,
            telefono: detail.telefonoMovil || detail.telefonoFijo || u.telefono || '',
            telefonoMovil: detail.telefonoMovil || u.telefono || '',
            rol: u.role,
            especialidad: u.especialidad || (detail.especialidades ? detail.especialidades.join(', ') : ''),
            activo: u.activo !== false
          };
        });
        console.log('🔍 Profesionales filtrados (solo doctores):', filtered);
        setProfessionals(filtered);
        setLoadingProfs(false);
      }).catch(err => {
        console.error("Error fetching professionals:", err);
        setLoadingProfs(false);
      });
  }, [inquilino]);

  // Fetch Physical Resources
  useEffect(() => {
    if (!inquilino) return;

    setLoadingRes(true);
    supabase.from("consultorios").select("*").eq("tenant_id", inquilino).order("nombre", { ascending: true })
      .then(({ data }) => {
        setResources(data || []);
        setLoadingRes(false);
      }).catch(err => {
        console.error("Error fetching resources:", err);
        setLoadingRes(false);
      });
  }, [inquilino]);

  const reloadSchedule = async () => {
    const activeEntity = selectedProfForSchedule || selectedResForSchedule;
    if (!activeEntity || !inquilino) return;
    setLoadingSchedule(true);
    const isResource = !!selectedResForSchedule;
    const filterKey = isResource ? "consultorio_id" : "usuario_id";
    const mapForUi = (row) => {
      const normalized = normalizeScheduleRow(row);
      return {
        ...row,
        dia: normalized.day || (normalized.date ? getDayNameSpanish(normalized.date) : ""),
        fecha: normalized.date,
        horaInicio: normalized.startTime,
        horaFin: normalized.endTime,
        recursoId: normalized.roomId || "todos",
        recursoNombre: row.recurso_nombre || row.recursoNombre || (normalized.roomId ? resources.find(r => r.id === normalized.roomId)?.nombre : "Todos") || "Todos"
      };
    };
    const fetchRows = async (table) => {
      let query = supabase.from(table).select("*")
        .eq("tenant_id", inquilino).eq(filterKey, activeEntity.id);
      if (isResource) query = query.is("usuario_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapForUi);
    };
    try {
      const [weekly, open, unavailable] = await Promise.all([
        fetchRows("horarios_predefinidos"), fetchRows("agenda_abierta"), fetchRows("no_disponibles")
      ]);
      setPredefinedSlots(weekly);
      setOpenAgendaSlots(open);
      setUnavailableSlots(unavailable);
    } catch (error) {
      console.error("Error reloading schedules:", error);
      alert("No fue posible cargar los horarios: " + error.message);
    } finally {
      setLoadingSchedule(false);
    }
  };
  // Reload the selected professional or resource schedule from canonical tables.
  useEffect(() => {
    if ((!selectedProfForSchedule && !selectedResForSchedule) || !inquilino) return;
    reloadSchedule();
  }, [selectedProfForSchedule, selectedResForSchedule, inquilino]);

  // Save Professional basic info
  const handleSaveProf = async (e) => {
    e.preventDefault();
    if (!selectedProf || !inquilino) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: `${profForm.nombre.trim()} ${profForm.apellido.trim()}`.trim(),
        telefono: profForm.telefonoMovil.trim(),
        activo: profForm.activo,
        updated_at: new Date().toISOString()
      }).eq("tenant_id", inquilino).eq("id", selectedProf.id);
      if (error) throw error;
      setProfessionals(current => current.map(prof => prof.id === selectedProf.id ? {
        ...prof,
        nombre: profForm.nombre.trim(),
        apellido: profForm.apellido.trim(),
        nombreCompleto: `${profForm.nombre.trim()} ${profForm.apellido.trim()}`.trim(),
        telefono: profForm.telefonoMovil.trim(),
        telefonoMovil: profForm.telefonoMovil.trim(),
        activo: profForm.activo
      } : prof));
      setProfModalOpen(false);
      setSelectedProf(null);
    } catch (err) {
      console.error("Error updating professional:", err);
      alert("Error al actualizar el profesional: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  // Open resource edit modal
  const handleOpenResModal = (res = null) => {
    if (res) {
      setSelectedRes(res);
      setResForm({
        nombre: res.nombre || "",
        descripcion: res.ubicacion || "", // Supabase uses 'ubicacion'
        active: res.activo !== false // Supabase uses 'activo'
      });
    } else {
      setSelectedRes(null);
      setResForm({
        nombre: "",
        descripcion: "",
        active: true
      });
    }
    setResModalOpen(true);
  };

  // Save resource (consultorio)
  const handleSaveRes = async (e) => {
    e.preventDefault();
    if (!inquilino) return;
    if (!resForm.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    try {
      if (selectedRes) {
        const { error } = await supabase.from("consultorios").update({
          nombre: resForm.nombre.trim(),
          ubicacion: resForm.descripcion.trim(),
          activo: resForm.active,
          updated_at: new Date().toISOString()
        }).eq("tenant_id", inquilino).eq("id", selectedRes.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultorios").insert([{
          tenant_id: inquilino,
          nombre: resForm.nombre.trim(),
          ubicacion: resForm.descripcion.trim(),
          activo: resForm.active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
        if (error) throw error;
      }
      setResModalOpen(false);
      setSelectedRes(null);
      const { data, error: reloadError } = await supabase.from("consultorios").select("*").eq("tenant_id", inquilino).order("nombre", { ascending: true });
      if (reloadError) throw reloadError;
      setResources(data || []);
    } catch (err) {
      console.error("Error saving resource:", err);
      alert("Error al guardar el consultorio: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  // Delete Resource (consultorio)
  const handleDeleteRes = async (id) => {
    if (!inquilino) return;
    if (!window.confirm("¿Está seguro de eliminar este consultorio? Las citas asociadas podrían perder su referencia.")) return;

    try {
      const { error } = await supabase.from("consultorios").delete().eq("tenant_id", inquilino).eq("id", id);
      if (error) throw error;
      // Reload resources after delete
      const { data, error: reloadError } = await supabase.from("consultorios").select("*").eq("tenant_id", inquilino).order("nombre", { ascending: true });
      if (reloadError) throw reloadError;
      setResources(data || []);
    } catch (err) {
      console.error("Error deleting resource:", err);
      alert("Error al eliminar el consultorio: " + err.message);
    }
  };

  // =========================================================================
  // SCHEDULING CRUD HANDLERS
  // =========================================================================

  // Predefined Weekly schedule Add/Edit
  const handleOpenPredModal = (slot = null) => {
    if (slot) {
      setSelectedPredSlot(slot);
      setPredForm({
        dias: {
          Lunes: slot.dia === "Lunes",
          Martes: slot.dia === "Martes",
          "Miércoles": slot.dia === "Miércoles",
          Jueves: slot.dia === "Jueves",
          Viernes: slot.dia === "Viernes",
          "Sábado": slot.dia === "Sábado",
          Domingo: slot.dia === "Domingo"
        },
        horaInicio: convertTo24h(slot.horaInicio),
        horaFin: convertTo24h(slot.horaFin),
        recursoId: slot.recursoId || "todos"
      });
    } else {
      setSelectedPredSlot(null);
      setPredForm({
        dias: {
          Lunes: true,
          Martes: false,
          "Miércoles": false,
          Jueves: false,
          Viernes: false,
          "Sábado": false,
          Domingo: false
        },
        horaInicio: "08:00",
        horaFin: "12:00",
        recursoId: "todos"
      });
    }
    setPredModalOpen(true);
  };



  const handleSavePred = async (e) => {
    e.preventDefault();
    const activeEntity = selectedProfForSchedule || selectedResForSchedule;
    if (!activeEntity || !inquilino) return;
    const selectedDays = Object.keys(predForm.dias).filter(d => predForm.dias[d]);
    if (!selectedDays.length) return alert("Debe seleccionar al menos un día de la semana");
    if (predForm.horaInicio >= predForm.horaFin) return alert("La hora final debe ser posterior a la hora inicial");
    setSaving(true);
    try {
      const isResource = !!selectedResForSchedule;
      const roomId = isResource ? activeEntity.id : (predForm.recursoId === "todos" ? null : predForm.recursoId);
      const selectedResource = resources.find(r => r.id === roomId);
      const rowForDay = (day) => ({
        tenant_id: inquilino,
        usuario_id: isResource ? null : activeEntity.id,
        consultorio_id: roomId,
        dia: day,
        hora_inicio: predForm.horaInicio,
        hora_fin: predForm.horaFin,
        recurso_nombre: roomId ? (selectedResource?.nombre || "Consultorio") : "Todos",
        activo: true
      });
      if (selectedPredSlot?.id) {
        const { error } = await supabase.from("horarios_predefinidos").update(rowForDay(selectedDays[0]))
          .eq("tenant_id", inquilino).eq("id", selectedPredSlot.id);
        if (error) throw error;
        if (selectedDays.length > 1) {
          const { error: insertError } = await supabase.from("horarios_predefinidos").insert(selectedDays.slice(1).map(rowForDay));
          if (insertError) throw insertError;
        }
      } else {
        const { error } = await supabase.from("horarios_predefinidos").insert(selectedDays.map(rowForDay));
        if (error) throw error;
      }
      setPredModalOpen(false);
      setScheduleActiveTab("predefinido");
      await reloadSchedule();
    } catch (error) {
      console.error("Error saving predefined schedule:", error);
      alert("Error al guardar horario: " + error.message);
    } finally { setSaving(false); }
  };
  const handleDeletePred = async (slotParam) => {
    const slotId = typeof slotParam === "object" ? slotParam?.id : slotParam;
    if (!slotId || !window.confirm("¿Desea eliminar este horario predefinido?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("horarios_predefinidos").delete()
        .eq("tenant_id", inquilino).eq("id", slotId);
      if (error) throw error;
      await reloadSchedule();
    } catch (error) {
      alert("Error al eliminar el horario: " + error.message);
    } finally { setSaving(false); }
  };
  const handleOpenOpenModal = (slot = null) => {
    if (slot) {
      setSelectedOpenSlot(slot);
      setOpenForm({
        fecha: slot.fecha,
        horaInicio: convertTo24h(slot.hora_inicio || slot.horaInicio),
        horaFin: convertTo24h(slot.hora_fin || slot.horaFin)
      });
    } else {
      setSelectedOpenSlot(null);
      setOpenForm({
        fecha: "",
        horaInicio: "08:00",
        horaFin: "12:00"
      });
    }
    setOpenModalOpen(true);
  };

  const handleSaveOpen = async (e) => {
    e.preventDefault();
    const activeEntity = selectedProfForSchedule || selectedResForSchedule;
    if (!activeEntity || !openForm.fecha || !inquilino) return;
    if (openForm.horaInicio >= openForm.horaFin) return alert("La hora final debe ser posterior a la hora inicial");
    setSaving(true);
    try {
      const isResource = !!selectedResForSchedule;
      const payload = {
        tenant_id: inquilino,
        usuario_id: isResource ? null : activeEntity.id,
        consultorio_id: isResource ? activeEntity.id : null,
        fecha: openForm.fecha,
        hora_inicio: openForm.horaInicio,
        hora_fin: openForm.horaFin,
        activo: true
      };
      const result = selectedOpenSlot?.id
        ? await supabase.from("agenda_abierta").update(payload).eq("tenant_id", inquilino).eq("id", selectedOpenSlot.id)
        : await supabase.from("agenda_abierta").insert([payload]);
      if (result.error) throw result.error;
      setOpenModalOpen(false);
      setScheduleActiveTab("abrir");
      await reloadSchedule();
    } catch (error) {
      alert("Error al guardar apertura: " + error.message);
    } finally { setSaving(false); }
  };
  const handleDeleteOpen = async (slotParam) => {
    const slotId = typeof slotParam === "object" ? slotParam?.id : slotParam;
    if (!slotId || !window.confirm("¿Desea eliminar esta fecha de apertura?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("agenda_abierta").delete()
        .eq("tenant_id", inquilino).eq("id", slotId);
      if (error) throw error;
      await reloadSchedule();
    } catch (error) { alert("Error al eliminar la apertura: " + error.message); }
    finally { setSaving(false); }
  };
  // Unavailable Schedule Add/Edit
  const handleOpenUnavailModal = (slot = null) => {
    if (slot) {
      setSelectedUnavailSlot(slot);
      setUnavailForm({
        fecha: slot.fecha,
        horaInicio: convertTo24h(slot.hora_inicio || slot.horaInicio),
        horaFin: convertTo24h(slot.hora_fin || slot.horaFin),
        motivo: slot.motivo || ""
      });
    } else {
      setSelectedUnavailSlot(null);
      setUnavailForm({
        fecha: "",
        horaInicio: "08:00",
        horaFin: "12:00",
        motivo: ""
      });
    }
    setUnavailModalOpen(true);
  };

  const handleSaveUnavail = async (e) => {
    e.preventDefault();
    const activeEntity = selectedProfForSchedule || selectedResForSchedule;
    if (!activeEntity || !unavailForm.fecha || !inquilino) return;
    if (unavailForm.horaInicio >= unavailForm.horaFin) return alert("La hora final debe ser posterior a la hora inicial");
    setSaving(true);
    try {
      const isResource = !!selectedResForSchedule;
      const payload = {
        tenant_id: inquilino,
        usuario_id: isResource ? null : activeEntity.id,
        consultorio_id: isResource ? activeEntity.id : null,
        fecha: unavailForm.fecha,
        hora_inicio: unavailForm.horaInicio,
        hora_fin: unavailForm.horaFin,
        motivo: unavailForm.motivo.trim(),
        activo: true
      };
      const result = selectedUnavailSlot?.id
        ? await supabase.from("no_disponibles").update(payload).eq("tenant_id", inquilino).eq("id", selectedUnavailSlot.id)
        : await supabase.from("no_disponibles").insert([payload]);
      if (result.error) throw result.error;
      setUnavailModalOpen(false);
      setScheduleActiveTab("nodisponible");
      await reloadSchedule();
    } catch (error) { alert("Error al guardar bloqueo: " + error.message); }
    finally { setSaving(false); }
  };
  const handleDeleteUnavail = async (slotParam) => {
    const slotId = typeof slotParam === "object" ? slotParam?.id : slotParam;
    if (!slotId || !window.confirm("¿Desea eliminar este bloqueo?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("no_disponibles").delete()
        .eq("tenant_id", inquilino).eq("id", slotId);
      if (error) throw error;
      await reloadSchedule();
    } catch (error) { alert("Error al eliminar el bloqueo: " + error.message); }
    finally { setSaving(false); }
  };
  const handleToggleSelectAllPred = () => {
    if (selectedPredIds.length === filteredPredSlots.length) {
      setSelectedPredIds([]);
    } else {
      setSelectedPredIds(filteredPredSlots.map(s => s.id));
    }
  };

  const handleToggleSelectPred = (id) => {
    setSelectedPredIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllOpen = () => {
    if (selectedOpenIds.length === filteredOpenSlots.length) {
      setSelectedOpenIds([]);
    } else {
      setSelectedOpenIds(filteredOpenSlots.map(s => s.id));
    }
  };

  const handleToggleSelectOpen = (id) => {
    setSelectedOpenIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllUnavail = () => {
    if (selectedUnavailIds.length === filteredUnavailSlots.length) {
      setSelectedUnavailIds([]);
    } else {
      setSelectedUnavailIds(filteredUnavailSlots.map(s => s.id));
    }
  };

  const handleToggleSelectUnavail = (id) => {
    setSelectedUnavailIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Bulk delete handler using Supabase
  const handleBulkDelete = async () => {
    let targetIds = [];
    let tableName = "";
    if (scheduleActiveTab === "predefinido") { targetIds = selectedPredIds; tableName = "horarios_predefinidos"; }
    if (scheduleActiveTab === "abrir") { targetIds = selectedOpenIds; tableName = "agenda_abierta"; }
    if (scheduleActiveTab === "nodisponible") { targetIds = selectedUnavailIds; tableName = "no_disponibles"; }
    if (!targetIds.length || !window.confirm(`¿Está seguro de eliminar los ${targetIds.length} horarios seleccionados?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from(tableName).delete().eq("tenant_id", inquilino).in("id", targetIds);
      if (error) throw error;
      setSelectedPredIds([]); setSelectedOpenIds([]); setSelectedUnavailIds([]);
      await reloadSchedule();
    } catch (error) { alert("Error al eliminar los horarios: " + error.message); }
    finally { setSaving(false); }
  };
  // Filter main lists based on search term
  const filteredProfs = professionals.filter(p => {
    const fullName = `${p.nombre || ""} ${p.apellido || ""}`.toLowerCase();
    const phone = (p.telefonoMovil || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || phone.includes(query) || email.includes(query);
  });

  const filteredResources = resources.filter(r => {
    const name = (r.nombre || "").toLowerCase();
    const desc = (r.descripcion || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || desc.includes(query);
  });

  // Filter and sort predefined slots by day of week
  const filteredPredSlots = predefinedSlots
    .filter(s => {
      const dia = (s.dia || "").toLowerCase();
      const recurso = (s.recursoNombre || "").toLowerCase();
      const query = searchTerm.toLowerCase();
      return dia.includes(query) || recurso.includes(query);
    })
    .sort((a, b) => {
      const orderA = getDayOrderValue(a.dia);
      const orderB = getDayOrderValue(b.dia);
      if (orderA !== orderB) return orderA - orderB;

      // Secondary sort: by start time
      const timeA = convertTo24h(a.horaInicio || "");
      const timeB = convertTo24h(b.horaInicio || "");
      return timeA.localeCompare(timeB);
    });

  const filteredOpenSlots = openAgendaSlots.filter(s => {
    const date = formatDateLocal(s.fecha).toLowerCase();
    const dia = (s.dia || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return date.includes(query) || dia.includes(query);
  });

  const filteredUnavailSlots = unavailableSlots.filter(s => {
    const date = formatDateLocal(s.fecha).toLowerCase();
    const dia = (s.dia || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return date.includes(query) || dia.includes(query);
  });

  // =========================================================================
  // VIEW RENDER: SCHEDULE CONFIGURATION DETAILS
  // =========================================================================
  if (selectedProfForSchedule || selectedResForSchedule) {
    const isDoctorMode = !!selectedProfForSchedule;
    const selectedEntity = selectedProfForSchedule || selectedResForSchedule;
    const profName = isDoctorMode
      ? (selectedProfForSchedule.nombreCompleto || `${selectedProfForSchedule.nombre || ""} ${selectedProfForSchedule.apellido || ""}`.trim())
      : selectedResForSchedule.nombre;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Breadcrumbs and Doctor title info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">
              <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => { setSelectedProfForSchedule(null); setSelectedResForSchedule(null); }}>Gestión de agenda</span>
              <span className="text-slate-200">/</span>
              <span className="text-blue-600">{profName}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <button 
                onClick={() => { setSelectedProfForSchedule(null); setSelectedResForSchedule(null); }}
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all"
                title="Volver"
              >
                <FiChevronLeft size={20} />
              </button>
              {profName}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-5 py-2.5 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider rounded-full shadow-md shadow-emerald-100 flex items-center gap-2">
              <FiClock className="text-base animate-pulse" />
              Tiempo y recursos
            </span>
            <button 
              onClick={() => {
                if (isDoctorMode) {
                  setSelectedProf(selectedProfForSchedule);
                  setProfForm({
                    nombre: selectedProfForSchedule.nombre || "",
                    apellido: selectedProfForSchedule.apellido || "",
                    telefonoMovil: selectedProfForSchedule.telefonoMovil || "",
                    activo: selectedProfForSchedule.activo !== false
                  });
                  setProfModalOpen(true);
                } else {
                  setSelectedRes(selectedResForSchedule);
                  setResForm({
                    nombre: selectedResForSchedule.nombre || "",
                    descripcion: selectedResForSchedule.descripcion || "",
                    active: selectedResForSchedule.active !== false
                  });
                  setResModalOpen(true);
                }
              }}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
            >
              <FiEdit2 />
              {isDoctorMode ? "Editar Perfil" : "Editar Consultorio"}
            </button>
          </div>
        </div>

        {/* ─── SCHEDULE TAB NAVIGATION & ACTIONS BAR ─── */}
        <div className="bg-white rounded-[24px] border border-slate-200/50 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sub-Tabs (Oral Drive style) */}
          <div className="flex bg-slate-100/80 p-1.5 rounded-[18px] border border-slate-200/20 w-fit">
            <button
              onClick={() => { setScheduleActiveTab("predefinido"); setSearchTerm(""); }}
              className={`
                px-5 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
                ${scheduleActiveTab === "predefinido"
                  ? "bg-white text-blue-600 shadow-md shadow-blue-50 font-black"
                  : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              <FiCalendar className="text-base" />
              Horario Predefinido
            </button>
            <button
              onClick={() => { setScheduleActiveTab("abrir"); setSearchTerm(""); }}
              className={`
                px-5 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
                ${scheduleActiveTab === "abrir"
                  ? "bg-white text-blue-600 shadow-md shadow-blue-50 font-black"
                  : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              <FiPlus className="text-base" />
              Abrir Agenda
            </button>
            <button
              onClick={() => { setScheduleActiveTab("nodisponible"); setSearchTerm(""); }}
              className={`
                px-5 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
                ${scheduleActiveTab === "nodisponible"
                  ? "bg-white text-blue-600 shadow-md shadow-blue-50 font-black"
                  : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              <FiX className="text-base" />
              No Disponible
            </button>
          </div>

          {/* Toolbar: Search and Create Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {((scheduleActiveTab === "predefinido" && selectedPredIds.length > 0) ||
              (scheduleActiveTab === "abrir" && selectedOpenIds.length > 0) ||
              (scheduleActiveTab === "nodisponible" && selectedUnavailIds.length > 0)) && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-red-100 transition-all active:scale-95 shrink-0 animate-fadeIn"
              >
                <FiTrash2 className="text-base" />
                Eliminar seleccionados
              </button>
            )}

            {/* Search bar */}
            <div className="relative group">
              <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR..."
                className="pl-11 pr-5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-[16px] text-[12px] font-bold text-slate-700 outline-none w-full sm:w-60 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all uppercase tracking-wider placeholder:text-slate-300 shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <FiX size={14} />
                </button>
              )}
            </div>

            {/* Create Schedule buttons */}
            {scheduleActiveTab === "predefinido" && (
              <button
                onClick={() => handleOpenPredModal()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all active:scale-95"
              >
                <FiPlus className="text-base" />
                Nuevo Horario
              </button>
            )}

            {scheduleActiveTab === "abrir" && (
              <button
                onClick={() => handleOpenOpenModal()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all active:scale-95"
              >
                <FiPlus className="text-base" />
                Agregar
              </button>
            )}

            {scheduleActiveTab === "nodisponible" && (
              <button
                onClick={() => handleOpenUnavailModal()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all active:scale-95"
              >
                <FiPlus className="text-base" />
                Agregar
              </button>
            )}
          </div>
        </div>

        {/* ─── DATA TABLE AREA (Schedule Configuration) ─── */}
        <div className="bg-white rounded-[24px] border border-slate-200/50 shadow-sm overflow-hidden">
          {scheduleActiveTab === "predefinido" && (
            /* =========================================================================
               SCHEDULE TAB: PREDEFINED
               ========================================================================= */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="w-12 px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                        checked={filteredPredSlots.length > 0 && selectedPredIds.length === filteredPredSlots.length}
                        onChange={handleToggleSelectAllPred}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Día</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Inicio</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Fin</th>
                    {isDoctorMode && (
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurso Físico</th>
                    )}
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSchedule ? (
                    <tr>
                      <td colSpan={isDoctorMode ? 6 : 5} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Cargando horario...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPredSlots.length === 0 ? (
                    <tr>
                      <td colSpan={isDoctorMode ? 6 : 5} className="px-6 py-16 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        No hay horarios predefinidos configurados
                      </td>
                    </tr>
                  ) : (
                    filteredPredSlots.map((slot) => (
                      <tr key={slot.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                            checked={selectedPredIds.includes(slot.id)}
                            onChange={() => handleToggleSelectPred(slot.id)}
                          />
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">{slot.dia}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio || slot.hora_inicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin || slot.hora_fin}</td>
                        {isDoctorMode && (
                          <td className="px-6 py-4 text-[12px] font-bold text-blue-600 uppercase">{slot.recursoNombre || slot.recurso_nombre || "Todos"}</td>
                        )}
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenPredModal(slot)}
                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Editar slot"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePred(slot)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Eliminar slot"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {scheduleActiveTab === "abrir" && (
            /* =========================================================================
               SCHEDULE TAB: OPEN AGENDA
               ========================================================================= */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="w-12 px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                        checked={filteredOpenSlots.length > 0 && selectedOpenIds.length === filteredOpenSlots.length}
                        onChange={handleToggleSelectAllOpen}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Día</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Inicio</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Fin</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOpenSlots.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        No hay información disponible
                      </td>
                    </tr>
                  ) : (
                    filteredOpenSlots.map((slot) => (
                      <tr key={slot.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                            checked={selectedOpenIds.includes(slot.id)}
                            onChange={() => handleToggleSelectOpen(slot.id)}
                          />
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-700">{formatDateLocal(slot.fecha)}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">{slot.dia}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio || slot.hora_inicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin || slot.hora_fin}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenOpenModal(slot)}
                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Editar"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteOpen(slot)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Eliminar"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {scheduleActiveTab === "nodisponible" && (
            /* =========================================================================
               SCHEDULE TAB: NOT AVAILABLE
               ========================================================================= */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="w-12 px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                        checked={filteredUnavailSlots.length > 0 && selectedUnavailIds.length === filteredUnavailSlots.length}
                        onChange={handleToggleSelectAllUnavail}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Día</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Inicio</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Fin</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnavailSlots.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        No hay información disponible
                      </td>
                    </tr>
                  ) : (
                    filteredUnavailSlots.map((slot) => (
                      <tr key={slot.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                            checked={selectedUnavailIds.includes(slot.id)}
                            onChange={() => handleToggleSelectUnavail(slot.id)}
                          />
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-700">{formatDateLocal(slot.fecha)}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">{slot.dia}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio || slot.hora_inicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin || slot.hora_fin}</td>
                        <td className="px-6 py-4 text-[12px] font-medium text-slate-500 uppercase">{slot.motivo || "—"}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenUnavailModal(slot)}
                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Editar"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteUnavail(slot)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Eliminar"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =========================================================================
           CRUD MODALS FOR DETAILED SCHEDULE VIEWS
           ========================================================================= */}

        {/* Modal: Predefined Weekly Schedule */}
        {predModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
              <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiCalendar className="text-blue-600" />
                  <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                    {selectedPredSlot ? "Editar Horario Predefinido" : "Nuevo Horario Predefinido"}
                  </h3>
                </div>
                <button onClick={() => setPredModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSavePred} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Días de la semana</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-[14px] shadow-inner">
                      {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d) => (
                        <label key={d} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            checked={predForm.dias[d] || false}
                            onChange={(e) => {
                              setPredForm(prev => ({
                                ...prev,
                                dias: {
                                  ...prev.dias,
                                  [d]: e.target.checked
                                }
                              }));
                            }}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Inicio</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={predForm.horaInicio}
                      onChange={(e) => setPredForm({ ...predForm, horaInicio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Fin</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={predForm.horaFin}
                      onChange={(e) => setPredForm({ ...predForm, horaFin: e.target.value })}
                    />
                  </div>

                  {selectedProfForSchedule && (
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recurso Físico / Consultorio</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all uppercase cursor-pointer"
                        value={predForm.recursoId}
                        onChange={(e) => setPredForm({ ...predForm, recursoId: e.target.value })}
                      >
                        <option value="todos">Todos</option>
                        {resources.map(r => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPredModalOpen(false)}
                    className="px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-[16px] bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-md shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiSave className="text-base" />
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Open Agenda / Abrir Agenda */}
        {openModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
              <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiPlus className="text-blue-600" />
                  <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                    {selectedOpenSlot ? "Editar Apertura de Agenda" : "Nuevo horario"}
                  </h3>
                </div>
                <button onClick={() => setOpenModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveOpen} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={openForm.fecha}
                    onChange={(e) => setOpenForm({ ...openForm, fecha: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Inicio *</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={openForm.horaInicio}
                      onChange={(e) => setOpenForm({ ...openForm, horaInicio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Fin *</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={openForm.horaFin}
                      onChange={(e) => setOpenForm({ ...openForm, horaFin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModalOpen(false)}
                    className="px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-[16px] bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-md shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiSave className="text-base" />
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Unavailable Dates / No Disponible */}
        {unavailModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
              <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiX className="text-blue-600" />
                  <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                    {selectedUnavailSlot ? "Editar Fecha No Disponible" : "Nuevo horario no disponible"}
                  </h3>
                </div>
                <button onClick={() => setUnavailModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveUnavail} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={unavailForm.fecha}
                    onChange={(e) => setUnavailForm({ ...unavailForm, fecha: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Inicio *</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={unavailForm.horaInicio}
                      onChange={(e) => setUnavailForm({ ...unavailForm, horaInicio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora Fin *</label>
                    <input
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      value={unavailForm.horaFin}
                      onChange={(e) => setUnavailForm({ ...unavailForm, horaFin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo / Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: Asistencia a Congreso, Vacaciones"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all uppercase"
                    value={unavailForm.motivo}
                    onChange={(e) => setUnavailForm({ ...unavailForm, motivo: e.target.value })}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUnavailModalOpen(false)}
                    className="px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-[16px] bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-md shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiSave className="text-base" />
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Doctor's profile basic details */}
        {profModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
              <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiUsers className="text-blue-600" />
                  <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Editar Profesional</h3>
                </div>
                <button onClick={() => setProfModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveProf} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombres</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 uppercase outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={profForm.nombre}
                    onChange={(e) => setProfForm({ ...profForm, nombre: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apellidos</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 uppercase outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={profForm.apellido}
                    onChange={(e) => setProfForm({ ...profForm, apellido: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teléfono Móvil</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-4 py-2.5 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={profForm.telefonoMovil}
                    onChange={(e) => setProfForm({ ...profForm, telefonoMovil: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-3 py-2 bg-slate-50/50 px-4 rounded-[16px] border border-slate-100">
                  <input
                    type="checkbox"
                    id="profActivo"
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    checked={profForm.activo}
                    onChange={(e) => setProfForm({ ...profForm, activo: e.target.checked })}
                  />
                  <label htmlFor="profActivo" className="text-[11px] font-bold uppercase tracking-wide text-slate-600 cursor-pointer select-none">
                    Estado Activo en Agenda
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProfModalOpen(false)}
                    className="px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-[16px] bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-md shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiSave className="text-base" />
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER MAIN VIEW: LIST OF PROFESSIONALS & RESOURCES
  // =========================================================================
  return (
    <>
    <div className="space-y-6 animate-fadeIn">
      {/* ─── TAB NAVIGATION & ACTIONS BAR ─── */}
      <div className="bg-white rounded-[24px] border border-slate-200/50 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Sub-Tabs (Oral Drive style) */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-[18px] border border-slate-200/20 w-fit">
          <button
            onClick={() => { setActiveTab("profesionales"); setSearchTerm(""); }}
            className={`
              px-6 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "profesionales"
                ? "bg-white text-blue-600 shadow-md shadow-blue-50 font-black"
                : "text-slate-500 hover:text-slate-800"
              }
            `}
          >
            <FiUsers className="text-base" />
            Profesionales
          </button>
          <button
            onClick={() => { setActiveTab("recursos"); setSearchTerm(""); }}
            className={`
              px-6 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "recursos"
                ? "bg-white text-blue-600 shadow-md shadow-blue-50 font-black"
                : "text-slate-500 hover:text-slate-800"
              }
            `}
          >
            <FiActivity className="text-base" />
            Recursos Físicos
          </button>
        </div>

        {/* Toolbar: Search and Create Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative group">
            <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={activeTab === "profesionales" ? "BUSCAR PROFESIONALES..." : "BUSCAR CONSULTORIOS..."}
              className="pl-11 pr-5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-[16px] text-[12px] font-bold text-slate-700 outline-none w-full sm:w-64 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all uppercase tracking-wider placeholder:text-slate-300 shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          {/* Add physical resource button */}
          {activeTab === "recursos" && (
            <button
              onClick={() => handleOpenResModal()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all active:scale-95 overflow-hidden"
            >
              <FiPlus className="text-base" />
              Nuevo Recurso
            </button>
          )}

          {activeTab === "profesionales" && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-[16px] text-[10px] text-blue-600 font-bold max-w-xs">
              <FiInfo className="shrink-0 text-sm" />
              <span>Crea nuevos usuarios en Configuración &gt; Usuarios</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── DATA TABLE AREA ─── */}
      <div className="bg-white rounded-[24px] border border-slate-200/50 shadow-sm overflow-hidden">
        {activeTab === "profesionales" ? (
          /* =========================================================================
             TAB: PROFESSIONALS
             ========================================================================= */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombres</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellidos</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingProfs ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sincronizando profesionales...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProfs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron profesionales registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredProfs.map((prof) => (
                    <tr
                      key={prof.id}
                      onClick={() => setSelectedProfForSchedule(prof)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors duration-150 group"
                    >
                      <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase group-hover:text-blue-600 transition-colors">
                        {prof.nombre || "—"}
                      </td>
                      <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">
                        {prof.apellido || "—"}
                      </td>
                      <td className="px-6 py-4 text-[12px] font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <FiPhone className="text-slate-400" />
                          <span>{prof.telefonoMovil || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {prof.activo !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedProfForSchedule(prof)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90 ml-auto"
                          title="Configurar Horarios y Agenda del Profesional"
                        >
                          <FiCalendar size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* =========================================================================
             TAB: PHYSICAL RESOURCES
             ========================================================================= */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurso / Consultorio</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingRes ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sincronizando recursos...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No hay consultorios ni recursos registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((res) => (
                    <tr
                      key={res.id}
                      onClick={() => setSelectedResForSchedule(res)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors duration-150 group"
                    >
                      <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase group-hover:text-blue-600 transition-colors">
                        {res.nombre}
                      </td>
                      <td className="px-6 py-4 text-[12px] font-medium text-slate-500 uppercase max-w-xs truncate">
                        {res.ubicacion || res.descripcion || "Sin descripción"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {res.activo !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedResForSchedule(res)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                          title="Configurar Horarios de Atención del Consultorio"
                        >
                          <FiCalendar size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenResModal(res)}
                          className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                          title="Editar Datos del Consultorio (Nombre/Ubicación)"
                        >
                          <FiEdit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {resModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {selectedRes ? "Editar Consultorio" : "Nuevo Consultorio"}
              </h3>
              <button
                type="button"
                onClick={() => { setResModalOpen(false); setSelectedRes(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
              >
                <FiX size={14} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveRes}>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nombre del consultorio <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={resForm.nombre}
                    onChange={(e) => setResForm({ ...resForm, nombre: e.target.value })}
                    placeholder="Ej: Consultorio 1"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Descripción / Ubicación
                  </label>
                  <input
                    type="text"
                    value={resForm.descripcion}
                    onChange={(e) => setResForm({ ...resForm, descripcion: e.target.value })}
                    placeholder="Ej: Piso 2, ala norte"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado:</label>
                  <button
                    type="button"
                    onClick={() => setResForm({ ...resForm, active: !resForm.active })}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-all ${
                      resForm.active
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {resForm.active ? <><FiCheck size={12} /> Activo</> : "Inactivo"}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  type="button"
                  onClick={() => { setResModalOpen(false); setSelectedRes(null); }}
                  className="h-9 px-4 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                  ) : (
                    <><FiSave size={13} /> {selectedRes ? "Actualizar" : "Crear consultorio"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
