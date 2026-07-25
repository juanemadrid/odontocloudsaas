import React, { useState, useEffect } from "react";
import { 
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, serverTimestamp 
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
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

  // Fetch Professionals (Doctors)
  useEffect(() => {
    if (!inquilino) return;

    setLoadingProfs(true);
    const q = query(
      collection(db, "usuarios"),
      where("inquilino", "==", inquilino)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(u => 
        u.esDoctor === true || 
        (typeof u.rol === 'string' && ['doctor', 'odontologo', 'especialista'].includes(u.rol.toLowerCase())) ||
        (typeof u.profileName === 'string' && u.profileName.toLowerCase().includes('octor'))
      );
      setProfessionals(filtered);
      setLoadingProfs(false);
    }, (err) => {
      console.error("Error fetching professionals:", err);
      setLoadingProfs(false);
    });

    return () => unsubscribe();
  }, [inquilino]);

  // Fetch Physical Resources
  useEffect(() => {
    if (!inquilino) return;

    setLoadingRes(true);
    const q = query(
      collection(db, "tenants", inquilino, "recursos_fisicos"),
      orderBy("nombre", "asc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setResources(docs);
      setLoadingRes(false);
    }, (err) => {
      console.error("Error fetching resources:", err);
      setLoadingRes(false);
    });

    return () => unsubscribe();
  }, [inquilino]);

  // Reactive listeners for selected doctor's schedule subcollections
  useEffect(() => {
    if (!selectedProfForSchedule) return;

    setLoadingSchedule(true);
    const docId = selectedProfForSchedule.id;

    // Listen to predefined weekly schedule
    const unsubPred = onSnapshot(
      collection(db, "usuarios", docId, "horarios_predefinidos"),
      (snap) => {
        setPredefinedSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingSchedule(false);
      }
    );

    // Listen to open agenda dates
    const unsubOpen = onSnapshot(
      collection(db, "usuarios", docId, "agenda_abierta"),
      (snap) => {
        setOpenAgendaSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Listen to unavailable dates
    const unsubUnavail = onSnapshot(
      collection(db, "usuarios", docId, "no_disponibles"),
      (snap) => {
        setUnavailableSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubPred();
      unsubOpen();
      unsubUnavail();
    };
  }, [selectedProfForSchedule]);

  // Reactive listeners for selected resource's schedule subcollections
  useEffect(() => {
    if (!selectedResForSchedule || !inquilino) return;

    setLoadingSchedule(true);
    const resId = selectedResForSchedule.id;

    // Listen to predefined weekly schedule of the resource
    const unsubPred = onSnapshot(
      collection(db, "tenants", inquilino, "recursos_fisicos", resId, "horarios_predefinidos"),
      (snap) => {
        setPredefinedSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingSchedule(false);
      }
    );

    // Listen to open agenda dates of the resource
    const unsubOpen = onSnapshot(
      collection(db, "tenants", inquilino, "recursos_fisicos", resId, "agenda_abierta"),
      (snap) => {
        setOpenAgendaSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Listen to unavailable dates of the resource
    const unsubUnavail = onSnapshot(
      collection(db, "tenants", inquilino, "recursos_fisicos", resId, "no_disponibles"),
      (snap) => {
        setUnavailableSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubPred();
      unsubOpen();
      unsubUnavail();
    };
  }, [selectedResForSchedule, inquilino]);

  // Save Professional basic info
  const handleSaveProf = async (e) => {
    e.preventDefault();
    if (!selectedProf) return;

    setSaving(true);
    try {
      const profRef = doc(db, "usuarios", selectedProf.id);
      await updateDoc(profRef, {
        nombre: profForm.nombre.trim(),
        apellido: profForm.apellido.trim(),
        nombreCompleto: `${profForm.nombre.trim()} ${profForm.apellido.trim()}`.trim(),
        telefonoMovil: profForm.telefonoMovil.trim(),
        activo: profForm.activo,
        updatedAt: serverTimestamp()
      });
      setProfModalOpen(false);
      setSelectedProf(null);
    } catch (err) {
      console.error("Error updating professional:", err);
      alert("Error al actualizar el profesional");
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
        descripcion: res.descripcion || "",
        active: res.active !== false
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

  // Save resource
  const handleSaveRes = async (e) => {
    e.preventDefault();
    if (!inquilino) return;
    if (!resForm.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const resCollection = collection(db, "tenants", inquilino, "recursos_fisicos");
      
      if (selectedRes) {
        const resRef = doc(resCollection, selectedRes.id);
        await updateDoc(resRef, {
          nombre: resForm.nombre.trim(),
          descripcion: resForm.descripcion.trim(),
          active: resForm.active,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(resCollection, {
          nombre: resForm.nombre.trim(),
          descripcion: resForm.descripcion.trim(),
          active: resForm.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setResModalOpen(false);
      setSelectedRes(null);
    } catch (err) {
      console.error("Error saving resource:", err);
      alert("Error al guardar el recurso físico");
    } finally {
      setSaving(false);
    }
  };

  // Delete Resource
  const handleDeleteRes = async (id) => {
    if (!inquilino) return;
    if (!window.confirm("¿Está seguro de eliminar este recurso físico? Las citas asociadas podrían perder su referencia.")) return;

    try {
      const resRef = doc(db, "tenants", inquilino, "recursos_fisicos", id);
      await deleteDoc(resRef);
    } catch (err) {
      console.error("Error deleting resource:", err);
      alert("Error al eliminar el recurso físico");
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
    if (!activeEntity) return;

    // Get checked days
    const selectedDays = Object.keys(predForm.dias).filter(d => predForm.dias[d]);
    if (selectedDays.length === 0) {
      alert("Debe seleccionar al menos un día de la semana");
      return;
    }

    setSaving(true);
    try {
      const docId = activeEntity.id;
      const subRef = selectedResForSchedule
        ? collection(db, "tenants", inquilino, "recursos_fisicos", docId, "horarios_predefinidos")
        : collection(db, "usuarios", docId, "horarios_predefinidos");
      const selectedResource = resources.find(r => r.id === predForm.recursoId);
      const recursoNombre = predForm.recursoId === "todos" ? "Todos" : (selectedResource?.nombre || "Todos");

      const basePayload = selectedResForSchedule
        ? {
            horaInicio: format12h(predForm.horaInicio),
            horaFin: format12h(predForm.horaFin),
            updatedAt: serverTimestamp()
          }
        : {
            horaInicio: format12h(predForm.horaInicio),
            horaFin: format12h(predForm.horaFin),
            recursoId: predForm.recursoId,
            recursoNombre,
            updatedAt: serverTimestamp()
          };

      if (selectedPredSlot) {
        // Edit mode: update existing slot with the first selected day, and add others as new if multiple are checked
        const firstDay = selectedDays[0];
        await updateDoc(doc(subRef, selectedPredSlot.id), {
          ...basePayload,
          dia: firstDay
        });

        for (let i = 1; i < selectedDays.length; i++) {
          await addDoc(subRef, {
            ...basePayload,
            dia: selectedDays[i],
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Create mode: add a slot document for each selected day
        for (const day of selectedDays) {
          await addDoc(subRef, {
            ...basePayload,
            dia: day,
            createdAt: serverTimestamp()
          });
        }
      }
      setPredModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar horario predefinido");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePred = async (slotId) => {
    if (!window.confirm("¿Desea eliminar este horario predefinido?")) return;
    try {
      const docId = (selectedProfForSchedule || selectedResForSchedule).id;
      const path = selectedResForSchedule
        ? doc(db, "tenants", inquilino, "recursos_fisicos", docId, "horarios_predefinidos", slotId)
        : doc(db, "usuarios", docId, "horarios_predefinidos", slotId);
      await deleteDoc(path);
      alert("Horario predefinido eliminado correctamente");
    } catch (err) {
      console.error(err);
      alert("Error al eliminar horario predefinido: " + err.message);
    }
  };

  // Open Agenda Add/Edit
  const handleOpenOpenModal = (slot = null) => {
    if (slot) {
      setSelectedOpenSlot(slot);
      setOpenForm({
        fecha: slot.fecha,
        horaInicio: convertTo24h(slot.horaInicio),
        horaFin: convertTo24h(slot.horaFin)
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
    if (!activeEntity || !openForm.fecha) return;

    setSaving(true);
    try {
      const docId = activeEntity.id;
      const subRef = selectedResForSchedule
        ? collection(db, "tenants", inquilino, "recursos_fisicos", docId, "agenda_abierta")
        : collection(db, "usuarios", docId, "agenda_abierta");
      const dia = getDayNameSpanish(openForm.fecha);

      const payload = {
        fecha: openForm.fecha,
        dia,
        horaInicio: format12h(openForm.horaInicio),
        horaFin: format12h(openForm.horaFin),
        updatedAt: serverTimestamp()
      };

      if (selectedOpenSlot) {
        await updateDoc(doc(subRef, selectedOpenSlot.id), payload);
      } else {
        await addDoc(subRef, {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setOpenModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar horario de apertura");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpen = async (slotId) => {
    if (!window.confirm("¿Desea eliminar esta fecha de apertura?")) return;
    try {
      const docId = (selectedProfForSchedule || selectedResForSchedule).id;
      const path = selectedResForSchedule
        ? doc(db, "tenants", inquilino, "recursos_fisicos", docId, "agenda_abierta", slotId)
        : doc(db, "usuarios", docId, "agenda_abierta", slotId);
      await deleteDoc(path);
      alert("Fecha de apertura eliminada correctamente");
    } catch (err) {
      console.error(err);
      alert("Error al eliminar fecha de apertura: " + err.message);
    }
  };

  // Unavailable Schedule Add/Edit
  const handleOpenUnavailModal = (slot = null) => {
    if (slot) {
      setSelectedUnavailSlot(slot);
      setUnavailForm({
        fecha: slot.fecha,
        horaInicio: convertTo24h(slot.horaInicio),
        horaFin: convertTo24h(slot.horaFin),
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
    if (!activeEntity || !unavailForm.fecha) return;

    setSaving(true);
    try {
      const docId = activeEntity.id;
      const subRef = selectedResForSchedule
        ? collection(db, "tenants", inquilino, "recursos_fisicos", docId, "no_disponibles")
        : collection(db, "usuarios", docId, "no_disponibles");
      const dia = getDayNameSpanish(unavailForm.fecha);

      const payload = {
        fecha: unavailForm.fecha,
        dia,
        horaInicio: format12h(unavailForm.horaInicio),
        horaFin: format12h(unavailForm.horaFin),
        motivo: unavailForm.motivo.trim(),
        updatedAt: serverTimestamp()
      };

      if (selectedUnavailSlot) {
        await updateDoc(doc(subRef, selectedUnavailSlot.id), payload);
      } else {
        await addDoc(subRef, {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setUnavailModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar horario no disponible");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnavail = async (slotId) => {
    if (!window.confirm("¿Desea eliminar esta fecha no disponible?")) return;
    try {
      const docId = (selectedProfForSchedule || selectedResForSchedule).id;
      const path = selectedResForSchedule
        ? doc(db, "tenants", inquilino, "recursos_fisicos", docId, "no_disponibles", slotId)
        : doc(db, "usuarios", docId, "no_disponibles", slotId);
      await deleteDoc(path);
      alert("Bloqueo de no disponibilidad eliminado correctamente");
    } catch (err) {
      console.error(err);
      alert("Error al eliminar bloqueo: " + err.message);
    }
  };

  // Checkbox select toggle handlers
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

  // Bulk delete Firestore handler
  const handleBulkDelete = async () => {
    const activeEntity = selectedProfForSchedule || selectedResForSchedule;
    if (!activeEntity) return;
    const docId = activeEntity.id;

    let targetIds = [];
    let subcollectionName = "";
    if (scheduleActiveTab === "predefinido") {
      targetIds = selectedPredIds;
      subcollectionName = "horarios_predefinidos";
    } else if (scheduleActiveTab === "abrir") {
      targetIds = selectedOpenIds;
      subcollectionName = "agenda_abierta";
    } else if (scheduleActiveTab === "nodisponible") {
      targetIds = selectedUnavailIds;
      subcollectionName = "no_disponibles";
    }

    if (targetIds.length === 0) return;

    if (!window.confirm(`¿Está seguro de eliminar los ${targetIds.length} horarios seleccionados?`)) {
      return;
    }

    try {
      setSaving(true);
      for (const id of targetIds) {
        const path = selectedResForSchedule
          ? doc(db, "tenants", inquilino, "recursos_fisicos", docId, subcollectionName, id)
          : doc(db, "usuarios", docId, subcollectionName, id);
        await deleteDoc(path);
      }
      
      // Clear selection
      if (scheduleActiveTab === "predefinido") setSelectedPredIds([]);
      else if (scheduleActiveTab === "abrir") setSelectedOpenIds([]);
      else if (scheduleActiveTab === "nodisponible") setSelectedUnavailIds([]);
    } catch (err) {
      console.error("Error in bulk delete:", err);
      alert("Error al eliminar los horarios seleccionados");
    } finally {
      setSaving(false);
    }
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
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin}</td>
                        {isDoctorMode && (
                          <td className="px-6 py-4 text-[12px] font-bold text-blue-600 uppercase">{slot.recursoNombre || "Todos"}</td>
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
                            onClick={() => handleDeletePred(slot.id)}
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
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenOpenModal(slot)}
                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                            title="Editar"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteOpen(slot.id)}
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
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaInicio}</td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-600">{slot.horaFin}</td>
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
                            onClick={() => handleDeleteUnavail(slot.id)}
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
                    <tr key={prof.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                      <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">
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
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedProfForSchedule(prof)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90 ml-auto"
                          title="Editar Horarios y Configuración"
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
                    <tr key={res.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                      <td className="px-6 py-4 text-[12px] font-bold text-slate-700 uppercase">
                        {res.nombre}
                      </td>
                      <td className="px-6 py-4 text-[12px] font-medium text-slate-500 uppercase max-w-xs truncate">
                        {res.descripcion || "Sin descripción"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {res.active !== false ? (
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
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedResForSchedule(res)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90 ml-auto"
                          title="Editar consultorio"
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
  );
}
