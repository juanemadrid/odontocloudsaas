// src/modules/administracion/views/Convenios.jsx
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { 
  collection, query, where, getDocs, doc, setDoc, 
  addDoc, serverTimestamp, updateDoc, deleteDoc 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { 
  FiCheckSquare, FiPlus, FiSearch, FiEdit3, FiTrash2, 
  FiSave, FiAlertCircle, FiArrowRight, FiArrowLeft, 
  FiEye, FiEyeOff, FiToggleLeft, FiToggleRight, FiInfo, FiPercent
} from "react-icons/fi";

const formatNumberWithDots = (num) => {
  if (num === undefined || num === null || num === "" || num === 0) return "";
  const parts = String(Math.round(Number(num) || 0)).replace(/\D/g, "");
  return parts.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function Convenios() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // Views: 'LIST' | 'FORM'
  const [viewMode, setViewMode] = useState("LIST");
  const [step, setStep] = useState(1); // Wizard step: 1 or 2
  const [convenios, setConvenios] = useState([]);
  const [listasPrecios, setListasPrecios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingConvenio, setEditingConvenio] = useState(null);
  const [selectedConvenio, setSelectedConvenio] = useState(null);
  const [priceListItems, setPriceListItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [discounts, setDiscounts] = useState({});
  const [savingDiscounts, setSavingDiscounts] = useState(false);
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [detailCategory, setDetailCategory] = useState("TODAS");
  const [detailCategories, setDetailCategories] = useState(["TODAS"]);

  const loadConvenioDetails = async (convenio) => {
    if (!convenio?.listaPreciosId) return;
    setLoadingItems(true);
    try {
      const snapItems = await getDocs(collection(db, "listas_precios", convenio.listaPreciosId, "items"));
      const items = snapItems.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setPriceListItems(items);

      const cats = items.map(i => i.categoria).filter(c => !!c);
      setDetailCategories(["TODAS", ...new Set(cats)]);

      const snapDiscounts = await getDocs(collection(db, "convenios", convenio.id, "descuentos"));
      const discMap = {};
      snapDiscounts.docs.forEach(doc => {
        discMap[doc.id] = doc.data();
      });
      setDiscounts(discMap);
    } catch (e) {
      console.error("Error loading convenio details:", e);
      toast?.error("Error al cargar los servicios del convenio");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleDiscountChange = (itemId, originalPrice, field, value) => {
    setDiscounts(prev => {
      const current = prev[itemId] || { desc_porc: 0, descuento: 0 };
      let newPorc = current.desc_porc;
      let newVal = current.descuento;

      if (field === "desc_porc") {
        newPorc = Math.max(0, Math.min(100, Number(value) || 0));
        newVal = (originalPrice * newPorc) / 100;
      } else if (field === "descuento") {
        newVal = Math.max(0, Math.min(originalPrice, Number(value) || 0));
        newPorc = originalPrice > 0 ? (newVal / originalPrice) * 100 : 0;
      }

      return {
        ...prev,
        [itemId]: {
          desc_porc: Number(newPorc.toFixed(2)),
          descuento: Number(newVal.toFixed(2))
        }
      };
    });
  };

  const handleSaveDiscounts = async () => {
    if (!selectedConvenio?.id) return;
    setSavingDiscounts(true);
    try {
      const promises = Object.entries(discounts).map(async ([itemId, disc]) => {
        const docRef = doc(db, "convenios", selectedConvenio.id, "descuentos", itemId);
        if (disc.desc_porc > 0 || disc.descuento > 0) {
          await setDoc(docRef, {
            desc_porc: disc.desc_porc,
            descuento: disc.descuento,
            updatedAt: new Date().toISOString()
          });
        } else {
          await deleteDoc(docRef);
        }
      });
      await Promise.all(promises);
      toast?.success("Descuentos del convenio guardados con éxito");
      setViewMode("LIST");
    } catch (e) {
      console.error("Error saving discounts:", e);
      toast?.error("Error al guardar los descuentos");
    } finally {
      setSavingDiscounts(false);
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactivos, setShowInactivos] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nombre: "",
    nroBeneficiarios: 0,
    listaPreciosId: "",
    nombreContacto: "",
    email: "",
    telefono: "",
    direccion: "",
    sucursalesIds: [], // Selected branches
    activo: true
  });

  useEffect(() => {
    if (inquilino) {
      loadConvenios();
      loadMetadata();
    }
  }, [inquilino]);

  const loadConvenios = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "convenios"), 
        where("inquilino", "==", inquilino)
      );
      const snap = await getDocs(q);
      setConvenios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Error loading convenios:", e);
      toast?.error("Error al cargar convenios");
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      // 1. Price lists
      const qL = query(
        collection(db, "listas_precios"), 
        where("inquilino", "==", inquilino)
      );
      const snapL = await getDocs(qL);
      setListasPrecios(snapL.docs.map(d => ({ id: d.id, nombre: d.data().nombre })));

      // 2. Branches
      const qS = query(
        collection(db, "sucursales"), 
        where("inquilino", "==", inquilino)
      );
      const snapS = await getDocs(qS);
      setSucursales(snapS.docs.map(d => ({ id: d.id, nombre: d.data().nombre })));
    } catch (e) {
      console.error("Error loading convenios metadata:", e);
    }
  };

  const handleNew = () => {
    setEditingConvenio(null);
    setFormData({
      nombre: "",
      nroBeneficiarios: 0,
      listaPreciosId: listasPrecios[0]?.id || "",
      nombreContacto: "",
      email: "",
      telefono: "",
      direccion: "",
      sucursalesIds: sucursales.map(s => s.id), // All branches by default
      activo: true
    });
    setStep(1);
    setViewMode("FORM");
  };

  const handleEdit = (convenio) => {
    setEditingConvenio(convenio);
    setFormData({
      nombre: convenio.nombre || "",
      nroBeneficiarios: convenio.nroBeneficiarios || 0,
      listaPreciosId: convenio.listaPreciosId || "",
      nombreContacto: convenio.nombreContacto || "",
      email: convenio.email || "",
      telefono: convenio.telefono || "",
      direccion: convenio.direccion || "",
      sucursalesIds: convenio.sucursalesIds || [],
      activo: convenio.activo !== undefined ? convenio.activo : true
    });
    setStep(1);
    setViewMode("FORM");
  };

  const handleToggleActivo = async (convenio) => {
    try {
      const docRef = doc(db, "convenios", convenio.id);
      const newStatus = !convenio.activo;
      await updateDoc(docRef, { activo: newStatus });
      toast?.success(`Convenio ${newStatus ? "activado" : "inactivado"} con éxito`);
      loadConvenios();
    } catch (e) {
      console.error(e);
      toast?.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (convenio) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente al convenio "${convenio.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db, "convenios", convenio.id));
      toast?.success("Convenio eliminado con éxito");
      loadConvenios();
    } catch (e) {
      console.error(e);
      toast?.error("Error al eliminar el convenio");
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    // Validate Step 1
    if (!formData.nombre.trim()) return toast?.error("El nombre del convenio es requerido");
    if (formData.nroBeneficiarios < 0) return toast?.error("El número de beneficiarios no puede ser negativo");
    if (!formData.nombreContacto.trim()) return toast?.error("El nombre del contacto es requerido");
    if (!formData.email.trim()) return toast?.error("El correo del contacto es requerido");
    if (!formData.telefono.trim()) return toast?.error("El teléfono es requerido");
    if (!formData.direccion.trim()) return toast?.error("La dirección es requerida");

    setStep(2);
  };

  const handleViewDetails = (convenio) => {
    setSelectedConvenio(convenio);
    setViewMode("DETAIL");
    loadConvenioDetails(convenio);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const priceListName = listasPrecios.find(l => l.id === formData.listaPreciosId)?.nombre || "Particular / Base";
      const dataToSave = {
        ...formData,
        nombre: formData.nombre.trim(),
        nombreContacto: formData.nombreContacto.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
        listaPreciosNombre: priceListName,
        inquilino,
        updatedAt: serverTimestamp()
      };

      let convenioId = editingConvenio?.id;
      if (editingConvenio?.id) {
        await setDoc(doc(db, "convenios", editingConvenio.id), dataToSave, { merge: true });
      } else {
        dataToSave.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "convenios"), dataToSave);
        convenioId = docRef.id;
      }

      toast?.success(editingConvenio ? "Convenio actualizado correctamente" : "Convenio creado con éxito");
      
      const savedConvenio = { id: convenioId, ...dataToSave };
      handleViewDetails(savedConvenio);
      loadConvenios();
    } catch (e) {
      console.error(e);
      toast?.error("Error al guardar el convenio");
    } finally {
      setSaving(false);
    }
  };

  const handleBranchToggle = (branchId) => {
    setFormData(prev => {
      const ids = prev.sucursalesIds.includes(branchId)
        ? prev.sucursalesIds.filter(id => id !== branchId)
        : [...prev.sucursalesIds, branchId];
      return { ...prev, sucursalesIds: ids };
    });
  };

  // Filtered List
  const filteredConvenios = convenios.filter(c => {
    const isStatusMatch = showInactivos ? !c.activo : c.activo;
    if (!isStatusMatch) return false;

    const term = searchQuery.toLowerCase();
    const cName = (c.nombre || "").toLowerCase();
    const cPriceList = (c.listaPreciosNombre || "").toLowerCase();
    const cContact = (c.nombreContacto || "").toLowerCase();

    return cName.includes(term) || cPriceList.includes(term) || cContact.includes(term);
  });

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/60 shadow-md p-6 h-full flex flex-col overflow-hidden animate-fadeIn">
      {viewMode === "LIST" ? (
        <>
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="relative w-full sm:max-w-md">
              <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar convenio..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowInactivos(!showInactivos)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  showInactivos 
                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {showInactivos ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                <span>{showInactivos ? "Ver Activos" : "Ver Inactivos"}</span>
              </button>

              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 hover:-translate-y-0.5 active:scale-95"
              >
                <FiPlus size={15} strokeWidth={3} />
                <span>Nuevo convenio</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Nombre convenio</th>
                  <th className="px-6 py-4">Lista de precios</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Nombre contacto</th>
                  <th className="px-6 py-4 text-center">Sucursales</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" style={{ border: "3px solid #f1f5f9", borderTopColor: "#3b82f6" }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando convenios...</span>
                    </td>
                  </tr>
                ) : filteredConvenios.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="text-3xl mb-3">🤝</div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron convenios registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredConvenios.map((convenio) => {
                    const mappedBranches = sucursales
                      .filter(s => convenio.sucursalesIds?.includes(s.id))
                      .map(s => s.nombre);
                    return (
                      <tr key={convenio.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-[13px]">
                          {convenio.nombre}
                          <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Beneficiarios: {convenio.nroBeneficiarios || 0}</div>
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-slate-600">
                          {convenio.listaPreciosNombre || "Particular / Base"}
                        </td>
                        <td className="px-6 py-4 text-[12px] font-semibold text-slate-500">
                          {convenio.direccion}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[12px] font-bold text-slate-700">{convenio.nombreContacto}</div>
                          <div className="text-[10px] text-slate-400 lowercase">{convenio.email} | {convenio.telefono}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span 
                            className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-black px-2.5 py-1 rounded-full text-[10px]"
                            title={mappedBranches.length > 0 ? mappedBranches.join(", ") : "Ninguna"}
                          >
                            {mappedBranches.length} {mappedBranches.length === 1 ? "sucursal" : "sucursales"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleViewDetails(convenio)}
                              className="w-7 h-7 rounded-lg bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                              title="Gestionar Descuentos"
                            >
                              <FiPercent size={13} />
                            </button>
                            <button
                              onClick={() => handleEdit(convenio)}
                              className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                              title="Editar Convenio"
                            >
                              <FiEdit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(convenio)}
                              className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0 ${
                                convenio.activo ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"
                              }`}
                              title={convenio.activo ? "Inactivar Convenio" : "Activar Convenio"}
                            >
                              {convenio.activo ? <FiToggleRight size={13} /> : <FiToggleLeft size={13} />}
                            </button>
                            <button
                              onClick={() => handleDelete(convenio)}
                              className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                              title="Eliminar Convenio"
                            >
                              <FiTrash2 size={13} />
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
        </>
      ) : viewMode === "FORM" ? (
        /* CREATE / EDIT FORM VIEW */
        <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6 shrink-0">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Convenios / {editingConvenio ? "Editar" : "Nuevo Convenio"} / Paso {step} de 2
              </span>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {step === 1 ? "Información convenio & contacto" : "Sucursales del convenio"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
                >
                  <span>Continuar</span>
                  <FiArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  <FiSave size={14} />
                  <span>{saving ? "Guardando..." : "Guardar"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
            {step === 1 ? (
              <div className="space-y-6">
                
                {/* Sec 1: Información convenio */}
                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    Información convenio
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Nombre del convenio *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Nombre del convenio"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Nro de beneficiarios *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.nroBeneficiarios}
                        onChange={(e) => setFormData({ ...formData, nroBeneficiarios: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Lista de precios
                      </label>
                      <select
                        value={formData.listaPreciosId}
                        onChange={(e) => setFormData({ ...formData, listaPreciosId: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                      >
                        <option value="">Seleccione...</option>
                        {listasPrecios.map(list => (
                          <option key={list.id} value={list.id}>{list.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sec 2: Información de contacto */}
                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    Información de contacto
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Nombre del contacto *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nombreContacto}
                        onChange={(e) => setFormData({ ...formData, nombreContacto: e.target.value })}
                        placeholder="Nombre del contacto"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ingrese e-mail"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Teléfono *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Celular o fijo"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Dirección *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Ingrese la dirección"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                      />
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* STEP 2: Branches checklist */
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <FiCheckSquare className="text-blue-600" />
                    Sucursales habilitadas
                  </h4>
                  <p className="text-[11px] font-medium text-slate-400">
                    Selecciona en cuáles sucursales de tu clínica estará disponible y habilitado este convenio comercial.
                  </p>
                </div>

                {sucursales.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-slate-200/50 rounded-xl">
                    <FiInfo size={24} className="mx-auto text-slate-300 mb-2" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">No hay sucursales creadas en la clínica.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                    {sucursales.map(suc => {
                      const isChecked = formData.sucursalesIds.includes(suc.id);
                      return (
                        <label 
                          key={suc.id} 
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                            isChecked 
                              ? "bg-blue-50/40 border-blue-200 text-blue-800" 
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleBranchToggle(suc.id)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold uppercase tracking-wide">{suc.nombre}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/60 transition-all"
              >
                <FiArrowLeft size={14} />
                <span>Atrás</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className="px-6 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/60 transition-all"
              >
                Cancelar
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center gap-2 px-8 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-100"
              >
                <span>Continuar</span>
                <FiArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-100 disabled:opacity-50"
              >
                <FiSave size={14} />
                <span>{saving ? "Guardando..." : "Guardar"}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* DETAIL VIEW */
        <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6 shrink-0">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Convenios / {selectedConvenio?.nombre} / Gestión de Descuentos
              </span>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Servicios del tarifario: {selectedConvenio?.listaPreciosNombre}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className="px-6 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/60 transition-all"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSaveDiscounts}
                disabled={savingDiscounts}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-[#8dc63f]/25 disabled:opacity-50"
              >
                <FiSave size={14} />
                <span>{savingDiscounts ? "Guardando..." : "Guardar Descuentos"}</span>
              </button>
            </div>
          </div>

          {/* Convenio Summary Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-6 shrink-0 text-slate-700">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Contacto</span>
              <span className="text-xs font-bold text-slate-800">{selectedConvenio?.nombreContacto}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">E-mail / Teléfono</span>
              <span className="text-xs font-semibold text-slate-600">{selectedConvenio?.email} | {selectedConvenio?.telefono}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tarifario Base</span>
              <span className="text-xs font-bold text-indigo-600">{selectedConvenio?.listaPreciosNombre}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Dirección</span>
              <span className="text-xs font-semibold text-slate-600">{selectedConvenio?.direccion}</span>
            </div>
          </div>

          {/* Controls: Search & Category */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4 shrink-0">
            <div className="relative flex-1">
              <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
                placeholder="Buscar servicio por nombre o código..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={detailCategory}
                onChange={(e) => setDetailCategory(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[12px] font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-400 transition-all"
              >
                {detailCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Services Table */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                  <th className="px-6 py-4">Código / Servicio</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4 text-right">Precio Original</th>
                  <th className="px-6 py-4 text-center w-36">Descuento (%)</th>
                  <th className="px-6 py-4 text-center w-40">Descuento ($)</th>
                  <th className="px-6 py-4 text-right">Precio Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 text-slate-700">
                {loadingItems ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" style={{ border: "3px solid #f1f5f9", borderTopColor: "#3b82f6" }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando servicios...</span>
                    </td>
                  </tr>
                ) : priceListItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="text-3xl mb-3">📋</div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay servicios en esta lista de precios</p>
                    </td>
                  </tr>
                ) : (
                  priceListItems
                    .filter(item => {
                      const matchesSearch = 
                        (item.nombre || "").toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
                        (item.codigo || "").toLowerCase().includes(detailSearchQuery.toLowerCase());
                      const matchesCat = detailCategory === "TODAS" || item.categoria === detailCategory;
                      return matchesSearch && matchesCat;
                    })
                    .map(item => {
                      const originalPrice = item.precio || 0;
                      const disc = discounts[item.id] || { desc_porc: 0, descuento: 0 };
                      const finalPrice = Math.max(0, originalPrice - disc.descuento);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-bold text-slate-800">{item.nombre}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{item.codigo || "SIN CÓDIGO"}</div>
                          </td>
                          <td className="px-6 py-4 text-[11px] font-semibold text-slate-500">
                            {item.categoria || "General"}
                          </td>
                          <td className="px-6 py-4 text-right text-[12px] font-bold text-slate-700">
                            $ {originalPrice.toLocaleString("es-CO")}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="relative inline-block w-28">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={disc.desc_porc || ""}
                                onChange={(e) => handleDiscountChange(item.id, originalPrice, "desc_porc", e.target.value)}
                                placeholder="0"
                                className="w-full text-right pr-7 pl-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="relative inline-block w-36">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                              <input
                                type="text"
                                value={disc.descuento ? formatNumberWithDots(disc.descuento) : ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  handleDiscountChange(item.id, originalPrice, "descuento", raw);
                                }}
                                placeholder="0"
                                className="w-full text-right pr-2 pl-6 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-[12px] font-black text-indigo-600">
                            $ {finalPrice.toLocaleString("es-CO")}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
